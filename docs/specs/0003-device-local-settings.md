# 0003 — Device-local settings (per-setting sync toggle)

- **Status**: implemented
- **Released in**: 0.5.0
- **Date**: 2026-05-10
- **Authors**: @o1xhack, Claude
- **Builds on**: [0001-incremental-sync](0001-incremental-sync.md), [0002-diff-based-write](0002-diff-based-write.md)

## Context

By 0.3.0, the whole plugin state — auth tokens, TMDB cache, history state,
all behavioral settings, all UI preferences — lives in a single `data.json`
that follows Obsidian Sync (when "Plugin data" sync is enabled) or any
other vault-sync layer. That's the right default for most things: a user
with Mac + iPhone wants a single canonical Trakt token, a single canonical
metadata-language preference, a single canonical sync folder.

But a small number of settings are **inherently device-local**, and
forcing them to sync creates real problems:

- **`syncOnStartup`** — if both Mac and iPhone have this on, both fire a
  sync within 5 seconds of launch. Each independently hits Trakt + TMDB,
  each writes to `data.json`, Obsidian Sync sees two competing versions
  and has to pick one. Wasted API calls, possible note-file conflicts.
- **`autoSyncEnabled` + `autoSyncIntervalMinutes`** — same shape: both
  devices fire their auto-sync timer independently, possibly within
  seconds of each other.
- **`uiLanguage`** — different humans use the same vault from different
  devices, or one human reads in different languages in different
  contexts. Forcing both Mac and iPhone to the same UI language is a
  cosmetic loss but a real one.

The 0.2.x and 0.3.0 architecture has made these conflicts **less harmful**
than they used to be (idempotent cache writes, idempotent history merge,
diff-based note writes mean far fewer .md file conflicts), but the
**redundant API traffic** and the **cosmetic stickiness** of cross-device
UI language remain.

## Goals / Non-goals

### Goals

- Users can mark specific settings as **device-local** — they live only
  on the device where they were set, are never written to `data.json`,
  and are not affected by Obsidian Sync
- The control surface is **discoverable**: a small cloud icon next to
  each eligible setting, click to toggle, hover for tooltip. Pattern
  borrowed from Notebook Navigator, Style Settings, and others
- Upgrading from 0.3.x is **transparent**: existing values are preserved,
  no manual migration steps. The four settings listed in §"Initial
  scope" automatically become device-local on first launch of the
  new version, with their current value seeded from the synced state
- Switching a setting from synced ↔ local **doesn't lose its value**:
  on toggle, the current value moves from one storage layer to the
  other; the user doesn't have to re-enter anything

### Non-goals

- **Full Notebook-Navigator-style per-setting cloud icon on every
  setting.** Most settings (auth tokens, cache, history state, content
  behavior, template content, folder paths, propertyPrefix, …) should
  always sync — making them togglable would just confuse users without
  benefit. This spec covers the **small, principled scope** where local
  semantics actually make sense
- **A "sync this whole section" group toggle.** Per-key only; sections
  are visual grouping in UI, not in storage
- **Cross-device-aware conflict resolution.** If both devices write
  conflicting non-local settings, Obsidian Sync's existing behavior
  applies (last-write-wins via mtime). This spec doesn't change that
- **Selective syncing of cache state.** TMDB cache and history state
  benefit from cross-device sharing (the user spent the API budget
  once on Mac, iPhone should reap the benefit). They stay synced
- **Encryption of local settings.** They're stored in `localStorage` in
  plaintext, same trust boundary as `data.json` on disk

## Design

Three pieces: storage split, setting metadata + access layer, UI affordance.

### Part A — Storage split

Synced settings continue to live in `data.json` (no change).
Device-local settings live in **Obsidian's `localStorage`**, accessed
via `app.loadLocalStorage(key)` / `app.saveLocalStorage(key, value)`.

`localStorage` is the standard way Obsidian plugins persist per-device
state. It's stored outside the vault (in the Obsidian app's data
directory on each device), so it's never seen by any vault-sync layer.
Notebook Navigator, Style Settings, and various other community plugins
use this same mechanism for local-only state.

The key namespace is the plugin id:

```
key = `obsidian-sync-trakt:${settingKey}`
e.g. obsidian-sync-trakt:syncOnStartup
```

### Part B — Setting metadata + access layer

A new top-level structure declares which keys are eligible for the
local/synced toggle, and what each device's current choice is:

```typescript
// In data.json
{
  ...existingSettings,
  // List of keys the user has chosen to make device-local on THIS device.
  // The list itself is device-local — stored in localStorage too, not in
  // data.json — so different devices can have different choices.
  // Stored at `obsidian-sync-trakt:_localKeys` = string[]
}
```

Note the subtle but important detail: **the "which keys are local"
metadata is itself device-local**. If it lived in `data.json`, then
choosing "make `uiLanguage` local on iPhone" would propagate to Mac,
defeating the whole point. Each device independently records its own
toggle state in its own localStorage.

The plugin gains a thin access layer in `src/settings.ts`:

```typescript
class SettingsStore {
  // The synced layer — what's in data.json
  private synced: TraktrSettings;
  // The set of keys the user has marked local on THIS device
  private localKeys: Set<keyof TraktrSettings>;

  get<K extends keyof TraktrSettings>(key: K): TraktrSettings[K] {
    if (this.localKeys.has(key)) {
      const raw = this.app.loadLocalStorage(`obsidian-sync-trakt:${key}`);
      if (raw === null) return DEFAULT_SETTINGS[key];
      try { return JSON.parse(raw); } catch { return DEFAULT_SETTINGS[key]; }
    }
    return this.synced[key];
  }

  async set<K extends keyof TraktrSettings>(key: K, value: TraktrSettings[K]) {
    if (this.localKeys.has(key)) {
      this.app.saveLocalStorage(
        `obsidian-sync-trakt:${key}`,
        JSON.stringify(value),
      );
    } else {
      (this.synced as any)[key] = value;
      await this.plugin.saveData(this.synced);
    }
  }

  async setKeyIsLocal(key: keyof TraktrSettings, local: boolean) {
    const currentValue = this.get(key);
    if (local) {
      this.localKeys.add(key);
      this.app.saveLocalStorage(
        `obsidian-sync-trakt:${key}`,
        JSON.stringify(currentValue),
      );
      delete (this.synced as any)[key];
    } else {
      this.localKeys.delete(key);
      (this.synced as any)[key] = currentValue;
      this.app.saveLocalStorage(`obsidian-sync-trakt:${key}`, null);
    }
    this.app.saveLocalStorage(
      "obsidian-sync-trakt:_localKeys",
      JSON.stringify([...this.localKeys]),
    );
    await this.plugin.saveData(this.synced);
  }
}
```

All settings reads in the codebase that currently do `this.settings.foo`
become `this.settings.get("foo")` or — if we'd rather keep ergonomic
syntax — we wrap them with a getter Proxy. Both approaches are
viable; pick during implementation.

### Part C — UI affordance

In the settings tab, each eligible setting gets a small cloud icon to
the right of its control. Two visual states:

- **Cloud filled (synced)**: the setting is in `data.json` and follows
  Obsidian Sync. Tooltip: *"This setting is synced across devices.
  Click to make it device-local."*
- **Cloud crossed-out (local)**: the setting is in localStorage on
  this device only. Tooltip: *"This setting is local to this device.
  Click to sync across devices."*

Clicking the icon calls `setKeyIsLocal()` with the inverted state and
re-renders the affected Setting row.

Only settings declared in the ELIGIBLE_FOR_LOCAL list (see Initial
scope below) render the icon. Everything else displays normally with
no icon — the toggle simply isn't offered for those.

Icon implementation: Obsidian ships Lucide icons; use `cloud` for
synced and `cloud-off` for local. Both available out-of-the-box via
`setIcon(el, "cloud")`.

### Initial scope — which settings get the toggle

Conservative whitelist for 0.4.0. These are the keys whose semantic
makes them genuine candidates for device-local override:

| Key | Default state | Rationale |
|---|---|---|
| `syncOnStartup` | **local** | The classic problem: both devices firing on launch produces redundant syncs |
| `autoSyncEnabled` | **local** | Same shape — device chooses if it wants to auto-sync |
| `autoSyncIntervalMinutes` | **local** | Different cadences make sense per device (Mac every 30min, iPhone manual) |
| `uiLanguage` | **synced** (default) but toggleable | Most users want the same UI language across devices; a sizable minority want different |

The first three default to **local** because the conflict cost of
syncing them outweighs any benefit, and the 0.3.x default behavior was
"settings sync everywhere" which already caused the problem we're
solving. The fourth defaults to synced because it's a personal
preference where syncing is usually right.

Everything else (auth tokens, all `sync*` toggles, `metadataLanguage`,
templates, folders, prefixes, TMDB cache, history state, etc.) stays
synced with no icon — making them togglable would be feature creep.

### Migration (0.3.x → 0.4.0)

On first launch of 0.4.0:

```
loadSettings():
  synced = await loadData()  // existing 0.3.x data.json
  localKeys = loadLocalStorage("obsidian-sync-trakt:_localKeys")
  if localKeys === null:
    // First launch on 0.4.0. Seed initial local keys per Initial scope.
    initialLocal = ["syncOnStartup", "autoSyncEnabled", "autoSyncIntervalMinutes"]
    for k in initialLocal:
      if k in synced:
        // Move the value from data.json to localStorage
        saveLocalStorage(`obsidian-sync-trakt:${k}`, JSON.stringify(synced[k]))
        delete synced[k]
    saveLocalStorage("obsidian-sync-trakt:_localKeys", JSON.stringify(initialLocal))
    await saveData(synced)
  ...
```

Effects:
- **Same device that ran 0.3.x**: the three auto-sync-related fields
  move from `data.json` to `localStorage`. The user's current values
  are preserved. From the user's POV nothing changes — auto-sync still
  on with the same interval.
- **Other devices**: when 0.4.0 first runs there, it sees those keys
  *missing* from `data.json` (because the first device deleted them on
  its migration). The migration code on the other device sees no values
  to preserve, falls back to `DEFAULT_SETTINGS`. The user has to
  re-enable auto-sync on each device. **This is annoying, and it's the
  cost of opting into the simpler model.** Worth flagging in the
  release notes.
- **`uiLanguage`** stays synced for everyone by default; users who
  want it local click the cloud icon on whichever device.

An alternative migration: leave existing values in `data.json` and only
make NEW writes go to localStorage. Cleaner backward compat but adds a
"this value is in two places, which wins" hazard. The migration above
is simpler and the cost (re-enable auto-sync on N-1 devices) is one-time.

## Edge cases

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | User toggles `syncOnStartup` to local on Mac, then later toggles back to synced | Mac reads current value from localStorage (e.g. `true`), writes to `data.json`, removes localStorage entry, removes from `localKeys`. Next data.json sync propagates `syncOnStartup: true` to iPhone |
| 2 | iPhone has never seen 0.4.0; Mac upgrades to 0.4.0 and edits `data.json` | iPhone is still on 0.3.x: sees `syncOnStartup` is missing from data.json (Mac removed it during migration). 0.3.x's `loadSettings()` calls `Object.assign(this.settings, DEFAULT_SETTINGS, loaded)` → fills in `syncOnStartup: false`. iPhone's old (pre-upgrade) sync behavior is silently lost. **Acceptable but worth release-noting** — recommend upgrading all devices around the same time |
| 3 | User clears the plugin's `data.json` (e.g. to reset everything) | localStorage values persist independently. User may see "I reset the plugin but auto-sync still on" — confusing. Mitigation: the "Reset all settings" button (if added) should also clear localStorage |
| 4 | User uninstalls + reinstalls the plugin | Obsidian preserves `localStorage` across plugin reinstalls (it's keyed by Obsidian vault, not by plugin install state). So local settings survive. May or may not be desirable — document |
| 5 | User has 0.4.0 on Mac, fresh install on a new Linux machine | Linux gets DEFAULT_SETTINGS for the local keys (since localStorage on Linux is empty). User reconfigures auto-sync there. Same as adding any new device today |
| 6 | `loadLocalStorage` returns malformed JSON | `JSON.parse` throws → fall back to DEFAULT_SETTINGS[key]. Logged to console. No crash |
| 7 | Two devices toggle the same key's local-vs-synced state in opposite directions during the same Obsidian Sync window | localKeys is device-local, no cross-device conflict on this metadata. Each device's choice sticks for that device. Value field in data.json may have one extra last-write-wins moment for the device that toggled "back to synced" — minor, recoverable |
| 8 | A future plugin version renames a setting (e.g. `syncOnStartup` → `syncWhenLaunched`) | Migration code must also rewrite the localStorage key. Out of scope here but document the pattern: any rename of a setting that's in the ELIGIBLE_FOR_LOCAL list requires a localStorage migration too |

## Tests

Adds to `tests/i18n.smoke.ts`:

- `SettingsStore.get(localKey)` returns localStorage value when key is in `localKeys`
- `SettingsStore.get(syncedKey)` returns synced value otherwise
- `setKeyIsLocal(key, true)` moves value from synced to local; doesn't lose value
- `setKeyIsLocal(key, false)` moves value from local to synced; doesn't lose value
- Migration from 0.3.x: synced has `syncOnStartup: true`, no `_localKeys` in localStorage → after migration, `syncOnStartup` is in localStorage and removed from synced
- Re-migration is idempotent: second `loadSettings()` after migration doesn't re-move keys

For UI, manual testing only (covered by existing manual-test checklist in
release verification).

## Alternatives considered

### Single global "device-local mode" toggle

A single setting "Treat sync-behavior settings as device-local" that
flips all four at once. **Rejected** because:

- It's a strictly worse UX than the per-key icon (less discoverable,
  less granular)
- It still needs the underlying two-layer storage; the savings are
  only in UI complexity (~50 LOC), not architecture

### Separate file `data-local.json` (not in vault)

Instead of `localStorage`, put device-local values in a file outside
the vault directory. **Rejected** because:

- Obsidian doesn't expose a clean API to write outside the vault — would
  need to use Node.js `fs` directly (breaks mobile compatibility, since
  iOS has no node)
- `localStorage` is the documented, cross-platform mechanism for
  per-device state and is already used by major community plugins

### Mark settings as local via setting-key prefix

E.g. `_local_syncOnStartup` in `data.json`. Obsidian Sync still syncs
the whole file. **Rejected** because:

- Doesn't actually achieve the goal (those keys would still propagate
  cross-device via the synced data.json)
- Just renaming a synced field doesn't make it local

### Use Obsidian's per-device-id mechanism

Some apps namespace settings by a machine-generated device id stored
in localStorage, then store per-device values inside `data.json` under
that namespace. **Rejected** because:

- `data.json` size grows linearly with number of devices the user has
  ever used
- Stale device entries never cleaned up
- More complex than just using localStorage

## Implementation surface (estimate)

| File | Change |
|---|---|
| `src/settings.ts` | New `SettingsStore` class wrapping data.json + localStorage; ELIGIBLE_FOR_LOCAL list; migration code in loadSettings |
| `src/settings-tab.ts` (or wherever Settings renders) | Cloud-icon component, click handler, conditional rendering per ELIGIBLE_FOR_LOCAL |
| `src/main.ts` | Thread SettingsStore through to SyncEngine and AuthModal in place of raw settings object |
| `src/sync-engine.ts` | Read auto-sync-related fields via store (instead of `this.settings.autoSyncEnabled` etc.) |
| `src/i18n.ts` | Tooltip strings for cloud icon (en + zh-CN) — 2 keys × 2 langs = 4 entries |
| `tests/i18n.smoke.ts` | 6-8 new cases (see Tests section) |
| `docs/CHANGELOG.md` | 0.4.0 entry with migration callout |
| `docs/MANUAL.md` + 3 translations | Document the cloud-icon convention + the four eligible settings |
| `docs/specs/0003-device-local-settings.md` | This file (status → implemented) |
| `manifest.json` + `package.json` + `versions.json` | Bump |

Total estimate: ~400-600 LOC including tests and minor refactors.
Roughly the size of 0.3.0.

## Decision points to revisit at implementation time

These were left intentionally open in this draft and should be
re-evaluated when 0.4.0 work begins, since 0.3.0's deployment may
change the picture:

1. **Is `localStorage` accessible reliably on mobile?** Obsidian docs
   say yes, but verify with a quick smoke test on iOS before committing.
   If it doesn't work, fall back to a sidecar JSON file in
   `.obsidian/plugins/<id>/local.json` and educate users that this file
   must NOT be checked in or synced (Obsidian Sync excludes anything
   not in `data.json` for plugins? confirm)
2. **Default-local list might shrink**. If 0.3.0's diff-based write
   eliminates the cross-device conflict story enough in practice, users
   may not feel the need for `syncOnStartup` to be local. Re-survey
   personal experience and any user reports before committing the
   default-local migration
3. **Whether to add a "Reset all settings" button** that also clears
   localStorage — touched on in edge case 3 but not designed here
4. **Naming of the toggle visual state** — should it be "cloud" /
   "cloud-off"? Or something more obvious like "device" / "cloud"?
   Notebook Navigator uses a cloud-only-when-synced approach. Pick by
   experimenting in the actual UI
5. **Hover vs click affordance** on mobile. Cloud icon click is fine,
   but tooltip on hover doesn't translate to touch. Tap-to-show-info
   pattern needs design — possibly use Obsidian's existing description
   text mechanism

## Out of scope (future work for a separate spec)

- **Per-vault settings overrides** — useful if a user wants different
  defaults in their "work" vault vs "personal" vault. Obsidian's
  per-vault data.json already handles this; no plugin work needed
- **Settings profiles** — "weekend mode" / "vacation mode" presets.
  Niche; mention in roadmap if there's interest
- **Cloud-icon convention extending to more keys** — once the
  infrastructure exists, low cost to enable more. Wait for user
  feedback before expanding the list

## Open questions

- Should we expose the `localKeys` list anywhere as a developer-debug
  affordance? (E.g. a console command that prints the current
  classification.) Mild yes — useful for support
- Should the cloud icon be present but disabled on settings that aren't
  in ELIGIBLE_FOR_LOCAL, to communicate "yes the concept exists but
  this particular setting can't be local"? Probably no — clutter

---

**This is a draft spec.** Re-investigate the questions in "Decision
points to revisit" before starting implementation, since the landscape
may shift after 0.3.0 has been in real use for a while.
