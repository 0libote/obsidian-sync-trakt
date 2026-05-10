# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**把你的 [Trakt.tv](https://trakt.tv) 觀看記錄變成一份高度本地化的 Markdown 庫 —— 帶逐集觀看時間戳、涵蓋 15+ 種語言的元數據，以及不會讓你的 vault 頻繁抖動的安靜增量同步。**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · **繁體中文** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ 為什麼用這個

- **詳細觀看紀錄** —— 每一集是哪一天幾點看的、有沒有重看，全都同步到筆記裡，每天追劇即時更新
- **涵蓋 15+ 種語言的元數據** —— 透過 TMDB 把 title / overview / tagline / genres 翻譯過來。內建預設涵蓋中文（簡體 / 繁體 / 港繁）、日文、韓文、法文、德文、西班牙文（西班牙 / 墨西哥）、葡萄牙文（巴西）、義大利文、俄文，再加一個自訂模式，可填任何 TMDB 支援的 BCP-47 語言代碼。英文原文始終保留在 `*_original_*` frontmatter 欄位
- **增量同步** _(0.2.0)_ —— 首次同步把本地 TMDB 快取 + Trakt 歷史狀態填好；之後每次同步只拉變化的部分。穩態同步時間從幾分鐘降到幾秒。詳見 [spec 0001](../specs/0001-incremental-sync.md)
- **安靜寫盤** _(0.3.0)_ —— 同步只重寫**內容真的變了**的筆記。看完一集後，1200 項的影庫只重寫 1 個筆記，而不是 1200 個 —— Obsidian Sync / iCloud / Syncthing 等多裝置同步層不再每次都重傳整個庫。詳見 [spec 0002](../specs/0002-diff-based-write.md)

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

## 🌍 外掛 UI 和筆記範本

上面的元數據本地化涵蓋很多語言；**外掛自身的 UI** 是另一條獨立、規模較小的軸。**設定面板、命令面板、提示彈窗**目前支援 **English** 和 **簡體中文**。**內建筆記範本**提供英文、簡體中文 (`zh-CN`)、繁體中文 (`zh-TW` / `zh-HK`) 三種；其他範本語言代碼會回退到英文範本 —— 暫時請手動改範本，或者 [開個 issue](https://github.com/o1xhack/obsidian-sync-trakt/issues) 申請加入預置翻譯。UI 語言按需擴展。

<!-- screenshot: bilingual-ui -->

## 🔄 多裝置同步

授權狀態（Trakt token、TMDB key、所有設定）保存在 vault 的 `.obsidian/plugins/obsidian-sync-trakt/data.json` 裡，跟隨你的 vault 同步走。在 Mac 上配一次，透過 Obsidian Sync（勾選 `Plugin data` 同步）、Syncthing、iCloud + 進階資料保護、或 Cryptomator 同步到 iPhone。**外掛不在任何伺服器儲存資料**。

## 📊 在 Obsidian Bases 裡檢視影庫

`trakt_poster_url` frontmatter 欄位**開箱即用**，配合 [Obsidian Bases](https://help.obsidian.md/bases)（Obsidian 1.9.3+）—— 在你同步出來的資料夾上建一個 database 檢視，海報會作為縮圖顯示：

- **卡片檢視**：打開 Display 設定 → 把 **Image property** 選成 `trakt_poster_url`
- **表格檢視**（1.9.4+）：加一個 formula 列，用 `image(note.trakt_poster_url)`

按 `trakt_type = "movie"` / `"show"` 過濾、按 `trakt_year` / `trakt_rating` / `trakt_my_rating` 排序、按 `trakt_genres` 分組都行。Dataview 查詢用的那套 frontmatter 屬性，Bases 檢視也能直接用 —— 沒有額外設定。

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
- [x] 涵蓋 15+ 種預設語言的元數據本地化 + 任何 TMDB 支援語言代碼的自訂模式
- [x] 雙語外掛 UI（en + zh-CN）；其他語言按需擴展
- [x] 翻譯過的預設筆記範本（en + zh-CN + zh-TW）
- [x] TMDB 元數據快取（0.2.0）—— 切換語言不重打 API，穩態同步幾秒鐘搞定
- [x] Trakt 歷史增量拉取（0.2.0）—— 只拉上次同步後的新觀看事件
- [x] Diff-based 寫盤（0.3.0）—— 只重寫真的變了的筆記，不再觸發跨裝置同步雪崩
- [ ] 提交到 Obsidian 第三方外掛目錄
- [ ] 更多 UI 翻譯（ja / ko / fr / ...）按需增加

## 🤝 致謝

本外掛最初受 [sarimabbas/traktr](https://github.com/sarimabbas/traktr)（MIT 授權）啟發，從中獲得了 Trakt OAuth 接入的最初腳手架。後續大量工作 —— 詳細觀看紀錄聚合、帶翻譯 fallback 鏈的元資料本地化、雙語 UI、帶限流和即時進度回饋的並發抓取、機器管理段落、翻譯感知的範本渲染器、多語言文件體系 —— 已經把程式碼庫重塑成了根本不同的架構。

感謝 [Sarim Abbas](https://github.com/sarimabbas) 提供了最初的起點。原作的 MIT 版權聲明完整保留在 [LICENSE](../../LICENSE) 中，與本專案自己的版權聲明並列。

## 📄 授權

MIT —— 見 [LICENSE](../../LICENSE)。

---

作者：[o1xhack](https://github.com/o1xhack)
