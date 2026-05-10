# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**把你的 [Trakt.tv](https://trakt.tv) 觀看記錄變成一份高度本地化的 Markdown 庫 —— 帶逐集觀看時間戳、母語元數據和雙語介面。**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · **繁體中文** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ 為什麼用這個

- **詳細觀看紀錄** —— 每一集是哪一天幾點看的、有沒有重看，全都同步到筆記裡，每天追劇即時更新
- **元數據本地化** —— 透過 TMDB 把 title / overview / tagline / genres 翻譯成中文（或任何語言），英文原文保留在 `*_original_*` frontmatter 欄位
- **雙語 UI** —— 設定面板、命令、提示彈窗支援英文和簡體中文；內建 en / zh-CN / zh-TW 三種語言的筆記範本

## 🎬 詳細觀看紀錄

打開 **同步詳細觀看紀錄** 後，外掛會呼叫 Trakt 的 `/sync/history` 端點，把每集（或每部電影）的觀看時間戳直接渲染到筆記正文 —— 而且會隨你看新集一起更新：

```markdown
## 觀看紀錄
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

重看的集會用逗號分隔；按季 / 集編號排序。整個段落用 `%% trakt:watch-history %%` 標記包住 —— 外掛只更新標記之間的內容，**你在筆記其他地方手寫的內容一字不動**。

<!-- screenshot: watch-history -->

## 🌐 元數據本地化

把 **元數據語言** 設定改成你想要的，同步出來的筆記裡 title / overview / tagline / genres 都會透過 TMDB 翻譯過來（沒填 TMDB key 時回退到 Trakt 翻譯端點）。英文原文保留在 `trakt_original_*` 欄位：

```yaml
trakt_title: 黑暗騎士
trakt_original_title: The Dark Knight
trakt_genres:
  - 動作
  - 犯罪
  - 劇情
trakt_original_genres:
  - Action
  - Crime
  - Drama
trakt_metadata_language: zh-TW
```

標籤和 tag-note 路徑**永遠是英文** —— 你已有的 Dataview 查詢不會因為切換語言而失效。

<!-- screenshot: metadata-localization -->

## 🌍 雙語 UI 和翻譯過的範本

設定面板、命令面板、提示彈窗都支援 **English** 和 **簡體中文**。內建筆記範本提供英文、簡體中文 (`zh-CN`)、繁體中文 (`zh-TW` / `zh-HK`) 三種；其他語言代碼會回退到英文範本 —— 想用其他語言請手動改範本。

<!-- screenshot: bilingual-ui -->

## 🔄 多裝置同步

授權狀態（Trakt token、TMDB key、所有設定）保存在 vault 的 `.obsidian/plugins/obsidian-sync-trakt/data.json` 裡，跟隨你的 vault 同步走。在 Mac 上配一次，透過 Obsidian Sync（勾選 `Plugin data` 同步）、Syncthing、iCloud + 進階資料保護、或 Cryptomator 同步到 iPhone。**外掛不在任何伺服器儲存資料**。

## 🚀 快速開始

1. 透過 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 安裝 → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. 設定 → **Obsidian Sync Trakt** → 填 Trakt + TMDB API key（[設定指南](SETUP.zh-TW.md)）
3. 命令面板 → **Traktr: Sync**

## 📦 安裝

<details>
<summary><b>BRAT（推薦）</b></summary>

[BRAT](https://github.com/TfTHacker/obsidian42-brat) 讓 Obsidian 可以從任意 GitHub 倉庫直接安裝並自動更新外掛。

1. 在第三方外掛裡安裝並啟用 **Obsidian42 - BRAT**
2. 設定 → BRAT → **Add a beta plugin for testing**
3. 貼上：
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. 點 **Add Plugin** → 在第三方外掛裡啟用

之後每次 Obsidian 啟動 BRAT 會自動檢查更新並拉取新 release。

</details>

<details>
<summary><b>手動安裝</b></summary>

1. 從 [Releases](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) 下載 `main.js`、`manifest.json`、`styles.css`
2. 把三個檔案放到 `<你的-vault>/.obsidian/plugins/obsidian-sync-trakt/`
3. 設定 → 第三方外掛 → 啟用 **Obsidian Sync Trakt**

</details>

<details>
<summary><b>Obsidian 第三方外掛市集（待提交）</b></summary>

> ⚠️ 尚未上架 Obsidian 官方第三方外掛目錄。等被收錄後這條會變成推薦路徑。在那之前請用上方的 BRAT。

</details>

<details>
<summary><b>從原始碼建構</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # 產生 main.js
npm run lint
npm run test:i18n  # 跑煙霧測試
```

然後把 `main.js`、`manifest.json`、`styles.css` 複製到 `<vault>/.obsidian/plugins/obsidian-sync-trakt/`。

</details>

## 📚 文件

| 文件 | 用途 |
|---|---|
| [SETUP](SETUP.zh-TW.md) | Trakt + TMDB API 申請，首次設定，常見問題 |
| [MANUAL](MANUAL.zh-TW.md) | 完整設定參考、frontmatter 欄位、範本變數、同步行為 |
| [DEVELOPER](../DEVELOPER.md) | 架構概覽、資料流、擴充指南（僅英文） |
| [docs/i18n/](.) | README / SETUP / MANUAL 的 8 種語言翻譯 |

## 🗺️ 路線圖

- [x] 詳細的逐集觀看紀錄同步
- [x] 元數據本地化（TMDB + Trakt 翻譯回退）
- [x] 雙語外掛 UI（en + zh-CN）
- [x] 翻譯過的預設筆記範本（en + zh-CN + zh-TW）
- [ ] TMDB 元數據快取 —— 切換語言不重打 API
- [ ] 提交到 Obsidian 第三方外掛目錄
- [ ] 更多 UI 翻譯（ja / ko / fr / ...）按需增加

## 🤝 上游致謝

本外掛 fork 自 [**sarimabbas/traktr**](https://github.com/sarimabbas/traktr)（MIT 授權）。核心同步引擎、frontmatter / 範本結構、tag-note 系統全部直接繼承自上游專案。由衷感謝 [Sarim Abbas](https://github.com/sarimabbas) 的原始工作。

## 📄 授權

MIT —— 見 [LICENSE](../../LICENSE)。同時包含上游版權聲明（Sarim Abbas）和本 fork 的版權聲明（o1xhack），兩份都生效。

---

作者：[o1xhack](https://github.com/o1xhack)
