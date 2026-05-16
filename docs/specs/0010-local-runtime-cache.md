# 0010 — Local runtime cache storage

- **Status**: implemented
- **Released in**: 1.1.0
- **Date**: 2026-05-16
- **Authors**: @o1xhack, Codex
- **Supersedes**: 0001 storage placement for TMDB cache and Trakt history state

## Context

Spec 0001 introduced two persistent runtime caches:

- `tmdbCache`: poster URLs and localized metadata fetched from TMDB.
- `historyState`: aggregated Trakt watch history plus event ids and
  incremental-sync cursors.

The original 0001 design stored both under Obsidian's plugin
`data.json`, alongside normal settings. That made sense for API
efficiency across devices, but it has a bad interaction with vault sync
systems. Obsidian Sync Standard has a 5 MB per-file limit; a large Trakt
history plus TMDB translations can push
`.obsidian/plugins/sync-trakt/data.json` over that threshold. Even below
the hard limit, writing a 4-5 MB file every auto-sync creates large
version-history churn.

The problem is storage placement, not the data model. The cache contents
remain useful and should still exist, but they are runtime data: large,
frequently rewritten, and fully rebuildable from Trakt / TMDB.

## Goals / Non-goals

### Goals

- Keep vault-synced `data.json` small enough for Obsidian Sync Standard.
- Preserve multi-device support: settings and final Markdown notes still
  sync across Mac, Windows, Linux, iOS, and Android.
- Keep the same in-memory cache shapes so the sync engine and renderers
  do not need a conceptual rewrite.
- Migrate existing users automatically: first 1.1.0 launch moves large
  runtime data out of `data.json` and writes back a slim payload.
- Treat local runtime storage as persistent but rebuildable. It should
  survive normal app restarts, but losing it must not lose user data.
- Avoid rewriting `data.json` when the synced payload did not change.

### Non-goals

- Synchronizing TMDB cache contents across devices. Each device can
  rebuild its own cache; the final Markdown notes remain the shared
  output.
- Building a custom server or cloud cache. Storage stays local to
  Obsidian and the user's devices.
- Making IndexedDB the source of truth for user settings. Settings,
  templates, auth tokens, and note content remain in synced storage.

## Design

The plugin now has two persistence classes.

### Synced settings layer

The normal Obsidian plugin `data.json` remains the canonical store for
small cross-device state:

- Trakt auth tokens and TMDB API key.
- Sync source toggles and behavior settings.
- Folder paths, filename template, note templates, language settings.
- Daily Notes settings.
- Small watch-history coordination fields:
  - `historyState.lastDailyNoteSyncedAt`
  - `historyState.lastReleaseNoticeVersion`
  - `historyState.lastAuthoritativeFullRefreshAt`

The synced `historyState` deliberately contains empty aggregate fields:

```json
{
  "historyState": {
    "byMovie": {},
    "byShow": {},
    "knownEventIds": [],
    "lastIncrementalSyncAt": "",
    "lastFullRefreshAt": "",
    "lastDailyNoteSyncedAt": "2026-05-16",
    "lastReleaseNoticeVersion": "1.1.0",
    "lastAuthoritativeFullRefreshAt": "2026-05-16T18:00:00.000Z"
  },
  "tmdbCache": {}
}
```

Keeping empty placeholders preserves backward compatibility with older
code paths that expect the keys to exist, while preventing `data.json`
from containing megabytes of cache data.

### Local runtime layer

Large runtime data is stored outside the vault:

- `tmdbCache`
- `historyState.byMovie`
- `historyState.byShow`
- `historyState.knownEventIds`
- local `historyState.lastIncrementalSyncAt`
- local `historyState.lastFullRefreshAt`

The primary backend is IndexedDB, using a plugin-owned database and a
vault-scoped key. IndexedDB is available in Obsidian's desktop Electron
runtime and mobile WebView runtimes. It is persistent across normal app
quits and restarts, but it lives in the Obsidian app data sandbox rather
than in the vault. Obsidian Sync therefore does not upload it and does
not count it against vault sync storage.

If IndexedDB is unavailable or errors, the plugin falls back to
Obsidian's `app.saveLocalStorage` / `app.loadLocalStorage`. The fallback
is still outside the vault and remains suitable for rebuildable runtime
state, but IndexedDB is preferred for large payloads.

### RuntimeStore module

`src/runtime-store.ts` owns local runtime persistence:

```typescript
interface RuntimeStoragePayload {
  schemaVersion: 1;
  tmdbCache: TmdbCache;
  historyState: HistoryState;
}
```

The rest of the plugin continues to read and mutate
`this.settings.tmdbCache` and `this.settings.historyState` in memory.
`TraktrPlugin.loadSettings()` overlays local runtime data after loading
synced settings. `TraktrPlugin.saveSettings()` saves the full runtime
payload locally, then writes only the slim synced payload to `data.json`.

### Multi-device behavior

For a vault used on Mac A, Mac B, and iOS:

1. All devices receive the same small `data.json` through Obsidian Sync.
2. Each device keeps its own local IndexedDB runtime cache outside the
   vault.
3. If a device has no local runtime cache, it does a full detailed
   history refresh and rebuilds from Trakt.
4. Subsequent syncs on that device use local incremental cursors.
5. Markdown notes remain the shared output and continue to sync through
   the vault.

Deletion handling needs one small cross-device coordinator. When any
device completes a full Trakt history refresh, it copies that timestamp
to `historyState.lastAuthoritativeFullRefreshAt` in `data.json`. A
device whose local `lastFullRefreshAt` is older than that synced value
forces its own full refresh before using its local history cache. This
prevents an old local cache from reintroducing watch events that another
device already removed after detecting a Trakt-side deletion.

## Alternatives considered

### Keep caches in data.json and warn near 5 MB

Rejected. A warning does not solve the hard single-file limit, and
version-history churn remains severe even below 5 MB.

### Store caches in separate vault files

Rejected. Obsidian Sync syncs vault files too, so this only moves the
problem from one path to another. Separate files might reduce single-file
pressure but still consume sync history and can still exceed file limits.

### Store only TMDB cache locally, keep history synced

Rejected. `historyState.knownEventIds`, `byMovie`, and `byShow` can be
larger and more frequently rewritten than TMDB cache for heavy users.
Both classes are rebuildable runtime data and belong in the same storage
layer.

## Migration / backward compatibility

On first 1.1.0 launch:

1. Load existing `data.json`.
2. If local runtime storage is empty and `data.json` contains populated
   `tmdbCache` or `historyState`, seed local runtime storage from it.
3. Keep small synced fields from `historyState`.
4. Force-save a slim `data.json` with empty cache placeholders.

Older versions can still read the slim file because the fields exist and
have default-compatible shapes. They will rebuild missing cache data if
needed.

Local runtime storage is treated as best-effort persistent storage. If it
is cleared by the operating system, by app removal, or by WebView storage
failure, the next sync rebuilds from Trakt / TMDB. No user-authored notes
or settings are stored only in the runtime layer.

## Tests

Smoke tests cover:

- Runtime storage fallback round-trip when IndexedDB is unavailable.
- Migration from a full legacy synced payload into local runtime storage.
- Slim synced payload generation: cache maps are emptied while small
  coordination fields are preserved.
- No-op save detection skips `saveData()` when the slim synced payload
  has not changed.
- Full history refresh updates `lastAuthoritativeFullRefreshAt`.

## Future work

- Show `data.json` estimated size and runtime-cache counts in the
  settings UI.
- Add a user-facing "rebuild local runtime cache" command that clears
  local IndexedDB and forces a full refresh.
- Consider a chunked IndexedDB layout if single-record runtime payloads
  become expensive for extremely large Trakt accounts.
