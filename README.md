# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**Turn your [Trakt.tv](https://trakt.tv) watch history into a richly localized Markdown library — with per-episode timestamps, metadata in 15+ languages, and quiet incremental sync that doesn't churn your vault.**

> 🌐 **English** · [简体中文](docs/i18n/README.zh-CN.md) · [繁體中文](docs/i18n/README.zh-TW.md) · [日本語](docs/i18n/README.ja.md) · [한국어](docs/i18n/README.ko.md) · [Français](docs/i18n/README.fr.md) · [Deutsch](docs/i18n/README.de.md) · [Español](docs/i18n/README.es.md) · [Italiano](docs/i18n/README.it.md)

<!-- screenshot: hero -->

## ✨ Why?

- **Detailed watch history** — exactly which episode you watched at what time, including re-watches, kept in sync as you keep watching
- **Metadata in 15+ languages** — translate titles / overviews / taglines / genres via TMDB. Built-in presets for Chinese (CN / TW / HK), Japanese, Korean, French, German, Spanish (ES / MX), Portuguese (BR), Italian, Russian — plus a custom mode that accepts any TMDB-supported BCP-47 locale code. English originals are always preserved alongside in `*_original_*` frontmatter fields
- **Fast incremental sync** _(0.2.0)_ — first sync seeds the local TMDB cache + Trakt history state; subsequent syncs only fetch what changed. Steady-state sync time drops from minutes to single-digit seconds. See [spec 0001](docs/specs/0001-incremental-sync.md)
- **Quiet writes** _(0.3.0)_ — sync only rewrites notes whose content actually changed. After watching one new episode, a 1200-item library writes one note instead of all 1200 — your cross-device sync layer (Obsidian Sync / iCloud / Syncthing) stops re-uploading the entire library every run. See [spec 0002](docs/specs/0002-diff-based-write.md)

## 🎬 Detailed watch history

When **Sync watch history (detailed)** is enabled, the plugin queries Trakt's `/sync/history` endpoint and inlines per-episode (or per-movie) timestamps into the note body — and keeps that block updated as you watch new episodes:

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

Re-watches are listed comma-separated; episodes sort by season then episode number. The block is wrapped in `%% trakt:watch-history %%` markers — the plugin updates only what's between the markers, so any hand-written notes elsewhere in the body are never touched.

<!-- screenshot: watch-history -->

## 🌐 Metadata localization

Set **Metadata language** to your preference and synced notes get title, overview, tagline, and genres translated via TMDB (with Trakt's translation endpoint as a fallback when no TMDB key is configured). English originals stay in `trakt_original_*` frontmatter fields:

```yaml
trakt_title: 黑暗骑士
trakt_original_title: The Dark Knight
trakt_genres:
  - 动作
  - 犯罪
  - 剧情
trakt_original_genres:
  - Action
  - Crime
  - Drama
trakt_metadata_language: zh-CN
```

Tags and tag-note paths always stay in English — your existing Dataview queries keep working unchanged.

<!-- screenshot: metadata-localization -->

## 🌍 Plugin UI + note templates

Metadata localization above covers many languages; the plugin's own UI surface is a separate, smaller story. **Settings tab, command palette, and notice popups** currently speak **English** and **简体中文**. **Bundled note templates** ship in English, Simplified Chinese (`zh-CN`), and Traditional Chinese (`zh-TW` / `zh-HK`); other template-language codes fall back to the English template — edit the template manually for now, or [open an issue](https://github.com/o1xhack/obsidian-sync-trakt/issues) to request a bundled translation. More UI languages on demand.

<!-- screenshot: bilingual-ui -->

## 🔄 Cross-device sync

Auth state — Trakt tokens, TMDB key, all settings — lives in `<vault>/.obsidian/plugins/obsidian-sync-trakt/data.json` and follows your vault-sync layer. Configure auth once on Mac, share with iPhone via Obsidian Sync (with `Plugin data` enabled), Syncthing, iCloud + Advanced Data Protection, or Cryptomator. The plugin doesn't store anything on a server.

## 📊 View your library in Obsidian Bases

The `trakt_poster_url` frontmatter field works out-of-the-box with [Obsidian Bases](https://help.obsidian.md/bases) (Obsidian 1.9.3+). Build a database view of your sync folder and display posters as thumbnails:

- **Card view**: open Display settings → set **Image property** to `trakt_poster_url`
- **Table view** (1.9.4+): add a formula column with `image(note.trakt_poster_url)`

Filter by `trakt_type = "movie"` / `"show"`, sort by `trakt_year` / `trakt_rating` / `trakt_my_rating`, group by `trakt_genres`. The same frontmatter properties that power Dataview queries also power Bases views — no extra setup.

## 🚀 Quick start

1. Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. Settings → **Obsidian Sync Trakt** → fill your Trakt + TMDB API keys ([SETUP guide](docs/SETUP.md))
3. Command palette → **Traktr: Sync**

## 📦 Install

<details>
<summary><b>BRAT (recommended)</b></summary>

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs and auto-updates plugins from arbitrary GitHub repos.

1. Install **Obsidian42 - BRAT** from Community Plugins
2. Settings → BRAT → **Add a beta plugin for testing**
3. Paste:
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. **Add Plugin** → enable in Settings → Community plugins

BRAT will check for updates whenever Obsidian launches and pull new releases automatically.

</details>

<details>
<summary><b>Manual</b></summary>

1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)
2. Place all three files in `<your-vault>/.obsidian/plugins/obsidian-sync-trakt/`
3. Settings → Community plugins → enable **Obsidian Sync Trakt**

</details>

<details>
<summary><b>Obsidian Community Plugins (pending)</b></summary>

> ⚠️ Not yet listed in Obsidian's official Community Plugins directory. Once accepted, this will become the recommended path. Until then, use BRAT above.

</details>

<details>
<summary><b>Build from source</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # produces main.js
npm run lint
npm run test:i18n  # smoke tests
```

Then copy `main.js`, `manifest.json`, `styles.css` to `<vault>/.obsidian/plugins/obsidian-sync-trakt/`.

</details>

## 📚 Documentation

| Doc | Purpose |
|---|---|
| [SETUP](docs/SETUP.md) | Trakt + TMDB API key creation, first-time configuration, troubleshooting |
| [MANUAL](docs/MANUAL.md) | Full settings reference, frontmatter fields, template variables, sync behavior |
| [DEVELOPER](docs/DEVELOPER.md) | Architecture overview, data flow, how to extend (English only) |
| [docs/i18n/](docs/i18n/) | Translations of README / SETUP / MANUAL into 8 additional languages |

## 🗺️ Roadmap

- [x] Detailed per-episode watch-history sync
- [x] Metadata localization across 15+ language presets + any TMDB-supported locale via custom mode
- [x] Bilingual plugin UI (en + zh-CN); more on demand
- [x] Translated default note templates (en + zh-CN + zh-TW)
- [x] TMDB metadata cache (0.2.0) — skip re-fetching on language switch + steady-state sync in seconds
- [x] Incremental Trakt history fetch (0.2.0) — only fetch new watch events since last sync
- [x] Diff-based writes (0.3.0) — only rewrite notes that actually changed, no more cross-device sync storm
- [ ] Submit to Obsidian Community Plugins directory
- [ ] More plugin-UI translations (ja / ko / fr / ...) on demand

## 🤝 Acknowledgements

This plugin was originally inspired by [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (MIT licensed), which provided the initial Trakt OAuth scaffolding. Substantial subsequent work — detailed watch-history aggregation, metadata localization with translation-fallback chains, bilingual UI, bounded-concurrency fetching with live progress reporting, machine-managed body sections, the translation-aware template renderer, multi-language docs — has reshaped most of the codebase into a fundamentally different architecture.

Thanks to [Sarim Abbas](https://github.com/sarimabbas) for the starting point. The original work's MIT copyright notice is preserved verbatim in [LICENSE](LICENSE) alongside this project's own.

## 📄 License

MIT — see [LICENSE](LICENSE).

---

Author: [o1xhack](https://github.com/o1xhack)
