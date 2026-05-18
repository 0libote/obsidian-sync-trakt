# Developer guide

Onboarding for contributors. For deep technical reference see
[`ARCHITECTURE.md`](ARCHITECTURE.md). For why specific decisions were
made, see [`specs/`](specs/).

## Quick start

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install

npm run dev          # esbuild watch mode (no type check)
npm run build        # type-check + production bundle → main.js
npm run lint         # eslint
npm run test:i18n    # smoke tests (no test framework dep)
npm run check:release-i18n  # release gate for UI/menu strings + localized docs
```

Plug into a real Obsidian vault for manual testing:

```bash
# Symlink the repo into a test vault's plugins folder
ln -s "$(pwd)" ~/path/to/test-vault/.obsidian/plugins/obsidian-sync-trakt
# Run dev mode in another terminal
npm run dev
# In Obsidian: Settings → Community plugins → enable Sync Trakt.
# Reload Obsidian (Cmd+R) after each rebuild.
```

## Build system

esbuild bundles `src/main.ts` to `main.js`, externalizing the `obsidian`
module. esbuild config: [`esbuild.config.mjs`](../esbuild.config.mjs).

The TypeScript step in `npm run build` is **type checking only**
(`tsc -noEmit`) — esbuild does the actual transpilation.

`tsconfig.json` has `strictNullChecks` on. Keep it that way.

## Repository structure

```
src/                Plugin source code
├── main.ts          Plugin entry: onload(), commands, settings tab
├── settings.ts      Settings schema, defaults, settings tab UI, default templates
├── i18n.ts          Plugin runtime UI strings (en + zh-CN), translator
├── sync-engine.ts   SyncEngine — orchestrates a sync run end to end
├── trakt-api.ts     Trakt API client + history state types
├── trakt-auth.ts    AuthModal + token refresh
├── tmdb-api.ts      TMDB client + cache + translation picker
├── note-renderer.ts Frontmatter + body template + body marker management
├── types.ts         Shared types
└── utils.ts         sanitizeFilename, renderTemplate, toFrontmatter, parseFrontmatter, processWithConcurrency

tests/               Smoke tests (single executable file, stubbed obsidian)
docs/                User + developer documentation
docs/specs/          Design specs for major changes
docs/i18n/           Translations of README / SETUP / MANUAL
.github/workflows/   CI: lint on PR/push, release on tag push (idempotent)
scripts/release.sh   Local end-to-end release: bump versions, build, tag, push, GitHub release
scripts/check-release-i18n.mjs
                      Release gate for runtime UI strings + localized docs
manifest.json        Obsidian plugin manifest
versions.json        Plugin version → minimum Obsidian version map
```

For module-level dependency graph and what each file is responsible
for, see [`ARCHITECTURE.md § 2`](ARCHITECTURE.md#2-module-dependency-graph).

## Plugin lifecycle

`main.ts` extends Obsidian's `Plugin` class:

```typescript
export default class TraktrPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.syncEngine = new SyncEngine(this.app, this.settings, () => this.saveSettings());
    this.addSettingTab(new TraktrSettingTab(this.app, this));
    this.addCommand(/* trakt-sync */);
    this.addCommand(/* trakt-connect */);
    this.addCommand(/* trakt-disconnect */);
    this.addCommand(/* trakt-force-full-refresh */);
    this.addCommand(/* trakt-clear-tmdb-cache */);
    this.statusBarEl = this.addStatusBarItem();
    this.configureAutoSync();
    this.registerDomEvent(document, "visibilitychange", /* refresh on focus */);
    if (this.settings.syncOnStartup && this.settings.accessToken) {
      window.setTimeout(() => void this.runSyncWithProgress(), 5000);
    }
  }
}
```

A few things are subtler than they look:

- **`this.settings` identity matters.** `SyncEngine` is constructed with
  a reference to the settings object; refreshing settings from disk
  (e.g. on visibility change) mutates that object IN PLACE so the
  reference stays valid. `loadSettings()` and `refreshSettingsFromDisk()`
  both follow this rule.
- **Status bar items are desktop-only.** `runSyncWithProgress` drives
  both the status bar (for desktop) and a persistent `Notice` (for
  mobile). See [`ARCHITECTURE.md § 11`](ARCHITECTURE.md#11-note-rendering-pipeline)
  for the rendering pipeline and `Notice` lifetime details.
- **Commands cache their names at registration time.** Changing
  `uiLanguage` requires a plugin reload to refresh command palette
  labels. We document this; a cleaner fix would be re-registering
  commands on language change, but that has its own gotchas around
  hotkeys.

## How to extend

### Add a new setting

1. Add the field + type to `TraktrSettings` in `settings.ts`
2. Add a default to `DEFAULT_SETTINGS`
3. Add a UI control in `TraktrSettingTab.display()` with appropriate i18n
   keys
4. Add the i18n strings to `src/i18n.ts` (en + zh-CN)
5. Wire the field into wherever it's read — usually `sync-engine.ts` or
   `note-renderer.ts`
6. If the setting is user-configurable but rarely changed, document in
   `docs/MANUAL.md` (and translations)

### Add a new template variable

1. Compute the value in `buildTemplateContext` in `note-renderer.ts`
2. Document it in `docs/MANUAL.md` § Template variables (and 3 translations)
3. Optionally add it to one or more bundled default templates in
   `settings.ts`

### Add a new sync source

1. Add the relevant Trakt endpoint in `src/trakt-api.ts`
2. Add a `syncXxx: boolean` setting + UI toggle
3. Extend `fetchAndMergeMovies` / `fetchAndMergeShows` in `sync-engine.ts`
   to fetch and merge into the `merged` map
4. If the source produces a new flag on `NormalizedItem`, update the
   types and `buildFrontmatterData` / `buildTemplateContext`

### Add a new translation

User-facing docs (README / SETUP / MANUAL) live in `docs/i18n/`. See
[`docs/i18n/index.md`](i18n/index.md) for the contribution flow.

Plugin runtime UI (settings, commands, notices) lives in `src/i18n.ts`.
Currently `en` + `zh-CN` only; expanding requires translating the
~100-key string table and adding the language code to the **Plugin UI
language** dropdown in `src/settings.ts`. Open an issue / PR if you
want a specific language.

### Add a release

```bash
npm run release 0.x.y
```

That script (in `scripts/release.sh`) bumps versions, builds, commits,
tags, pushes, and creates a draft GitHub Release with the three asset
files attached. Before the build it runs lint, smoke tests, and
`npm run check:release-i18n`, which verifies the current version's
changelog / in-app release log, every runtime UI string for each
declared UI language, README spec-link parity across all existing
localized READMEs, and MANUAL setting-row parity across all existing
localized manuals. Edit the draft to add release notes, then publish
from the GitHub UI. See [`scripts/release.sh`](../scripts/release.sh)
for exit codes and `RELEASE_SKIP_*` env var escape hatches.

## Testing

Single-file smoke harness: `tests/i18n.smoke.ts`. No test framework —
inline `assertEq` / `assertTrue`. Run with:

```bash
npm run test:i18n
```

When adding tests, add them at the bottom of the file as a new
numbered section (`[N]`). Async tests go in the IIFE at the very end
because top-level await is incompatible with our CommonJS bundle. See
[`ARCHITECTURE.md § 12`](ARCHITECTURE.md#12-testing-approach) for
philosophy and what's deliberately not tested.

## Conventions

These are documented in [`../CLAUDE.md`](../CLAUDE.md) for AI assistants
to follow but apply to humans too:

- All HTTP uses `requestUrl` from the `obsidian` module, never `fetch`
- Frontmatter keys are prefixed with `settings.propertyPrefix` (default
  `trakt_`)
- Template `{{variables}}` are unprefixed for readability
- Items are keyed by `"type:traktId"` (e.g. `"movie:123"`) to avoid
  cross-type ID collisions
- All user-facing strings go through `getTranslator(lang)` from
  `src/i18n.ts`
- Original (English) metadata is always preserved on `NormalizedItem`
  as `originalTitle / originalOverview / originalTagline /
  originalGenres` so tags and tag-note paths stay stable across
  language switches

## Where to look next

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — module layout, sync flow,
  data structures, caching layers
- [`specs/`](specs/) — design rationale per major change; start with
  the index in [`specs/README.md`](specs/README.md)
- [`CHANGELOG.md`](CHANGELOG.md) — what shipped when, condensed
- [`SETUP.md`](SETUP.md) and [`MANUAL.md`](MANUAL.md) — user-facing
  reference; useful when implementing or explaining settings
