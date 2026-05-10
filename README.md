# Obsidian Sync Trakt

> [English](README.md) · [简体中文](docs/i18n/README.zh-CN.md)

Obsidian plugin that syncs your [Trakt.tv](https://trakt.tv) data — watchlist,
watch history, favorites, ratings — into Markdown notes, with **detailed
per-episode watch timestamps** and **metadata localization** (Chinese,
Japanese, etc.).

## Features

- One Markdown note per movie or TV show, with structured frontmatter, a
  customizable body template, and optional tags
- Syncs from four Trakt sources: **watchlist**, **watch history**,
  **favorites**, **ratings**. Multiple sources merge into a single note per
  item
- **Detailed watch history** — opt in to fetch per-episode (or per-movie)
  watch timestamps from Trakt's `/sync/history` endpoint and render them
  inline in the note body. See [`Watch history`](#watch-history-detailed)
- **Metadata localization** — translate `title`, `overview`, `tagline`,
  `genres` via TMDB (or Trakt translations as fallback). English originals
  are preserved in `*_original_*` frontmatter fields. Tags always stay in
  English so existing Dataview queries keep working
- **Bilingual UI** — settings tab, command palette, and notice popups
  available in **English** or **简体中文**
- **Translated default templates** — bundled note templates in English,
  Simplified Chinese (`zh-CN`), and Traditional Chinese (`zh-TW` / `zh-HK`)
- Optional poster images via TMDB
- Frontmatter-only updates preserve any of your own edits to a synced note's
  body
- Auto-sync on a configurable interval, and sync on startup
- Tag notes support (an alternative to inline tags)

## Watch history (detailed)

When **Sync watch history (detailed)** is enabled in settings, the plugin
queries Trakt's `/sync/history` endpoint and aggregates every watch event
into the note body. The default templates render this inline — between the
`Trakt Status` block and `Links`:

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

For movies, it lists every watch timestamp on its own line. Heavy users with
hundreds of shows / thousands of episodes should expect the first sync to
take a few minutes — the endpoint is paginated at 100 entries / page.

Detailed mode is **off by default**. The lighter "summary only" mode (just
`plays` count and `last_watched_at`) is still available via the original
**Sync watch history** toggle.

## Requirements

- A [Trakt.tv](https://trakt.tv) account and an OAuth application
  ([trakt.tv/oauth/applications](https://trakt.tv/oauth/applications), set
  redirect URI to `urn:ietf:wg:oauth:2.0:oob`)
- A [TMDB](https://themoviedb.org) API key — optional, but required for
  poster images and recommended for metadata localization
  ([themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))

## Installation

### Obsidian Community Plugins *(placeholder — pending submission)*

> ⚠️ **Not yet listed.** Once this plugin is accepted into Obsidian's
> official Community Plugins directory (and equivalent third-party
> communities such as the Chinese Obsidian community / 红天社区), this
> will be the recommended install path.

Steps once it's listed:

1. Open Obsidian → Settings → Community plugins → Browse
2. Search for `Obsidian Sync Trakt`
3. Click **Install**, then **Enable**

Until then, use BRAT below.

### BRAT (recommended, current method)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) lets Obsidian install
and auto-update plugins from arbitrary GitHub repos. Steps:

1. Install the **Obsidian42 - BRAT** plugin from Community Plugins
2. Open Settings → BRAT → **Add a beta plugin for testing**
3. Paste the repo path:
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. Click **Add Plugin**. BRAT will install the latest release and keep it
   updated whenever a new tag is pushed.
5. Settings → Community plugins → enable **Obsidian Sync Trakt**

### Manual install

1. Download the latest `main.js`, `manifest.json`, `styles.css` from
   [Releases](https://github.com/o1xhack/obsidian-sync-trakt/releases)
2. Place them in `<your-vault>/.obsidian/plugins/obsidian-sync-trakt/`
3. Settings → Community plugins → enable **Obsidian Sync Trakt**

### Building from source

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # produces main.js
npm run lint
npm run test:i18n  # smoke tests
```

Then copy `main.js`, `manifest.json`, `styles.css` to
`<vault>/.obsidian/plugins/obsidian-sync-trakt/`.

## Documentation

- [doc/MANUAL.md](doc/MANUAL.md) — full settings reference, frontmatter
  fields, template variables, sync behavior
- [doc/DEVELOPER.md](doc/DEVELOPER.md) — architecture overview, data flow,
  how to extend
- [docs/i18n/](docs/i18n/) — translated copies of this README

## Upstream attribution

This plugin is a fork of
[**sarimabbas/traktr**](https://github.com/sarimabbas/traktr) (MIT
licensed). The core sync engine, frontmatter / template structure, and
tag-note system are all directly inherited from that project. Substantial
thanks to [Sarim Abbas](https://github.com/sarimabbas) for the original
work.

## License

MIT — see [LICENSE](LICENSE). The upstream copyright (Sarim Abbas) and
this fork's copyright (o1xhack) both apply; both notices are reproduced
verbatim in the LICENSE file.

---

Author: [o1xhack](https://github.com/o1xhack)
