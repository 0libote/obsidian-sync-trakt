# Changelog

Notable changes per release. The plugin follows [semver](https://semver.org/)
loosely — `0.x.y` is the pre-stable iteration line; the major bump to
`1.0.0` will land once the feature set is verified end-to-end and the
plugin is submitted to Obsidian's official Community Plugins directory.

For the full design rationale behind major changes, see [`specs/`](specs/).

## 1.3.0 — 2026-05-21

**Smarter media-note writes.** This release reduces Obsidian Sync version
history churn for large Trakt libraries.

### Added

- New **Community rating/votes update policy** setting under
  **Settings -> Sync -> Sync behavior**.
- `Every sync` keeps the old behavior for users who want every Trakt
  community rating/vote change written immediately.
- `Smart` writes `trakt_rating` and `trakt_votes` only when the configured
  minimum interval has elapsed, or when the absolute rating/vote change
  reaches the user's thresholds.
- Smart mode records `trakt_community_stats_synced_at` when community
  stats are actually written. Older notes fall back to `trakt_synced_at`
  for the initial timing baseline so upgrades do not immediately rewrite
  the whole library.

### Fixed

- Media-note sync now performs a final no-op guard before writing. If a
  temporary Obsidian frontmatter-cache miss would only refresh
  `trakt_synced_at`, the plugin skips the write instead of creating a
  timestamp-only Obsidian Sync history version.

## 1.2.1 — 2026-05-20

**Daily Notes sync boundary fixes.** This release keeps full sync and
Daily Notes-only sync separate, while making their source-data behavior
consistent.

### Fixed

- Manual Daily Notes backfill now refreshes the enabled Sync sources before
  rendering the selected date range, so watchlist/favorites/ratings events
  follow the current source toggles instead of a stale in-memory snapshot.
- Detailed watch-history-only items, such as season 0 specials that appear
  in Trakt history but not in watched shows, can now create or update media
  notes and appear in Daily Notes.
- Older local history caches with orphaned detailed-history entries are now
  repaired automatically with one full history refresh when needed.

### Documentation

- Added [`SYNC-ARCHITECTURE.md`](SYNC-ARCHITECTURE.md), a sync architecture
  and control matrix that documents what each source toggle, sync button,
  timer, Daily Notes-only sync, and manual backfill writes or deliberately
  skips.
- Clarified that Daily Notes-only sync and manual backfill refresh
  Trakt/TMDB data but do not create, rename, delete, or rewrite media notes.

## 1.2.0 — 2026-05-17

**Daily Notes-only auto-sync.** Daily Notes can now refresh on their own
timer without running the full media-note reconciliation pipeline.

### Added

- A separate **Daily Notes auto-sync** toggle and interval in the Daily
  Notes settings tab. Both settings are device-local by default.
- `SyncEngine.syncDailyNotesData()`, a lightweight data-refresh path that
  shares full sync's Trakt source fetches, detailed-history refresh,
  token refresh, TMDB / Trakt metadata localization, runtime-cache save,
  and shared sync lock, but skips media-note create/update/delete/rename.
- Spec [0011](specs/0011-daily-notes-auto-sync.md), documenting the API
  research, multi-device model, timer interactions, scenario matrix, and
  rejected alternatives.
- Smoke coverage for the new settings, i18n labels, shared lock behavior,
  and the multi-device detailed-history full-refresh coordinator.

### Changed

- The command **Sync to daily notes (today only)** now refreshes Trakt
  source data before rendering today's Daily Note. It no longer depends
  on the previous in-memory `lastMergedItems` snapshot after app restart.
- Trakt auth success, disconnect, and visibility-triggered settings
  reloads now reconfigure both the full auto-sync timer and the Daily
  Notes-only timer.
- The Daily Notes auto-sync label now says that it updates Daily Notes
  without media-note sync, and its description explicitly says it can be
  enabled together with full Auto-sync.
- Full sync now folds the Daily Notes catch-up result into the full sync
  completion notice instead of showing two separate final notices.
- Architecture, manual, and README docs now explain the split between
  vault-synced settings, local runtime caches, full auto-sync, and
  Daily Notes-only auto-sync.

### Fixed

- Existing installs that already had a `_localKeys` list now migrate the
  two new Daily Notes timer settings to device-local defaults. Without
  this, upgrades could show the cloud icon as synced even though new
  installs were local by default.
- Daily Notes-only auto-sync no longer rewrites today's Daily Note or
  shows an "updated" notice when the rendered marker block is unchanged.

### Compatibility

- Existing behavior is unchanged unless the user explicitly enables
  Daily Notes-only auto-sync. Full sync still updates Daily Notes at the
  end when Daily Notes integration is enabled.
- The Daily-only path keeps multi-device safety by using the same
  `SyncEngine.syncing` lock and the same 1.1.x
  `lastAuthoritativeFullRefreshAt` coordinator for local runtime history
  caches.

## 1.1.2 — 2026-05-17

**TMDB cache invalidation bugfix.** Users who already updated to 1.1.1
need a real version bump so Obsidian and GitHub can deliver the fix.

### Fixed

- TMDB metadata cache entries produced by older title-picking logic are
  now treated as cache misses and refetched synchronously, even if their
  TTL has not expired. This prevents stale runtime cache from keeping
  Daily Notes or media-note filenames stuck on an old English or
  wrong-locale title after upgrading.

## 1.1.1 — 2026-05-17

**Local runtime cache storage + strict metadata safety.** Reworked cache
persistence so Obsidian Sync Standard's 5 MB single-file limit no longer
applies to large rebuildable runtime data, and tightened the 0.9.x
strict metadata fallback rules so locale variants do not silently
substitute for one another.

### Added

- `src/runtime-store.ts`, a vault-external runtime cache layer using
  IndexedDB first and Obsidian localStorage as fallback.
- Spec [0010](specs/0010-local-runtime-cache.md), documenting the
  storage split, migration, and multi-device behavior.
- Tests for slim synced history payloads, runtime-data detection,
  synced/local history-field merge behavior, and RuntimeStore fallback
  persistence.
- A Sync-tab dedupe maintenance action that scans current notes by
  `trakt_type + trakt_id`, keeps the note matching the current filename
  template, and moves duplicate copies to Obsidian trash.
- Second-confirmation dialogs for destructive maintenance actions:
  disconnecting Trakt, clearing TMDB cache, clearing detailed history
  state, deduplicating notes, and restoring defaults.

### Changed

- `data.json` now keeps only small cross-device settings and
  coordination fields. Large `tmdbCache` and detailed-history aggregate
  data move to local runtime storage.
- Existing large `data.json` payloads are migrated automatically on
  first 1.1.1 launch: runtime data is seeded locally, then `data.json`
  is rewritten as a slim synced payload.
- `saveSettings()` now skips Obsidian `saveData()` when the slim synced
  payload is unchanged, reducing version-history churn from frequent
  auto-sync runs.
- Detailed-history full refreshes now update a small synced
  `lastAuthoritativeFullRefreshAt` coordinator so other devices force
  a local full refresh before writing from stale history caches.
- Same-ID collision handling now checks the collided note's frontmatter
  before creating a fallback filename, preventing duplicate notes during
  Obsidian Sync download races.
- Strict TMDB metadata fallback now keeps `zh-CN`, `zh-TW` / `zh-HK`,
  Japanese, Korean, and configured fallback languages separate. TMDB
  top-level original-language titles are used only when compatible with
  the user's metadata locale; Simplified and Traditional Chinese are not
  treated as interchangeable.
- TMDB metadata cache entries produced by older title-picking logic are
  refetched automatically, so a still-fresh runtime cache cannot keep
  Daily Notes or media notes stuck on an old English / wrong-locale title.
- The Daily Notes marker warning in settings is now a gentler inline
  warning instead of a large red block.

### Migration

No manual action required. Each device keeps its own local runtime
cache. If that cache is absent or cleared by the platform, the next
sync rebuilds it from Trakt / TMDB.

## 1.0.1 — 2026-05-14

### Fixed

- Existing media-note updates no longer rely on Obsidian's frontmatter
  parser before the plugin can write its own fields. The sync path now
  rebuilds plugin-owned frontmatter textually, preserving unrelated user
  fields, so notes with malformed `trakt_*` YAML can self-repair on the
  next sync instead of failing with parser errors.

## 0.7.1 — 2026-05-11

**Post-submission-review hardening.** Obsidian's submission bot
flagged three `@typescript-eslint/require-await` violations on [PR
#12757](https://github.com/obsidianmd/obsidian-releases/pull/12757)
(May 11). Fixed them, added the rule to our local config so the bot
never catches us off-guard again, and used the occasion to run a
focused safety audit of the high-risk code added since 0.1.0 (legacy
migration, daily-notes integration, diff-based write). Three real
issues surfaced and were fixed.

### Fixed

- **Three `async`-without-`await` violations**:
  - `main.ts` Trakt connect command callback (`callback: async ()` →
    `callback: () =>`)
  - `settings.ts` Connect button onClick (same shape)
  - `settings.ts` `applyTemplateLanguageChange` arrow function (now
    a synchronous function, with the caller still awaiting
    `saveSettings()` afterward)
- **`isMarkerRegionValid` accepted identical start/end markers.**
  If a user set both Daily Notes marker fields to the same string
  (e.g. both `%%`), `indexOf` could find two occurrences of that
  string and treat them as a "pair" — `replaceMarkerBlock` would
  then mangle whatever was between them. Now rejects empty or
  identical strings up front. Closes a content-mangling
  vulnerability that violated spec 0006's safety contract.
- **`migrateFromLegacyFolder` could loop forever on corrupted
  legacy data.** A legacy `data.json` parsing as JSON `null` (or
  an array, or a primitive) would have been written through
  `saveData(null)` and then on the next launch re-triggered
  migration indefinitely. Now validates that the parsed root is a
  plain object before proceeding — anything else degrades to
  `DEFAULT_SETTINGS` with a console warning.
- **`loadLocalKeysAndApplyOverlay` had a loose `as string[] | null`
  cast** on the localStorage return value. Replaced with a
  runtime `Array.isArray` check + string-element filter, so a
  corrupted localStorage entry degrades to "first-launch defaults"
  rather than handing a malformed array downstream.

### Added

- `eslint.config.mjs` now enables `@typescript-eslint/require-await`
  locally. The same rule the Obsidian bot uses — catch regressions
  before the bot does.
- **14 new smoke tests** (cases 53-55):
  - Empty / identical / inverted marker rejection (4 cases)
  - `computeDailyNotePath` across folder + format combinations
    including nested formats and empty folder (5 cases)
  - Regression: `replaceMarkerBlock` splices verbatim
  - Regression: `aggregateEventsForDate` handles items without
    `watch_history_episodes` (no crash, 0 events)
  - Regression: verb resolution is case-insensitive (`JA-JP` =
    `ja-JP`)

### Migration

None. Behavior changes only matter for edge cases that no normal
user hits — corrupted legacy data, identical markers, or future
bot-rule regressions.

**Total tests: 353 (was 339). All passing.**

## 0.7.0 — 2026-05-11

**Daily Notes integration.** Auto-inserts per-event lines into your
Daily Note for every sync — watched episodes, watchlist additions,
favorites, ratings — chronologically sorted, in your chosen
template language. Safe by design: never modifies content outside
the marker region.

### Added

- **`src/daily-notes.ts`** — new module containing the catch-up
  algorithm, event aggregation, marker handling, path computation,
  verb translations. Pure logic, unit-tested.
- **Daily Notes settings tab** with:
  - Enable toggle (master)
  - Folder + filename format (Moment.js)
  - Customizable start/end marker strings
  - Live preview of 3 sample events using current language
  - Source events reference table (gated by sync source flags)
  - Manual backfill slider (1-30 days) + confirmation modal
- **6 new settings fields** with defaults (disabled by default —
  user opts in via the tab)
- **`historyState.lastDailyNoteSyncedAt`** cursor tracking, in
  data.json (shared cross-device alongside `lastIncrementalSyncAt`)
- **`Sync to daily notes (today only)` command** in Command Palette
  for manual today-only refresh
- **Confirmation modal** on Backfill button explaining the safety
  rules in plain language before the user confirms
- **Verb translations** in 11 languages matching spec 0007's
  bundled template set
- **52 new smoke tests** (cases 46-52): date helpers, marker
  detection, block rendering, verb localization across all 11
  languages, safety properties (replaceMarkerBlock + appendMarkerBlock
  preserve outside content), event aggregation by source flag gating

### Safety contract (the spec's most important property)

> For every Daily Note file on disk, content outside the marker
> region must be byte-for-byte identical before and after every
> catch-up run. No exceptions.

Enforced by:
- `replaceMarkerBlock` only modifies `[startIdx, endIdx + markerEnd.length)`
- `appendMarkerBlock` only adds to the end of existing content
- 26 enumerated edge cases (spec 0006), all handled with "skip silently"
  semantics on any ambiguity
- File doesn't exist → never created
- Past day with markers → never touched (add-only)
- Today with markers → only the content between markers replaced

### Catch-up algorithm

Auto-runs at end of every sync (manual / scheduled / startup /
command palette):

1. **Always process today first** (overwrite mode) — ensures
   newer events from later in the day appear when user re-syncs
2. **Walk past days** from (cursor + 1) to (today - 1) in
   add-only mode — first device fills, others see markers and skip
3. **Cap at 90 days** if cursor is very stale (safety against
   re-scanning hundreds of files)
4. Advance cursor to today

### Per-event-type sync flag gating

Each event type only appears if its source sync is enabled:

| Event | Required sync flag |
|---|---|
| Watched | Sync watch history (detailed) |
| Added to watchlist | Sync watchlist |
| Favorited | Sync favorites |
| Rated | Sync ratings |

### Backfill behavior

Settings-only button (NOT in Command Palette — too easy to mis-fire).
Walks last N days (1-30 configurable). Same add-only safety as
catch-up: past days with markers are never modified. Today gets
overwritten as usual.

### Migration

No migration. New `dailyNotesEnabled` defaults to `false`. Existing
users on 0.6.x see nothing change until they go to the new Daily
Notes tab and toggle it on. The new `lastDailyNoteSyncedAt` field in
`historyState` initializes to `""` (empty) — first run with the
feature enabled processes only today.

### Note on the "don't edit between markers" warning

After user feedback during spec review, the auto-inserted HTML
comment warning inside the marker block was dropped — it cluttered
edit mode. The warning now lives only in the settings UI (red banner
under the marker config fields).

See [spec 0006](specs/0006-daily-notes-integration.md) for full design.

**Total tests: 339 (was 287). All passing.**

## 0.6.0 — 2026-05-11

**Tabbed settings UI + 8 new bundled template languages.**

Two paired changes shipped together:

### Added — Settings tab navigation (spec 0005)

After 0.5.x the settings page was >1000 lines of Setting instances —
hard to find anything especially on mobile. Refactored into 4
top-of-page tabs (Notebook Navigator-style):

  General | Notes | Sync | Daily Notes

- **General** — Trakt auth + TMDB key/test/cache + Reset
- **Notes** — Metadata language, UI language, template language,
  folder, filename template, body templates, tags, tag notes
- **Sync** — Sync sources + Sync behavior (auto-sync, startup,
  overwrite, etc.) + History full-refresh + Clear history state
- **Daily Notes** — placeholder in 0.6.0; populated by 0.7.0
  (see spec 0006)

Active tab persists per-device via `localStorage`
(`sync-trakt:_activeSettingsTab`). Each Mac / iPhone remembers its
own last-viewed tab.

### Added — 8 new bundled template languages (spec 0007)

Previously the Note template language dropdown listed 15 metadata
locales but only 3 actually had bundled templates (en + zh-CN +
zh-TW). Picking Japanese silently fell back to English — confusing
UX.

Fixed by:

1. **Adding 16 new template constants** (8 movie + 8 show) for:
   Japanese, Korean, French, German, Italian, Spanish, Portuguese
   (BR), Russian. Total bundled coverage: 11 languages.
2. **Filtering the template-language dropdown** to only show those
   11. The "Custom" option (which had no effect for unsupported
   languages anyway) is removed.

Translations are hand-curated, not machine-translated. Section
headings, bullet labels, punctuation all follow target-language
conventions (full-width colons in JA, spaced colons in FR, etc.).

The Metadata language dropdown stays at 15+ options + custom mode —
TMDB genuinely supports those, this is now an intentional surface
difference between the two dropdowns.

### Changed

- `getDefaultMovieTemplate(lang)` and `getDefaultShowTemplate(lang)`
  recognize 11 locales (vs 3 previously). Both BCP-47 (`ja-JP`,
  `ko-KR`, ...) and short codes (`ja`, `ko`, ...) resolve correctly.

### Migration

No migration needed. 0.5.x users whose `templateLanguage` was set to
something like `ja-JP` (silently using English) will, on their first
0.6.0 launch, get the actual Japanese template when their notes are
next regenerated. Users with `templateLanguage="custom"` see the new
filtered dropdown without the Custom option — their saved value
stays in data.json until they pick something from the new list.

### Tests

27 new smoke cases verify:
- All 8 new bundled languages return their own templates
- Short codes alias to full locales (`ja` → `ja-JP`)
- Unsupported locales (`tr-TR`) fall back to English correctly
- Each new template contains its language's section headings
- Tab i18n keys resolve in en + zh-CN

**Total tests: 287 (was 260). All passing.**

See [spec 0005](specs/0005-settings-ui-tabs.md) +
[spec 0007](specs/0007-template-language-expansion.md) for design.

## 0.5.3 — 2026-05-11

**Tweak plugin description to pass Obsidian directory submission bot.**

The submission bot for the Community Plugins directory rejected our
PR with:

> ❌ Please don't include `Obsidian` in the plugin description

Our manifest description was:

> "Sync your Trakt.tv watchlist, watch history, favorites, and
> ratings into Obsidian notes — with metadata localization and
> detailed per-episode watch timestamps."

Replacing "Obsidian notes" with "Markdown notes" — both accurate,
the latter slightly more general (and bot-compliant).

### Changed

- `manifest.json` `description`: replaced "Obsidian notes" with
  "Markdown notes". Character count: 162 (well under the 250-char
  cap).
- `package.json` `description`: same substitution for consistency.

### Migration

None. Cosmetic text-only change. No runtime behavior, no settings
schema, no data layout impact.

## 0.5.2 — 2026-05-11

**Auto-clean the legacy plugin folder after migration.**

0.4.0 introduced a transparent data migration from
`.obsidian/plugins/obsidian-sync-trakt/` to `sync-trakt/`, but kept
the entire legacy folder around indefinitely "in case the user wants
to revert". 0.5.1 renamed the display name so the two folders were at
least visually distinguishable. Real-world feedback after the
0.4.0 → 0.5.1 upgrade flow showed both problems were still real:

- Users overwhelmingly don't manually delete the legacy folder, so
  it persists forever as `.obsidian/plugins/` clutter
- Even after the rename, having two Trakt-flavored plugin entries
  (one frozen, one active) creates ongoing confusion

This release deletes the legacy folder's binary files **automatically
and keeps `data.json` as a recovery snapshot.**

### Changed

- **`onload()` now runs `cleanupLegacyBinaries()` unconditionally
  after `loadSettings()`.** Removes `main.js`, `manifest.json`, and
  `styles.css` from `.obsidian/plugins/obsidian-sync-trakt/` if they
  exist. **data.json is intentionally preserved.**
- After the cleanup:
  - The legacy folder is no longer recognized as a plugin by Obsidian
    (no manifest.json) → the duplicate entry **disappears from
    Settings → Community plugins**
  - `data.json` remains as a recovery snapshot if anything goes wrong
    with the new folder
  - User can delete the now-empty-ish folder manually whenever they
    feel safe to — or just leave it; it's harmless

### Safety properties

- **Idempotent**: runs on every launch, no-ops when binaries are
  already gone. Catches devices that migrated under 0.4.0-0.5.1
  before this cleanup existed.
- **Failure-silent**: permission denied, file locked, adapter errors
  all caught via try/catch. Never blocks plugin startup. Retries
  next launch.
- **Multi-device-safe**: when Mac runs the cleanup and the vault sync
  layer propagates the deletions to iPhone, iPhone (if still on 0.3.x)
  will see its old plugin fail to load on next launch — but BRAT will
  then install 0.5.2 to the NEW folder, the migration will run from
  the still-intact data.json in the legacy folder, and everything
  recovers transparently.
- **data.json is never touched** — if you ever need to roll back, the
  3 binary files can be re-downloaded from the 0.3.x release and
  your state is right there.

### Migration

**Automatic.** Existing BRAT users on 0.4.0-0.5.1 will see the legacy
folder's plugin entry disappear on the first 0.5.2 launch. Fresh
0.5.2 installs are unaffected (no legacy folder exists).

### Why this wasn't in 0.4.0

Original spec 0004 had us err on the safe side: leave everything in
place. The cost (clutter + ongoing confusion) turned out higher than
the protected benefit (recovery for a rollback scenario almost no one
hits). 0.5.2 corrects this by keeping the recovery snapshot
(data.json) while removing the visual cruft (the binaries). Best of
both.

See [spec 0004](specs/0004-obsidian-directory-submission.md) §"Update:
0.5.2 cleanup" for the full design + 4 new edge cases.

## 0.5.1 — 2026-05-11

**Rename display name: "Obsidian Sync Trakt" → "Sync Trakt".**

After 0.4.0 changed the plugin `id` from `obsidian-sync-trakt` to
`sync-trakt`, BRAT installs leave **both folders** in place — the
legacy folder is preserved as a downgrade safety net (per spec 0004).
Both folders contain a `manifest.json` declaring the same display
name "Obsidian Sync Trakt", so Obsidian's plugin list showed **two
identical entries** with no way to tell them apart. Users couldn't
identify which was the active one (new `sync-trakt` getting BRAT
updates) and which was the abandoned legacy.

This release renames the display name on the active plugin so the two
become visually distinguishable.

### Changed

- **`manifest.json` `name`**: `Obsidian Sync Trakt` → `Sync Trakt`.
  After upgrade, the plugin list shows:
  - "Obsidian Sync Trakt" → legacy plugin in `obsidian-sync-trakt/`
    (frozen at the last 0.3.x you installed; no further updates)
  - "Sync Trakt" → active plugin in `sync-trakt/` (BRAT keeps
    updating this one)
- **All 9 README H1 + prose mentions** updated from "Obsidian Sync
  Trakt" to "Sync Trakt". CHANGELOG entries from earlier releases
  keep their historical names — that's what the plugin was called
  at the time.
- **MANUAL.md + 3 translations + SETUP.md + 3 translations +
  DEVELOPER.md** updated to use the new name.

### Migration

Nothing to migrate. The rename is a label change only — `id` stayed
at `sync-trakt`, data lives in the same folder, all stored settings
preserved. After upgrade, you can finally:

1. Confirm the new "Sync Trakt" plugin works (sync runs, settings
   intact from the 0.4.0 migration)
2. **Disable** the legacy "Obsidian Sync Trakt" plugin
3. **Manually delete** `<vault>/.obsidian/plugins/obsidian-sync-trakt/`
   to clean up. Optional but recommended once you're sure the new
   plugin is healthy.

### Why this wasn't done in 0.4.0

Spec 0004 deliberately deferred the display-name rename: the bot
doesn't check display name (so the submission was unblocked), and we
preferred to minimize the scope of one release. Real-world feedback
from the 0.4.0 → 0.5.0 BRAT upgrade flow showed the dual-entry
confusion clearly enough that the rename is now worth doing.

## 0.5.0 — 2026-05-11

**Device-local settings with a per-setting sync toggle.** Some settings
(auto-sync cadence, UI language) shouldn't always sync across devices.
0.5.0 splits the plugin's persistent state into two layers — synced
(`data.json`, follows Obsidian Sync) and device-local (`localStorage`,
never syncs) — with a cloud icon next to each eligible setting that
lets you toggle which layer it lives in.

### Added

- **Two-tier settings storage** (`src/main.ts`):
  - **Synced layer**: `data.json`, picked up by Obsidian Sync as before
  - **Device-local layer**: Obsidian's vault-scoped `localStorage` via
    `app.loadLocalStorage` / `app.saveLocalStorage`. Each device
    independently records which keys are local on it (the `_localKeys`
    list is itself device-local), so Mac and iPhone can have
    independent toggle states.
- **Per-setting cloud icon** in the settings tab — appears next to the
  4 settings eligible for the toggle:

  | Setting | Default state |
  |---|---|
  | Sync on startup | **local** (per-device launch behavior) |
  | Auto-sync enabled | **local** (per-device cadence choice) |
  | Auto-sync interval | **local** (per-device cadence choice) |
  | Plugin UI language | **synced** (toggleable) |

  Click the icon to flip the state. Tooltip explains what happens:

  > "This setting syncs across devices via Obsidian Sync. Click to make it device-local."

  → "This setting is local to this device only. Click to sync it across devices."

  Uses Lucide's `cloud` and `cloud-off` icons (already shipped with
  Obsidian).
- **`docs/specs/0003-device-local-settings.md`** — design + 8-row
  edge-case matrix + alternatives considered. Status updated to
  `implemented`.
- **20 new smoke tests** (cases 42-44): lock down `LOCAL_ELIGIBLE_KEYS`
  membership, `DEFAULT_LOCAL_KEYS` subset relationship, the cloud-icon
  i18n key resolution in both languages. Total tests: **260** (was 240).

### Migration

**Automatic on first 0.5.0 launch.** When the plugin sees no
`_localKeys` in localStorage, it:

1. Seeds the list with `DEFAULT_LOCAL_KEYS` (the auto-sync trio)
2. Reads the current value of each from data.json
3. Writes those values to localStorage
4. On subsequent `saveSettings()`, those keys are excluded from
   `data.json` and only written to localStorage

For each new device (or vault) you install 0.5.0 on, the same one-time
seeding runs independently — each device gets its own initial state.

If you previously had Mac auto-sync on and iPhone auto-sync also on,
both will continue to be on after upgrade. The state is preserved; it
just moves into a per-device storage layer where it can now diverge if
you change it on one device.

### Changed

- **`saveSettings()` now splits storage** per the spec — local keys to
  `localStorage`, synced keys to `data.json`. No call site changes
  needed; reads still use `this.settings.foo` directly because the
  load path overlays localStorage values on top of data.json at startup
  and on cross-device sync events (`visibilitychange`).
- **The `Obsidian Sync` story under "Cross-device sync" in the README**
  remains accurate: your library, auth, and content settings still
  follow Obsidian Sync. The cloud icon affects exactly 4 settings.

See [spec 0003](specs/0003-device-local-settings.md) for design.

## 0.4.0 — 2026-05-11

**Submission preparation for the Obsidian Community Plugins directory.**

To list in the official directory, the plugin id must comply with the
submission bot's "no `obsidian` in id" rule. Since the plugin id is also
the folder name under `.obsidian/plugins/<id>/`, changing it triggers a
data-folder migration for existing BRAT-installed users. This release
handles all of it transparently and tightens the `minAppVersion`
declaration to match the APIs we actually use.

### Changed

- **Plugin id**: `obsidian-sync-trakt` → `sync-trakt`. Required to pass
  Obsidian's submission bot (`id can't contain obsidian`). The GitHub
  repo name stays at `o1xhack/obsidian-sync-trakt` — Obsidian only
  identifies plugins by `id`, not by repo path, so external links and
  BRAT subscriptions keep working unchanged.
- **`minAppVersion`**: `1.4.0` → `1.6.6`. Reflects the highest `@since`
  of any API we actually use (`fileManager.trashFile`, per Obsidian's
  `obsidian.d.ts`). Previous `1.4.0` was technically incorrect: users
  on 1.4.0-1.6.5 who enabled `Delete removed items` would have crashed
  on the trash step. The default for that setting is off, so no users
  hit it in practice — but the declaration is now honest.
- **Display name** stays `Obsidian Sync Trakt`. The bot doesn't check
  display name. If a reviewer asks during human review, we change it in
  a small follow-up.

### Added

- **Transparent legacy-folder migration on first 0.4.0 launch.** When
  `loadSettings()` finds an empty new-folder data.json but a populated
  `data.json` at `.obsidian/plugins/obsidian-sync-trakt/`, the plugin
  reads, parses, and saves to the new folder. The user sees a single
  one-time Notice (`Traktr: settings migrated from the legacy plugin
  folder. Your Trakt token, TMDB cache, and history state are
  preserved.`) — in their saved UI language. See spec 0004 for the
  full edge-case matrix (8 scenarios covered).
- **The legacy folder is NOT deleted.** Safety net for users who
  downgrade via BRAT; cleanup is the user's decision. A console line
  states the folder is safe to delete manually after they've verified
  0.4.0 works.
- **`docs/specs/0004-obsidian-directory-submission.md`** — design +
  submission process documentation.
- **One new smoke test** verifies the `notice.migratedFromLegacyFolder`
  i18n key resolves correctly in both `en` and `zh-CN`. Total tests:
  236 (was 235).

### Migration

The migration runs **automatically** on the first 0.4.0 launch for
BRAT users. No user action required. If the user later reverts to
0.3.x, the legacy folder is still intact and 0.3.x resumes from where
it left off.

Fresh installs of 0.4.0 (no legacy folder) skip the migration cleanly
and proceed with DEFAULT_SETTINGS as usual.

See [spec 0004](specs/0004-obsidian-directory-submission.md) for design.

## 0.3.2 — 2026-05-11

**UX: make the TMDB-vs-Trakt API contract obvious and testable.**

User report (paraphrased): "If I enable metadata localization but skip the
TMDB key, I get a half-translated library and don't know why. The TMDB key
description only mentions posters, so I thought it was optional for
translation too — but genres stayed English and there were no posters."

Root cause: pre-0.3.2 wording on the TMDB API key setting was
`"Optional. If blank, poster images are skipped"` — accurate but
incomplete. It hid the fact that genres translation and full-quality
title/overview/tagline translation also depend on TMDB. The plugin DID
fall back to Trakt's `/translations` endpoint for title/overview/tagline,
but the description didn't say so, and there was no way to verify a key
worked before committing to a 30-second sync.

### Added

- **TMDB API key Test button.** New `verifyTmdbApiKey()` function hits
  TMDB's `/configuration` endpoint and returns a discriminated result
  (`ok` / `empty` / `unauthorized` / `network`). Surfaces TMDB's own
  `status_message` to the user via the result detail when authentication
  fails. Empty-input short-circuits without a network call.
- **Inline warning in Localization section.** When `metadataLanguage` is
  set but `tmdbApiKey` is empty, a warning banner appears under the
  language dropdown spelling out exactly what's missing (genres stay
  English, no posters) and where to fix it. Non-blocking — informational
  only.
- **README "🔑 API keys: what each one unlocks" section in all 9
  languages.** New comparison table placed between Quick Start and
  Install:

  | Feature | Trakt API _(required)_ | TMDB API _(recommended)_ |
  |---|:---:|:---:|
  | Sync Trakt library | ✅ | — |
  | Per-episode timestamps | ✅ | — |
  | Title / overview / tagline localization | ✅ basic | ✅ higher quality |
  | Genres localization | ❌ | ✅ |
  | Poster images | ❌ | ✅ |

  Now users see what they're trading away if they skip TMDB, before
  they paste any keys.
- **14 new smoke tests** (cases 37-40 in `tests/i18n.smoke.ts`) for
  `verifyTmdbApiKey`: empty / whitespace input, 200 OK, 401, 403, 5xx,
  thrown exceptions. Total test count: **235** (was 221).

### Changed

- **TMDB API key description rewritten** (en + zh-CN) to lead with the
  full impact: "Recommended. Powers poster images AND complete metadata
  translation — including genres — in your chosen language. Without a
  key, posters are skipped and translations fall back to Trakt …"

### Migration

No data migration. The new wording, Test button, and warning banner are
purely additive UI/docs changes. Existing behavior unchanged — Trakt
translation fallback still works exactly as before for users who choose
not to set up TMDB.

## 0.3.1 — 2026-05-10

**Fix: filename collision when distinct items localize to the same
title.**

User report: a fifth show titled "重生" (Trakt id 159058) kept failing
to sync with `Failed to sync "重生" (show 159058): File already exists`.
Root cause: the user's vault already had four other notes whose
localized title was "重生" — distinct shows whose Chinese-translated
titles happened to collapse to the same string. The default
`{{title}} ({{year}})` filename template produced `重生 (2020).md` for
the fifth item, colliding with an existing file. `vault.create()`
threw, the item was logged as failed, every subsequent sync hit the
same error.

This is a structural risk that grows as more users enable metadata
localization — common-translation titles are exactly the cases
localization improves the UI for, but they also increase filename
collisions for distinct underlying items.

### Added

- **Two-tier filename disambiguation** in the CREATE branch:
  - **Tier 0** (default): `{{title}} ({{year}})` — `重生 (2020)`
  - **Tier 1** (only if `originalTitle` differs from `title`): inject
    English original — `重生 (Born Again) (2020)`
  - **Tier 2** (always succeeds — Trakt ids are globally unique):
    append `[trakt_id]` — `重生 (Born Again) [157810] (2020)` (or
    `重生 [159058] (2020)` when tier 1 isn't available because the
    item lacks a distinct originalTitle).
  - The augmentation always goes into the `{{title}}` slot, so year /
    trakt_id positions in the user's custom template stay where the
    user put them.
  - Logged to console with the tier number when a fallback fires, so
    debugging is easy.
- **6 new smoke tests** (cases 31-36) — buildFilename with
  titleOverride, all three tiers, same-title edge case, empty
  originalTitle. Total test count: 221 (was 208).

### Migration

No data migration. Existing notes are unaffected — the disambiguation
only runs when CREATING a new note. The 5th "重生" that's been failing
to sync will land at `重生 (Born Again) (2020).md` (or similar) on the
next sync.

## 0.3.0 — 2026-05-10

**Major: diff-based write.** Sync no longer touches every note's mtime
on every run. Each note is rewritten only when its frontmatter or
managed body section would actually change. Cross-device sync layers
(Obsidian Sync, iCloud, Syncthing, vault-as-git) see ~1200 fewer
"modified" files per sync in steady state.

### Added

- **Diff-first reconcile.** Before calling `processFrontMatter` /
  `vault.process` on an existing note, the engine compares the
  would-be frontmatter against what's already on disk (via
  `metadataCache.getFileCache().frontmatter`) and the would-be body
  section against the current file content. Both writes are skipped
  when neither would meaningfully change. The sync notice now reports
  a fourth count: **{unchanged}**, so a typical post-binge sync of a
  1200-item library reads "0 added, 1 updated, 1199 unchanged, 0
  removed".
- **`docs/specs/0002-diff-based-write.md`** — full design including the
  26-row edge-case matrix and the data-integrity acceptance criterion.
- **32 new smoke tests** covering the diff functions: true negatives
  (identical data), true positives (any meaningful field change), array
  order sensitivity, null-key delete semantics, the buildFrontmatterData
  round-trip, and watch-history body idempotency.

### Changed

- **`trakt_synced_at` semantic upgrade.** Previously this field was
  rewritten to "now" on every sync — making it useless as a sort key
  and making it the sole reason every note got rewritten every time.
  Now it only updates when sync actually modifies the note. Existing
  values on disk from 0.2.x stay as-is until the note has a real
  change. Bases / Dataview can now sort by `trakt_synced_at` to find
  recently-changed entries.

### Migration

No data migration. The first 0.3.0 sync may rewrite many notes with
real Trakt-side changes that accumulated since the last sync (this is
correct). Subsequent syncs are quiet. `trakt_synced_at` values from
0.2.x stay stale on unchanged notes — that's the new (correct) meaning.

The legacy "always rewrite" behavior is still available by enabling
**Overwrite existing note body** in settings.

See [spec 0002](specs/0002-diff-based-write.md) for design + the full
edge-case contract.

## 0.2.0 — 2026-05-10

**Major: incremental sync.** Steady-state sync wall time drops from
3-5 minutes to under 10 seconds for typical libraries.

### Added

- **TMDB metadata cache.** Each `(type, tmdbId, language)` triple is
  cached in `data.json` after first fetch, with a configurable TTL
  (default 90 days, ±5 days jitter so entries don't all expire on the
  same day) and lazy stale-while-revalidate semantics. Cache survives
  device-to-device sync. New setting: **TMDB cache TTL**. New button:
  **Clear TMDB cache**.
- **Incremental Trakt history fetch.** Sync now stores the
  aggregated history state in `data.json` (per-show + per-movie watch
  timestamps, plus the set of every event id seen). Each subsequent
  sync queries `/sync/history?start_at=lastIncrementalSyncAt` and
  merges new events into the stored state. Watching a single new
  episode now costs ~1 Trakt history call instead of ~150.
- **Periodic full history refresh** for deletion detection. Every
  `historyFullRefreshIntervalDays` (default 7), the next sync re-pulls
  the full history without `start_at`, compares the event-id set
  against `knownEventIds`, and rebuilds state from scratch when
  events were deleted on Trakt's side. New setting:
  **History full-refresh interval**. New command:
  **Traktr: Force full history refresh**.
- **Settings auto-reload on app focus.** The plugin re-reads
  `data.json` from disk when Obsidian becomes visible again (e.g. when
  the user switches back from another app on iPhone after their Mac
  finished a sync). No more "I have to disable + re-enable the plugin
  to see settings my Mac just synced over."
- **`docs/ARCHITECTURE.md`** — comprehensive technical reference.
- **`docs/specs/`** — design spec folder; [0001](specs/0001-incremental-sync.md)
  documents the 0.2.0 work.
- **`docs/CHANGELOG.md`** — this file.

### Changed

- README "Acknowledgements" section reframed across all 9 languages —
  the project is now its own architecture, not a direct fork of
  upstream code.
- LICENSE annotations simplified to plain `Copyright (c) … (url)`
  notices side by side; both apply, both preserved.

### Migration

The first 0.2.0 sync is the same cost as a 0.1.x sync (cold cache, no
history state). Subsequent syncs are fast. No manual action required;
fields default to the right values when missing from `data.json`.

See [spec 0001](specs/0001-incremental-sync.md) for the full design
trade-offs.

## 0.1.4 — 2026-05-10

**Fix: live sync progress visible on mobile.**

The 0.1.3 progress reporting only updated the desktop status bar.
Obsidian's `addStatusBarItem()` is documented as desktop-only; on iOS /
Android, calling `.setText()` is a silent no-op. The user reported that
tapping **Traktr: Sync** on iPhone looked completely silent — no
visible progress until the final notice.

Fix: every progress tick now also drives a persistent `Notice` (created
with `duration=0` so it stays on screen, then updated in-place via
`Notice.setMessage()`). The notice is hidden when sync finishes,
including in the error path.

## 0.1.3 — 2026-05-10

**Major: TMDB title/poster fallback + sync progress + Bases docs.**

### TMDB title fallback

User report: most movie titles came back as English even with metadata
language set to `zh-CN`. Root cause: TMDB moderators sometimes lock the
`title` field on a `zh-CN` translation row to blank (especially for
movies without an official mainland release); the API does not
auto-fall-back to other Chinese variants.

Fix: switched to `?language=X&append_to_response=translations` and
added a client-side picker that walks the translations array. For
`zh-CN` we try **CN → TW → HK → SG → any other zh entry**. Same pattern
Jellyfin / Radarr / tinyMediaManager all use.

### TMDB poster fallback

Same root cause — TMDB returns `null` for `poster_path` on movies
without a poster tagged in the requested language. Fix: when a
language-specific request returns null, retry without the language
parameter to get the default poster.

### Sync progress

Replaced the `Promise.all` burst over all items with a
bounded-concurrency pool (5 in flight). Live status bar updates during
sync. Reduced TMDB rate-limit pressure for 1000+ item libraries.

### Obsidian Bases support

Documentation only — `trakt_poster_url` already works in Bases card
view (Obsidian 1.9.3+) as a raw external URL. Added a "View in Bases"
section to all 9 README languages.

### Title / Tagline customization clarification

MANUAL.md (4 languages) now has a "Common customizations" subsection
explaining that title is `{{title}}` in the body template (no separate
field), and tagline format is fully editable in the Movie template.

## 0.1.2 — 2026-05-10

**Docs only**: full restructure + multi-language docs system.

- Moved `doc/` → `docs/`; added `docs/screenshots/` and `docs/i18n/`
- Wrote new English `docs/SETUP.md` (Trakt + TMDB API key flow,
  troubleshooting)
- Translations matrix:
  - README × 9 languages: en + zh-CN + zh-TW + ja + ko + fr + de + es + it
  - SETUP × 4 languages: en + zh-CN + zh-TW + ja
  - MANUAL × 4 languages: en + zh-CN + zh-TW + ja
- Added `docs/i18n/index.md` as the navigation hub
- Redesigned README: badges, language switcher, feature sections with
  inline code examples, expandable install methods, roadmap

## 0.1.1 — 2026-05-09

**Fix: `{{watch_history}}` body section now updates in subsequent syncs.**

The default sync mode (`Overwrite existing note body` = off) only
updated frontmatter on existing notes — but `{{watch_history}}` is
rendered into the body. Result: watch history was frozen at note-
creation time and never reflected new episodes you watched after that.

Fix: machine-managed section markers using Obsidian's native `%% … %%`
comment syntax. The watch-history block is now wrapped in
`%% trakt:watch-history:start %%` … `%% trakt:watch-history:end %%`.
On every sync, when **Sync watch history (detailed)** is on, the engine
finds these markers and replaces what's between them. Content outside
the markers is never touched.

Notes created on 0.1.0 don't have markers yet; on the next sync after
upgrading to 0.1.1 the engine auto-appends a marker-wrapped Watch
History section to the end of each note's body.

## 0.1.0 — 2026-05-09

**First pre-stable release.** Forked from sarimabbas/traktr at upstream
tag 1.5.2 and substantially reworked. Three new feature areas on top
of the upstream sync engine:

### Detailed watch history

- New **Sync watch history (detailed)** toggle pulls Trakt's
  `/sync/history` endpoint and aggregates per-episode (or per-movie)
  watch timestamps
- Renders inline in the note body via `{{watch_history}}` and
  `{{watch_history_list}}` template variables
- Re-watches listed comma-separated; episodes sorted by season then
  episode

### Metadata localization

- New **Metadata language** setting translates `title` / `overview` /
  `tagline` / `genres` via TMDB (Trakt translations as fallback when
  no TMDB key)
- English originals preserved in `trakt_original_*` frontmatter fields
- Tags + tag-note paths always stay in English so existing Dataview
  queries keep working unchanged

### Bilingual UI + translated templates

- Plugin UI language picker (en / zh-CN) covering settings tab, command
  palette, notice popups, auth modal — ~90 string keys in
  `src/i18n.ts`
- Note template language picker (mirrors metadata-language preset
  list). Bundled translations: English, Simplified Chinese, Traditional
  Chinese; other codes fall back to English

### Repository

- Distinct plugin id (`obsidian-sync-trakt` vs upstream `traktr`) — both
  can coexist in the same vault
- Full upstream commit history preserved; this release branches from
  upstream commit `03fe853`

---

## Versioning policy

While in `0.x.y`, **patch bumps** (0.1.x) are used for any change that
ships, including bug fixes, new features, and docs. Minor bumps
(`0.2.0`, `0.3.0`) are reserved for changes substantial enough to merit
a [design spec](specs/) entry — this is a soft signal that the
codebase took a meaningful architectural step. The first `1.0.0`
release will follow standard semver from then on.
