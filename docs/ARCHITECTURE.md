# Architecture

A reference for how the plugin is laid out and what each piece does.
Reads top-to-bottom or jump via the table of contents. Companion to
the [design specs](specs/) — specs explain *why*, this doc explains
*what is*.

For the exact control matrix that maps every sync source, command,
timer, and Daily Notes path to its API calls and write behavior, see
[`SYNC-ARCHITECTURE.md`](SYNC-ARCHITECTURE.md).

**Currency**: this doc reflects the codebase as of 1.2.0. When you ship
behavior changes that affect the architecture, update this doc in the
same commit.

## Contents

1. [Project layout](#1-project-layout)
2. [Module dependency graph](#2-module-dependency-graph)
3. [Sync flow](#3-sync-flow)
4. [Data structures](#4-data-structures)
5. [Caching layers](#5-caching-layers)
6. [API mapping](#6-api-mapping)
7. [Concurrency model](#7-concurrency-model)
8. [Error handling philosophy](#8-error-handling-philosophy)
9. [i18n architecture](#9-i18n-architecture)
10. [Settings persistence + cross-device sync](#10-settings-persistence--cross-device-sync)
11. [Note rendering pipeline](#11-note-rendering-pipeline)
12. [Testing approach](#12-testing-approach)

## 1. Project layout

```
obsidian-sync-trakt/
├── src/
│   ├── main.ts             # Plugin entry: onload(), commands, settings tab registration, status bar
│   ├── settings.ts         # TraktrSettings type, DEFAULT_SETTINGS, settings tab UI, default templates
│   ├── i18n.ts             # All plugin-runtime strings (en + zh-CN), translator function
│   ├── sync-engine.ts      # SyncEngine class — orchestrates a sync run end to end
│   ├── trakt-api.ts        # Trakt API client: device auth flow, sync endpoints, history, translations
│   ├── trakt-auth.ts       # AuthModal (device flow UI), token refresh helper
│   ├── tmdb-api.ts         # TMDB client: metadata fetch, translation picker, cache layer
│   ├── runtime-store.ts    # Vault-external runtime cache persistence (IndexedDB + fallback)
│   ├── note-renderer.ts    # Build frontmatter data, render body templates, manage body markers
│   ├── types.ts            # Shared type definitions (Trakt + TMDB shapes, NormalizedItem, history state)
│   └── utils.ts            # Generic helpers: filename sanitize, template render, YAML write/parse, concurrency limiter
├── tests/
│   ├── i18n.smoke.ts       # All smoke tests live here as a single executable
│   ├── stub-obsidian.ts    # Minimal "obsidian" module stub for the bundle alias
│   └── baseline-render.ts  # Helper that renders a fixture note for diff comparison
├── docs/
│   ├── SETUP.md            # User-facing setup walkthrough
│   ├── MANUAL.md           # Settings reference + frontmatter / template field tables
│   ├── SYNC-ARCHITECTURE.md # Sync source, timer, button, and Daily Notes control matrix
│   ├── ARCHITECTURE.md     # This file
│   ├── DEVELOPER.md        # Onboarding, build commands, contribution flow
│   ├── CHANGELOG.md        # Short release-by-release log
│   ├── specs/              # Design specs, one file per substantial change
│   ├── i18n/               # Translations of README / SETUP / MANUAL
│   └── screenshots/        # README image assets
├── .github/workflows/      # CI: lint on PR/push, release on tag push (idempotent)
├── scripts/release.sh      # Local end-to-end release: bump versions, build, tag, push, create GitHub release
├── manifest.json           # Obsidian plugin manifest (id, version, minAppVersion)
├── package.json            # npm metadata + scripts (dev / build / lint / test:i18n / release)
├── versions.json           # Map of plugin version → minimum Obsidian version (for the marketplace)
└── esbuild.config.mjs      # Bundle config: src/main.ts → main.js, externalizes obsidian module
```

## 2. Module dependency graph

```
                 ┌──────────────────┐
                 │     main.ts      │  ← Obsidian plugin entry
                 └────────┬─────────┘
        ┌─────────────────┼──────────────────┐
        │                 │                  │
        ▼                 ▼                  ▼
  ┌──────────┐     ┌─────────────┐     ┌────────────┐
  │settings.ts│    │sync-engine.ts│     │trakt-auth.ts│
  └─────┬─────┘    └─────┬───────┘     └─────┬──────┘
        │                │                   │
        │     ┌──────────┼───────────────┐   │
        ▼     ▼          ▼               ▼   │
   ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
   │i18n.ts │ │trakt-  │ │ tmdb-    │ │note-     │
   │        │ │api.ts  │ │ api.ts   │ │renderer  │
   └────────┘ └────────┘ └──────────┘ └──────────┘
        │          │           │           │
        └──────────┴───────────┴──────┐    │
                                      ▼    ▼
                                  ┌──────────┐
                                  │ utils.ts │
                                  └──────────┘
                                       │
                                       ▼
                                  ┌──────────┐
                                  │ types.ts │
                                  └──────────┘

`main.ts` also owns `runtime-store.ts`: settings are loaded from
vault-synced `data.json`, then overlaid with vault-external runtime
cache before `SyncEngine` is constructed.
```

**Acyclic.** `types.ts` and `utils.ts` are pure dependencies of
everything else; nothing imports them in the other direction.

## 3. Sync flow

A single `sync()` call in `SyncEngine` runs through this sequence. The
shape doesn't change between desktop and mobile.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ensureValidToken                                             │
│    Refresh access token via /oauth/token if it expires within   │
│    1 hour. Throws if refresh fails (caller catches + notifies). │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Fetch from Trakt list endpoints (parallel, per type)         │
│    fetchAndMergeMovies(merged): in parallel,                    │
│      - /sync/watchlist/movies     (if syncWatchlist)            │
│      - /sync/watched/movies       (if syncWatched)              │
│      - /sync/favorites/movies     (if syncFavorites)            │
│      - /sync/ratings/movies       (if syncRatings)              │
│    fetchAndMergeShows(merged): same shape with /shows variants  │
│    Each list is iterated to populate or merge into `merged`     │
│    (Map<"type:traktId", NormalizedItem>).                       │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Detailed watch history                                       │
│    If syncWatched + syncWatchedDetail are enabled, pull          │
│    /sync/history/movies and /sync/history/episodes with          │
│    start_at=lastIncrementalSyncAt, or with no filter for full    │
│    refresh. This updates historyState, then applies that state   │
│    to merged items. History-only items are seeded into merged    │
│    so media notes and Daily Notes can see them. If old local     │
│    historyState already has orphan entries, one repair full      │
│    refresh recovers the media metadata needed to seed them.      │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ensureTagNotes                                               │
│    For each unique (type, genre, source-flag) referenced by     │
│    merged items, create the corresponding tag-note file in      │
│    tagNotesFolder if it doesn't exist. Never overwrites.        │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. reconcileType                                                │
│    a) ensureFolder(folder)                                      │
│    b) scanExistingNotes → Map<"type:id", TFile> by reading      │
│       frontmatter from every .md in folder                      │
│    c) processWithConcurrency(5, items, async item => {          │
│         if no tmdb_id: fall back to Trakt translations only     │
│         else: fetchMovieMetadata / fetchTvMetadata               │
│              (cache hit/miss decided inside)                    │
│         apply translation, set poster_url                       │
│       })                                                        │
│    d) for each merged item:                                     │
│       if note exists → update frontmatter + body markers        │
│       else            → create note from full template          │
│    e) if deleteRemovedItems: trash any vault note whose key     │
│       isn't in merged                                           │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Final notice                                                 │
│    "Sync complete: N added, M updated, K removed"               │
│    Errors collected during reconcile shown in a second notice.  │
└─────────────────────────────────────────────────────────────────┘
```

Throughout, `onProgress(message)` is called at section boundaries and
inside the bounded-concurrency loop, driving both status bar (desktop)
and a persistent `Notice` (mobile + desktop).

### Daily Notes-only sync flow

`SyncEngine.syncDailyNotesData()` is the lightweight path introduced in
1.2.0 for the separate Daily Notes auto-sync setting. It deliberately
shares the same source-fetch, detailed-history, token refresh, and
metadata-enrichment code as full sync, then stops before media-note
reconciliation.

Sequence:

1. `ensureValidToken`
2. Fetch enabled Trakt source endpoints into the same
   `Map<"type:traktId", NormalizedItem>` shape used by full sync.
3. If watched detail is enabled, refresh detailed history with the same
   incremental/full-refresh decision logic as full sync.
4. Apply `historyState` to merged items.
5. Enrich metadata through the same TMDB / Trakt translation path as
   full sync.
6. Persist runtime state with `saveSettings()`.
7. Return the merged items to `main.ts`.

It does **not** call `ensureTagNotes`, `scanExistingNotes`, media-note
create/update/delete, filename rename, or frontmatter/body rewrite. The
plugin layer receives the fresh item snapshot and then calls the existing
Daily Notes writers:

- Daily-only timer: `processCatchUp()`
- Manual today command: `processDate(today, "today")`
- Manual backfill button: `manualBackfill(from, to)`

The manual today command and manual backfill button used to render from
`lastMergedItems`; 1.2.0 refreshes source data first so app restarts,
newly enabled Sync sources, and devices with full auto-sync disabled do
not render from stale or empty memory.

## 4. Data structures

### NormalizedItem (in-memory, ephemeral per sync)

The unified shape both movies and shows are converted into for
processing. Built by `baseFromMovie` / `baseFromShow` from raw Trakt
data, then enriched by translations and watch history.

```typescript
interface NormalizedItem {
  type: "movie" | "show";
  title: string;
  year: number;
  ids: TraktIds;
  overview: string;
  genres: string[];
  runtime: number;
  rating: number;
  votes: number;
  certification: string;
  country: string;
  language: string;
  status: string;

  // Movie-only
  tagline?: string;
  released?: string;

  // Show-only
  network?: string;
  aired_episodes?: number;
  first_aired?: string;

  // Set during reconcile
  poster_url?: string;

  // Always populated; equal to title/overview/etc. when localization is off.
  // Tags + tag-note paths use *original* genres for stability across language switches.
  originalTitle: string;
  originalOverview: string;
  originalTagline?: string;
  originalGenres: string[];

  // Source flags — only present when this item came from that source
  watchlist?: boolean;
  watchlist_added_at?: string;
  watched?: boolean;
  plays?: number;
  last_watched_at?: string;
  episodes_watched?: number;
  favorite?: boolean;
  favorited_at?: string;
  my_rating?: number;
  rated_at?: string;

  // Detailed history (populated when syncWatchedDetail is on)
  watch_history_movie?: string[];           // for movies: every watch timestamp
  watch_history_episodes?: EpisodeWatchHistory[];  // for shows: per-episode timestamps
}
```

### TraktrSettings (in-memory session state)

The plugin's complete in-memory state. Loaded once at `onload()`,
mutated in place during the session, written back via `saveSettings()`.
As of 1.1.1 this is intentionally larger than vault-synced
`data.json`: `tmdbCache` and the large portions of `historyState` live
in vault-external local runtime storage and are overlaid into
`this.settings` after synced settings load.

Highlighted new fields in 0.2.0 are marked `[0.2.0]`:

```typescript
interface TraktrSettings {
  // ── Authentication ──
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;

  // ── TMDB ──
  tmdbApiKey: string;
  posterSize: PosterSize;

  // ── Localization ──
  metadataLanguage: string;
  customMetadataLanguage: string;
  uiLanguage: "en" | "zh-CN";
  templateLanguage: string;
  customTemplateLanguage: string;

  // ── Notes ──
  propertyPrefix: string;
  folder: string;
  filenameTemplate: string;
  movieNoteTemplate: string;
  showNoteTemplate: string;

  // ── Tags ──
  addTags: boolean;
  tagPrefix: string;

  // ── Tag notes ──
  addTagNotes: boolean;
  createTagNotes: boolean;
  tagNotesFolder: string;

  // ── Sync sources ──
  syncWatchlist: boolean;
  syncFavorites: boolean;
  syncWatched: boolean;
  syncWatchedDetail: boolean;
  syncRatings: boolean;

  // ── Sync behavior ──
  syncMovies: boolean;
  syncShows: boolean;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  syncOnStartup: boolean;
  overwriteExisting: boolean;
  deleteRemovedItems: boolean;

  // ── Daily Notes ──
  dailyNotesEnabled: boolean;
  dailyNotesFolder: string;
  dailyNotesFilenameFormat: string;
  dailyNotesMarkerStart: string;
  dailyNotesMarkerEnd: string;
  dailyNotesAutoSyncEnabled: boolean;          // default false
  dailyNotesAutoSyncIntervalMinutes: number;   // default 60

  // ── [0.2.0] TMDB cache ──
  tmdbCache: TmdbCache;
  tmdbCacheTtlDays: number;            // default 90; "never" maps to a very large value

  // ── [0.2.0] History state (only meaningful when syncWatchedDetail is on) ──
  historyState: HistoryState;
  historyFullRefreshIntervalDays: number;  // default 7
}
```

### TmdbCache (persistent, [0.2.0])

```typescript
type TmdbCacheKey = string;  // `${type}:${tmdbId}:${language || 'default'}`

interface TmdbCacheEntry {
  cache_version?: number;    // processed TMDB metadata picker version
  poster_url: string;
  translation: TmdbTranslation | null;
  cached_at: number;       // unix ms
  expires_at: number;      // unix ms; cached_at + ttl + jitter
}

interface TmdbCache {
  [key: TmdbCacheKey]: TmdbCacheEntry;
}
```

### HistoryState (persistent, [0.2.0])

```typescript
interface EpisodeWatchHistory {
  season: number;
  episode: number;
  title?: string;
  watched_at: string[];  // ISO-8601, chronologically sorted
}

interface HistoryState {
  byMovie: { [traktMovieId: number]: string[] };
  byShow: { [traktShowId: number]: EpisodeWatchHistory[] };
  knownEventIds: number[];          // every event id we've seen
  lastIncrementalSyncAt: string;    // ISO-8601 timestamp; "" on first run
  lastFullRefreshAt: string;        // ISO-8601 timestamp; "" on first run
  lastDailyNoteSyncedAt: string;    // small synced Daily Notes cursor
  lastAuthoritativeFullRefreshAt?: string; // small synced runtime coordinator
  lastReleaseNoticeVersion?: string;
}
```

## 5. Caching layers

As of 1.1.1, cache architecture is split by sync semantics.

### Vault-synced settings (`data.json`)

`.obsidian/plugins/sync-trakt/data.json` stores small cross-device state:
auth tokens, API keys, templates, folders, source toggles, language
settings, and small coordination fields. It deliberately does not store
large runtime cache contents. `saveSettings()` writes a slim payload and
skips `saveData()` entirely when that slim payload has not changed.

The synced `historyState` keeps empty aggregate placeholders plus small
fields such as `lastDailyNoteSyncedAt`, `lastReleaseNoticeVersion`, and
`lastAuthoritativeFullRefreshAt`.

### Local runtime cache

`src/runtime-store.ts` stores rebuildable runtime data outside the vault:

- `tmdbCache`
- `historyState.byMovie`
- `historyState.byShow`
- `historyState.knownEventIds`
- local history incremental/full-refresh cursors

The primary backend is IndexedDB, keyed by plugin id plus vault name.
IndexedDB persists across normal app restarts on desktop and mobile, but
because it lives in Obsidian's application data sandbox rather than the
vault, Obsidian Sync does not upload it and the 5 MB per-file Sync
Standard limit does not apply. If IndexedDB is unavailable, the plugin
falls back to Obsidian's localStorage API.

Each device builds and maintains its own runtime cache. Multi-device
compatibility comes from syncing the small settings layer and the final
Markdown notes, plus a small `lastAuthoritativeFullRefreshAt`
coordinator: when one device detects Trakt-side history deletions during
a full refresh, other devices force their own full refresh before writing
from older local caches.

Two independent caches with different concerns and lifetimes.

### TMDB metadata cache (Phase A)

- **Stored in**: `settings.tmdbCache`
- **Keyed by**: `(type, tmdb_id, effective_language)`
- **Lifetime**: `settings.tmdbCacheTtlDays` (default 90) ± 5 days
  jitter
- **Eviction**: lazy revalidation — stale entries are returned and
  refreshed in the background; failed background fetches preserve the
  stale entry
- **Manual control**: `Settings → TMDB → Clear cache` button
- **Picker-version safety**: processed cache entries carry a
  `cache_version`. Entries produced by older title-picking logic are
  treated as cache misses and refetched synchronously, even if their TTL
  has not expired.

### History state (Phase C)

- **Stored in**: `settings.historyState`
- **Lifetime**: persistent until manually cleared. Re-seeded on full
  refresh
- **Refresh schedule**:
  - Every sync: incremental fetch with `start_at = lastIncrementalSyncAt`
  - Every `historyFullRefreshIntervalDays` (default 7): full re-fetch,
    detect deletions, rebuild state if needed
- **Manual control**:
  - Command **Force full history refresh** (bypasses interval)
  - Settings → History → Clear history state (drops everything; next
    sync re-pulls full history)

## 6. API mapping

### Trakt endpoints used

| Endpoint | When called | Purpose |
|---|---|---|
| `POST /oauth/device/code` | User clicks Connect | Start device flow |
| `POST /oauth/device/token` | Polling during Connect | Get access token |
| `POST /oauth/token` | `ensureValidToken` if within 1h of expiry | Refresh access token |
| `GET /sync/watchlist/{type}` | Sync, if `syncWatchlist` | Items user wants to watch |
| `GET /sync/watched/{type}` | Sync, if `syncWatched` | Items + plays + last-watched per show/movie |
| `GET /sync/favorites/{type}` | Sync, if `syncFavorites` | Items the user marked as favorites |
| `GET /sync/ratings/{type}` | Sync, if `syncRatings` | Items with user ratings 1-10 |
| `GET /sync/history/{type}` | Sync, if `syncWatchedDetail` | Per-watch event log; with `start_at` for incremental |
| `GET /movies/{id}/translations/{lang}` | TMDB-key-less localization fallback | Localized title/overview/tagline (no genres) |

All authenticated calls send `trakt-api-key: clientId` and
`Authorization: Bearer accessToken` headers.

For which setting or command calls each endpoint, see
[`SYNC-ARCHITECTURE.md`](SYNC-ARCHITECTURE.md#source-toggle-matrix).

### TMDB endpoints used

| Endpoint | When called | Purpose |
|---|---|---|
| `GET /3/movie/{id}?language=X&append_to_response=translations` | Sync, on cache miss | Movie metadata + all translations in one call |
| `GET /3/tv/{id}?language=X&append_to_response=translations` | Sync, on cache miss | Show metadata + all translations |
| Same as above without `language` | Poster fallback | When localized response had `poster_path: null` |

`api_key` query parameter is the v3 auth method. The combined call with
`append_to_response=translations` is the workaround for TMDB's "title
locked blank for zh-CN" quirk; see [spec 0001](specs/0001-incremental-sync.md)
for context.

## 7. Concurrency model

Three concurrency choices in the sync flow:

1. **Within a type (movie/show), Trakt list fetches run in parallel.**
   `Promise.all` over watchlist/watched/favorites/ratings. Each is
   independent.

2. **Movie type and show type run in parallel.** `fetchAndMergeMovies`
   and `fetchAndMergeShows` are dispatched together from `sync()`.

3. **Detailed history runs as a separate stage.** Movie and episode
   history fetches run in parallel when `syncWatchedDetail` is enabled.
   They update `historyState`, seed history-only items into `merged`, and
   then hydrate detailed watch-history fields onto merged items.

4. **TMDB metadata fetch is bounded-concurrency, 5 in flight.** Uses
   `processWithConcurrency` from utils. This:
   - Keeps below TMDB's documented 50 req/s rate limit
   - Allows progress reporting during the loop (status bar / Notice)
   - Doesn't try to pretend a 1200-item burst is OK

Full sync and Daily Notes-only sync share one `SyncEngine.syncing` lock.
If the full sync button, full auto-sync timer, Daily Notes command, and
Daily Notes auto-sync timer collide, the first run owns the lock and the
later run exits with the existing "already syncing" notice. This avoids
concurrent writers to `historyState`, TMDB runtime cache, Daily Note
marker regions, and media-note files.

The numbers (5 for TMDB, no cap on Trakt — those are sequential within
a paginated call) are tuned for safety, not maximum throughput. With the
0.2.0 cache, most syncs make ≤10 TMDB calls anyway, so the cap is
mostly a guardrail for the cold-start sync.

## 8. Error handling philosophy

The plugin operates on a "best effort, never lose user data" principle:

- **Network failures during TMDB fetch**: log to console, return
  `{ poster_url: "", translation: null }`. The note still gets created /
  updated, just without poster / translation. User notices visually,
  retries on next sync.
- **TMDB cache stale + revalidation fails**: the stale entry is
  preserved. The user keeps seeing the old data. Eventual recovery on
  the next successful revalidation.
- **Trakt API 429 (rate limit)**: thrown as `TraktApiError` with
  `isRetryable=true`; sync aborts the current item but the surrounding
  loop continues. Sync result reports the failure count; user retries.
- **Trakt API 401 (auth expired)**: token refresh is attempted before
  every sync. If refresh fails, tokens are cleared and a notice tells
  the user to reconnect.
- **`processFrontMatter` failure for one note**: caught at the per-item
  level in `reconcileType`, recorded in `result.errors`, sync continues
  on remaining items.

Errors are aggregated into the final sync notice rather than popping up
mid-sync. The persistent progress Notice gives users a "yes, work is
happening" signal even when individual items fail.

## 9. i18n architecture

Three independent localization axes:

| Axis | Setting | Languages | Effect |
|---|---|---|---|
| **Plugin runtime UI** | `uiLanguage` | en, zh-CN | Settings tab, command palette names, notice text, auth modal |
| **Note metadata language** | `metadataLanguage` (+ custom) | full BCP-47 list | Translates frontmatter title/overview/tagline/genres via TMDB |
| **Default note template language** | `templateLanguage` (+ custom) | full BCP-47 list | Picks bundled English / Simplified / Traditional Chinese template; other codes fall back to English |

The runtime UI strings are stored in `src/i18n.ts` as a flat key →
`{ en, "zh-CN" }` map. `getTranslator(lang)` returns a curried `t(key, vars?)`
that interpolates `{var}` placeholders.

Bundled templates live in `src/settings.ts` as `DEFAULT_*_TEMPLATE_*`
constants. `getDefaultMovieTemplate(lang)` and
`getDefaultShowTemplate(lang)` resolve a BCP-47 code to one of the
bundled templates, with English as the fallback.

User-facing docs (README, SETUP, MANUAL) are translated as separate
markdown files under `docs/i18n/`. The translation matrix is
documented at `docs/i18n/index.md`.

## 10. Settings persistence + cross-device sync

`data.json` lives at
`<vault>/.obsidian/plugins/obsidian-sync-trakt/data.json`. It is
written via Obsidian's `saveData()` and loaded via `loadData()`.
Both are JSON; no encryption.

Cross-device sync is delegated entirely to the user's vault sync layer:

- **Obsidian Sync**: requires "Plugin data" toggle in Selective sync
- **iCloud Drive**: syncs the full vault automatically; works with
  Advanced Data Protection for E2E
- **Syncthing**: device-to-device, no cloud
- **Cryptomator + any cloud**: user holds keys, end-to-end

The plugin reads `data.json` once at `onload()`. To pick up changes
that arrived via vault sync after the plugin loaded, **0.2.0 added a
`visibilitychange` listener that re-reads `data.json` when Obsidian
becomes visible again** (e.g. user switches back from another app).
Re-read is in-place: `this.settings` keeps object identity so
`SyncEngine`'s reference stays valid. After re-reading settings, both
auto-sync timers are reconfigured so a token or setting arriving from
another device starts or stops local scheduling correctly.

The default device-local keys are `syncOnStartup`, `autoSyncEnabled`,
`autoSyncIntervalMinutes`, `dailyNotesAutoSyncEnabled`, and
`dailyNotesAutoSyncIntervalMinutes`. `uiLanguage` is eligible for the
same cloud-toggle override but defaults to synced. This lets a Mac run
full sync and Daily Notes-only sync on different intervals while iOS
keeps both timers off, without forking the shared source toggles or note
rendering settings.

## 11. Note rendering pipeline

Three distinct rendering modes:

### A. Note creation (new item)

```
buildFrontmatterData(item, settings)  →  frontmatter object
buildTemplateContext(item, settings)  →  template variable map
renderTemplate(template, context)      →  body string
toFrontmatter(frontmatter)             →  YAML string
final = `---\n${yaml}\n---\n${body}`
vault.create(path, final)
```

`{{watch_history}}` template variable resolves to a marker-wrapped
section (or empty when no detail data).

### B. Note update — frontmatter only (default)

```
processFrontMatter(file, fm => {
  for each new field: fm[key] = newValue
  for each removed field: delete fm[key]
})
```

Body is preserved completely.

If `syncWatchedDetail` is on, additionally:

```
vault.process(file, oldContent => updateManagedBodySections(oldContent, item, settings))
```

`updateManagedBodySections` finds `%% trakt:watch-history:start %%` …
`%% trakt:watch-history:end %%` markers and replaces what's between
them. Content outside markers is untouched. If markers don't exist
(legacy note from before 0.1.1), the section is appended to the end of
the body — a one-time migration that takes effect on the first sync
after upgrading.

### C. Note update — full overwrite (when `overwriteExisting`)

```
vault.process(file, () => renderNote(item, settings))
```

User-edited body content is lost. Only useful for batch template
updates; not the default.

## 12. Testing approach

### What's tested

`tests/i18n.smoke.ts` is a single executable file that runs against
stubbed Obsidian APIs (`tests/stub-obsidian.ts`). It uses no test
framework — assertions are inline `assertEq` / `assertTrue` /
`assertContains` helpers and a final pass/fail summary.

Coverage prioritizes:

- Pure data transformations (renderers, picker functions, aggregators)
- API response parsing (TMDB shape, Trakt shape)
- Settings derivation helpers
- Backward compatibility (e.g. byte-identical output with localization
  disabled)

Skipped:

- Real Obsidian vault interactions (would require integration tests in
  Obsidian itself)
- Real network calls to Trakt / TMDB (require credentials; flaky)
- Visual UI behavior (requires E2E browser harness — overkill)

### How to run

```bash
npm run test:i18n
```

This bundles `tests/i18n.smoke.ts` with esbuild (aliasing the `obsidian`
import to the stub) and runs the resulting CommonJS file under Node.

### Adding tests

Tests are organized in numbered sections (`[1]`, `[2]`, …) by feature
area. Add a new section at the bottom rather than splitting fixtures
across helpers — keep tests readable as straight-line scripts.

For async tests (e.g. `processWithConcurrency`), wrap in an async IIFE
at the bottom of the file. CommonJS bundling rejects top-level await.
