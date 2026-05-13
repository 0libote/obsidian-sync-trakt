# Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.8.7%2B-7c3aed)](https://obsidian.md)

**Turn your [Trakt.tv](https://trakt.tv) watch history into a richly localized Markdown library — with per-episode timestamps, metadata in 15+ languages, and quiet incremental sync that doesn't churn your vault.**

> 🌐 **English** · [简体中文](docs/i18n/README.zh-CN.md) · [繁體中文](docs/i18n/README.zh-TW.md) · [日本語](docs/i18n/README.ja.md) · [한국어](docs/i18n/README.ko.md) · [Français](docs/i18n/README.fr.md) · [Deutsch](docs/i18n/README.de.md) · [Español](docs/i18n/README.es.md) · [Italiano](docs/i18n/README.it.md)

<!-- screenshot: hero -->

## ✨ Why?

- **Detailed watch history** — exactly which episode you watched at what time, including re-watches, kept in sync as you keep watching
- **Metadata in 15+ languages** — translate titles / overviews / taglines / genres via TMDB. Built-in presets for Chinese (CN / TW / HK), Japanese, Korean, French, German, Spanish (ES / MX), Portuguese (BR), Italian, Russian — plus a custom mode for any TMDB-supported locale. English originals always preserved in `*_original_*` frontmatter fields
- **Note templates in 11 languages** _(0.6.0)_ — hand-curated bundled templates (en + zh-CN + zh-TW + ja + ko + fr + de + it + es + pt-BR + ru). Pick from the new template-language dropdown; switch any time without losing customizations
- **Tabbed settings UI** _(0.6.0)_ — General / Notes / Sync / Daily Notes. Last-viewed tab remembered per device
- **Daily Notes integration** _(0.7.0)_ — auto-injects per-event lines into your Daily Note on every sync (watched / watchlist-added / favorited / rated), chronologically sorted, in your chosen template language. Marker-bounded region is fully isolated — content outside it is never modified. See [spec 0006](docs/specs/0006-daily-notes-integration.md)
- **Fast incremental sync** _(0.2.0)_ — first sync seeds the local TMDB cache + Trakt history state; subsequent syncs only fetch what changed. Steady-state sync time drops from minutes to single-digit seconds. See [spec 0001](docs/specs/0001-incremental-sync.md)
- **Quiet writes** _(0.3.0)_ — sync only rewrites notes whose content actually changed. After watching one new episode, a 1200-item library writes one note instead of all 1200 — your cross-device sync layer (Obsidian Sync / iCloud / Syncthing) stops re-uploading the entire library every run. See [spec 0002](docs/specs/0002-diff-based-write.md)
- **Per-setting cloud toggle** _(0.5.0)_ — pick which settings sync across devices and which stay local. Auto-sync interval, startup-sync toggle, UI language — each can be device-local so your Mac and iPhone don't fight over them. See [spec 0003](docs/specs/0003-device-local-settings.md)

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

Metadata localization above is one axis; the plugin's own surfaces are separate axes:

- **Settings tab, command palette, notice popups** speak **English** and **简体中文**. More UI languages on demand — [open an issue](https://github.com/o1xhack/obsidian-sync-trakt/issues) if you want to volunteer one.
- **Bundled note templates** _(0.6.0 expanded from 3 → 11)_ — English, Simplified Chinese (zh-CN), Traditional Chinese (zh-TW / zh-HK), Japanese, Korean, French, German, Italian, Spanish, Portuguese (BR), Russian. Hand-curated, not machine-translated; section headings, bullet labels, and punctuation follow each language's conventions (full-width colons in Japanese, spaced colons in French, etc.). The template-language dropdown lists exactly these 11; locales outside the list are no longer offered (they previously fell back silently to English, which was confusing).

<!-- screenshot: bilingual-ui -->

## 📅 Daily Notes integration _(0.7.0)_

Auto-inserts per-event lines into your Daily Note for every sync — chronologically sorted, in your chosen template language. Covers watched episodes, watchlist additions, favorites, and ratings:

```markdown
%% trakt:daily:start %%
10:00 — 看了 低智商犯罪 (2026) S1E16, S1E17
14:30 — 加入想看 黑暗骑士 (2008)
21:30 — 打分 9/10 重生 (2020)
%% trakt:daily:end %%
```

Each event type is gated by its corresponding sync source toggle — if `Sync favorites` is off, favorite events won't appear in Daily Notes either. Verbs (`watched` / `看了` / `視聴` / `시청` / `a regardé`…) follow your **template language** setting across all 11 bundled languages.

**Safety contract**: the marker region is fully isolated — content outside it is **never modified**. Past days are add-only (existing markers preserved); today is overwritten so newer events appear on later syncs. Configure folder + filename format (Moment.js syntax like `YYYY-MM-DD` or `YYYY/YYYY.MM.DD`) in **Settings → Daily Notes**. A manual **Backfill** button covers up to 30 past days. See [spec 0006](docs/specs/0006-daily-notes-integration.md).

## 🔄 Cross-device sync

Auth state — Trakt tokens, TMDB key, all settings — lives in `<vault>/.obsidian/plugins/sync-trakt/data.json` and follows your vault-sync layer. Configure auth once on Mac, share with iPhone via Obsidian Sync (with `Plugin data` enabled), Syncthing, iCloud + Advanced Data Protection, or Cryptomator. The plugin doesn't store anything on a server.

Since 0.5.0, **any individual setting can opt out of cross-device sync** via a small cloud icon next to it (currently exposed for `Sync on startup` / `Auto-sync` / `Auto-sync interval` / `Plugin UI language`). Useful when, e.g., you want auto-sync every 30 min on Mac but never on iPhone.

## 📊 View your library in Obsidian Bases

The `trakt_poster_url` frontmatter field works out-of-the-box with [Obsidian Bases](https://help.obsidian.md/bases) (Obsidian 1.9.3+). Build a database view of your sync folder and display posters as thumbnails:

- **Card view**: open Display settings → set **Image property** to `trakt_poster_url`
- **Table view** (1.9.4+): add a formula column with `image(note.trakt_poster_url)`

Filter by `trakt_type = "movie"` / `"show"`, sort by `trakt_year` / `trakt_rating` / `trakt_my_rating`, group by `trakt_genres`. The same frontmatter properties that power Dataview queries also power Bases views — no extra setup.

## 🚀 Quick start

1. Settings → Community plugins → **Browse** → search for **Sync Trakt** → **Install** → **Enable**
2. Settings → **Sync Trakt** → fill your Trakt + TMDB API keys ([SETUP guide](docs/SETUP.md))
3. Command palette → **Sync Trakt: Sync**

## 🔑 API keys: what each one unlocks

The plugin uses two APIs. **Trakt is mandatory** — without it, the plugin can't sync anything. **TMDB is optional** but unlocks most of what makes the plugin worth installing. Here's the breakdown:

| Feature | Trakt API<br/>_(required)_ | TMDB API<br/>_(recommended)_ |
|---|:---:|:---:|
| Sync your Trakt library (watchlist, watched, favorites, ratings) | ✅ | — |
| Per-episode watch timestamps | ✅ | — |
| Title / overview / tagline in your language | ✅ basic | ✅ higher quality |
| **Genres in your language** | ❌ | ✅ |
| **Poster images embedded in notes** | ❌ | ✅ |

If you only want English content and no posters, you can leave TMDB blank — Trakt alone is enough. If you want any non-English localization beyond title/overview/tagline, **add a TMDB key** ([free signup](https://www.themoviedb.org/settings/api)). After pasting your key, click the **Test** button next to the field to confirm it works before your first sync.

→ [Full walkthrough for both keys](docs/SETUP.md)

## 📦 Install

<details open>
<summary><b>Obsidian Community Plugins (recommended)</b></summary>

1. Settings → Community plugins → **Browse**
2. Search for **Sync Trakt**
3. Click **Install** → **Enable**

Directory page: https://community.obsidian.md/plugins/sync-trakt

</details>

<details>
<summary><b>Development (build from source)</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # produces main.js
npm run lint
npm run test:i18n  # smoke tests
```

Then copy `main.js`, `manifest.json`, `styles.css` to `<vault>/.obsidian/plugins/sync-trakt/`.

</details>

<details>
<summary><b>Local test (manual install)</b></summary>

1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)
2. Place all three files in `<your-vault>/.obsidian/plugins/sync-trakt/`
3. Settings → Community plugins → enable **Sync Trakt**

</details>

## 📚 Documentation

| Doc | Purpose |
|---|---|
| [SETUP](docs/SETUP.md) | Trakt + TMDB API key creation, first-time configuration, troubleshooting |
| [MANUAL](docs/MANUAL.md) | Full settings reference, frontmatter fields, template variables, sync behavior |
| [DEVELOPER](docs/DEVELOPER.md) | Architecture overview, data flow, how to extend (English only) |
| [docs/i18n/](docs/i18n/) | Translations of README / SETUP / MANUAL into 8 additional languages |

## 🗺️ Roadmap

Major versions since the fork (chronological):

- [x] **0.1** — Initial fork. Detailed watch history with per-episode timestamps, metadata localization via TMDB + Trakt fallback chain, bilingual UI (en + zh-CN), translated note templates (en + zh-CN + zh-TW), distinct plugin id from upstream so both can coexist.
- [x] **0.2** — Incremental sync. Persistent TMDB cache (stale-while-revalidate, 90-day TTL with jitter) + Trakt history-state cursor. Steady-state sync drops from minutes to single-digit seconds. → [spec 0001](docs/specs/0001-incremental-sync.md)
- [x] **0.3** — Diff-based writes. Only rewrite notes whose frontmatter or managed body section actually changed; cross-device sync layers stop shuffling 1200 files per sync. 0.3.x also added: TMDB API key Test button + warning banner when metadata language is set without a key, and two-tier filename disambiguation for localized-title collisions (e.g. 5 shows all called "重生" no longer fight for the same filename). → [spec 0002](docs/specs/0002-diff-based-write.md)
- [x] **0.4** — Directory submission preparation. Plugin id renamed `obsidian-sync-trakt` → `sync-trakt` (Obsidian directory bot rejects ids containing "obsidian"), `minAppVersion` tightened to 1.6.6, and transparent automatic data migration from the legacy folder on first launch. → [spec 0004](docs/specs/0004-obsidian-directory-submission.md)
- [x] **0.5** — Device-local settings + automatic cleanup. Per-setting cloud-icon toggle so each setting can opt out of cross-device sync; auto-cleanup of the legacy folder's binary files (keeping data.json as a safety net) so users don't see two duplicate plugin entries in their settings. → [spec 0003](docs/specs/0003-device-local-settings.md)
- [x] **0.6** — Tabbed settings UI + 11 bundled note template languages. Settings page reorganized into 4 tabs (General / Notes / Sync / Daily Notes). Note templates expanded from 3 to 11 hand-curated languages (+ ja, ko, fr, de, it, es, pt-BR, ru). Template-language dropdown filtered to only show bundled languages. → [spec 0005](docs/specs/0005-settings-ui-tabs.md) + [spec 0007](docs/specs/0007-template-language-expansion.md)
- [x] **0.7** — Daily Notes integration. Auto-inserts per-event lines (watched / watchlist / favorited / rated) into your Daily Note for every sync, chronologically sorted, in your chosen template language. Add-only safety for past days; today is overwritten as the day progresses. Manual backfill button covers up to 30 past days. → [spec 0006](docs/specs/0006-daily-notes-integration.md)
- [ ] **Pending** — Listing in the official [Obsidian Community Plugins directory](https://obsidian.md/plugins). [PR #12757](https://github.com/obsidianmd/obsidian-releases/pull/12757) currently in review.
- [ ] **Future** — More plugin UI translations (currently en + zh-CN) on demand; additional bundled template languages on request.

## 🤝 Acknowledgements

This plugin was originally inspired by [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (MIT licensed), which provided the initial Trakt OAuth scaffolding. Substantial subsequent work — detailed watch-history aggregation, metadata localization with translation-fallback chains, bilingual UI, bounded-concurrency fetching with live progress reporting, machine-managed body sections, the translation-aware template renderer, multi-language docs — has reshaped most of the codebase into a fundamentally different architecture.

Thanks to [Sarim Abbas](https://github.com/sarimabbas) for the starting point. The original work's MIT copyright notice is preserved verbatim in [LICENSE](LICENSE) alongside this project's own.

## 📄 License

MIT — see [LICENSE](LICENSE).

---

Author: [o1xhack](https://github.com/o1xhack)
