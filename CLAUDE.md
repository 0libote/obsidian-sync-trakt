# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Obsidian Sync Trakt — an Obsidian plugin that syncs Trakt.tv data into vault
notes with YAML frontmatter, customizable templates, optional metadata
localization, and detailed per-episode watch timestamps.

Forked from [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (MIT).
This fork adds: i18n (UI + metadata + templates), detailed watch history,
and the `obsidian-sync-trakt` plugin id (distinct from upstream `traktr`).

## Build Commands

- `npm run dev` — esbuild watch mode (no type checking)
- `npm run build` — `tsc -noEmit -skipLibCheck` then esbuild production bundle → `main.js`
- `npm run lint` — eslint
- `npm run test:i18n` — bundle and run the smoke test suite (no test framework dep)

`main.js` is generated; for releases it is shipped as a release asset, not
checked in.

## Documentation

- [docs/DEVELOPER.md](docs/DEVELOPER.md) — architecture, data flow diagrams, how to extend
- [docs/MANUAL.md](docs/MANUAL.md) — settings reference, frontmatter fields, template variables
- [docs/SETUP.md](docs/SETUP.md) — Trakt + TMDB API key creation, first-time configuration
- [docs/i18n/](docs/i18n/) — translations of README / SETUP / MANUAL

## Key Conventions

- All HTTP uses `requestUrl` from the `obsidian` module (not `fetch`)
- Frontmatter keys are prefixed with `settings.propertyPrefix` (default `trakt_`)
- Template `{{variables}}` are unprefixed for readability
- Items are keyed by `"type:traktId"` (e.g. `"movie:123"`) to avoid cross-type ID collisions
- `this.settings` is shared by reference across `SyncEngine` and `AuthModal`
- `strictNullChecks` is enabled in tsconfig
- All user-facing strings go through `getTranslator()` from `src/i18n.ts`. The
  bilingual UI (en / zh-CN) and template-language defaults all funnel through
  this single source of truth.
- Original (English) metadata is always preserved on `NormalizedItem` as
  `originalTitle / originalOverview / originalTagline / originalGenres` so
  that tags + tag-note paths stay stable across language switches.
