# Changelog

Notable changes per release. The plugin follows [semver](https://semver.org/)
loosely — `0.x.y` is the pre-stable iteration line; the major bump to
`1.0.0` will land once the feature set is verified end-to-end and the
plugin is submitted to Obsidian's official Community Plugins directory.

For the full design rationale behind major changes, see [`specs/`](specs/).

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
