# Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.8.7%2B-7c3aed)](https://obsidian.md)

**把你的 [Trakt.tv](https://trakt.tv) 觀看記錄變成一份高度本地化的 Markdown 庫 —— 帶逐集觀看時間戳、涵蓋 15+ 種語言的元數據，以及不會讓你的 vault 頻繁抖動的安靜增量同步。**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · **繁體中文** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ 為什麼用這個

- **詳細觀看紀錄** —— 每一集是哪一天幾點看的、有沒有重看，全都同步到筆記裡，每天追劇即時更新
- **涵蓋 15+ 種語言的元數據** —— 透過 TMDB 把 title / overview / tagline / genres 翻譯過來。內建預設涵蓋中文（簡體 / 繁體 / 港繁）、日文、韓文、法文、德文、西班牙文（西班牙 / 墨西哥）、葡萄牙文（巴西）、義大利文、俄文，再加自訂模式可填任何 TMDB 支援的 locale。英文原文始終保留在 `*_original_*` frontmatter 欄位
- **11 種筆記範本語言** _(0.6.0)_ —— 內建手工翻譯的筆記範本，涵蓋 en + zh-CN + zh-TW + ja + ko + fr + de + it + es + pt-BR + ru。在新的範本語言下拉框裡選擇，隨時切換不會丟失你的自訂內容
- **Tab 式設定介面** _(0.6.0)_ —— 通用 / 筆記 / 同步 / Daily Notes 四個 tab。最後查看的 tab 按裝置記憶
- **Daily Notes 整合** _(0.7.0)_ —— 每次同步自動在你的 Daily Note 中插入當天事件（看了 / 加入想看 / 收藏 / 評分），按時間排序，跟隨你的範本語言。Marker 區間內的內容由外掛管理，**區間之外的內容絕不修改**。詳見 [spec 0006](../specs/0006-daily-notes-integration.md)
- **增量同步** _(0.2.0)_ —— 首次同步把本地 TMDB 快取 + Trakt 歷史狀態填好；之後每次同步只拉變化的部分。穩態同步時間從幾分鐘降到幾秒。詳見 [spec 0001](../specs/0001-incremental-sync.md)
- **安靜寫盤** _(0.3.0)_ —— 同步只重寫**內容真的變了**的筆記。看完一集後，1200 項的影庫只重寫 1 個筆記，而不是 1200 個 —— Obsidian Sync / iCloud / Syncthing 等多裝置同步層不再每次都重傳整個庫。詳見 [spec 0002](../specs/0002-diff-based-write.md)
- **按設定粒度的雲端開關** _(0.5.0)_ —— 每個設定項可單獨決定要不要跨裝置同步。例如 Mac 上每 30 分鐘自動同步、iPhone 上完全關閉 —— 互不打擾。詳見 [spec 0003](../specs/0003-device-local-settings.md)

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

上面的元數據本地化是一條軸，外掛自身的幾個介面是其他軸：

- **設定面板、命令面板、提示彈窗** 目前支援 **English** 和 **簡體中文**。其他 UI 語言按需擴展 —— 想貢獻的話歡迎 [開個 issue](https://github.com/o1xhack/obsidian-sync-trakt/issues)
- **內建筆記範本** _(0.6.0 從 3 種擴展到 11 種)_ —— 英文、簡體中文 (zh-CN)、繁體中文 (zh-TW / zh-HK)、日文、韓文、法文、德文、義大利文、西班牙文、葡萄牙文 (BR)、俄文。手工翻譯，不是機翻；段落標題、列表標籤、標點符號都按各語言習慣（日文用全形冒號、法文用空格冒號等）。範本語言下拉框只列這 11 種；不在列表的語言不再顯示（之前會靜默回退到英文，容易誤導用戶）

<!-- screenshot: bilingual-ui -->

## 📅 Daily Notes 整合 _(0.7.0)_

每次同步自動把當天事件按時間順序插入到你的 Daily Note 中 —— 看了的劇集、加入想看的、收藏的、打分的，全部包括：

```markdown
%% trakt:daily:start %%
10:00 — 看了 低智商犯罪 (2026) S1E16, S1E17
14:30 — 加入想看 黑暗騎士 (2008)
21:30 — 打分 9/10 重生 (2020)
%% trakt:daily:end %%
```

每種事件類型受對應的「同步來源」開關控制 —— 例如關掉「同步收藏」，收藏事件就不會出現在 Daily Notes 裡。動詞（`看了` / `視聴` / `시청` / `a regardé`…）跟隨你的**範本語言**設定，涵蓋全部 11 種 bundled 語言。

**安全契約**：marker 區間內的內容由外掛管理，**區間之外的內容絕不修改**。過去的日期是只增不改（已有的 marker 不會被覆蓋）；今天的內容每次同步都會刷新，讓晚上看的新內容能正確出現。在 **設定 → Daily Notes** 裡配置資料夾和檔案名格式（Moment.js 語法，例如 `YYYY-MM-DD` 或 `YYYY/YYYY.MM.DD`）。手動**回溯**按鈕最多支援 30 天。詳見 [spec 0006](../specs/0006-daily-notes-integration.md)。

## 🔄 多裝置同步

授權狀態（Trakt token、TMDB key、所有設定）保存在 vault 的 `.obsidian/plugins/sync-trakt/data.json` 裡，跟隨你的 vault 同步走。在 Mac 上配一次，透過 Obsidian Sync（勾選 `Plugin data` 同步）、Syncthing、iCloud + 進階資料保護、或 Cryptomator 同步到 iPhone。**外掛不在任何伺服器儲存資料**。

0.5.0 起，**任何單個設定都可以單獨退出跨裝置同步** —— 設定項旁邊有個小雲朵圖示可以切換（目前已開放給「啟動時同步」、「自動同步」、「自動同步間隔」、「外掛 UI 語言」四項）。適合「Mac 上 30 分鐘自動同步、iPhone 上不要」這種情境。

## 📊 在 Obsidian Bases 裡檢視影庫

`trakt_poster_url` frontmatter 欄位**開箱即用**，配合 [Obsidian Bases](https://help.obsidian.md/bases)（Obsidian 1.9.3+）—— 在你同步出來的資料夾上建一個 database 檢視，海報會作為縮圖顯示：

- **卡片檢視**：打開 Display 設定 → 把 **Image property** 選成 `trakt_poster_url`
- **表格檢視**（1.9.4+）：加一個 formula 列，用 `image(note.trakt_poster_url)`

按 `trakt_type = "movie"` / `"show"` 過濾、按 `trakt_year` / `trakt_rating` / `trakt_my_rating` 排序、按 `trakt_genres` 分組都行。Dataview 查詢用的那套 frontmatter 屬性，Bases 檢視也能直接用 —— 沒有額外設定。

## 🚀 快速開始

1. 設定 → 第三方外掛 → **瀏覽** → 搜尋 **Sync Trakt** → **安裝** → **啟用**
2. 設定 → **Sync Trakt** → 填 Trakt + TMDB API key（[設定指南](SETUP.zh-TW.md)）
3. 命令面板 → **Sync Trakt: Sync**

## 🔑 API key 各自解鎖什麼

外掛用到兩個 API。**Trakt 是必需的** —— 沒有它什麼都同步不了。**TMDB 是可選的**，但解鎖的恰好是大多數人安裝本外掛的真正動機。具體如下：

| 功能 | Trakt API<br/>_（必需）_ | TMDB API<br/>_（推薦）_ |
|---|:---:|:---:|
| 同步 Trakt 庫（watchlist、watched、favorites、ratings） | ✅ | — |
| 逐集觀看時間戳 | ✅ | — |
| title / overview / tagline 翻譯成你的語言 | ✅ 基礎 | ✅ 更高品質 |
| **genres 翻譯成你的語言** | ❌ | ✅ |
| **筆記內嵌入海報圖片** | ❌ | ✅ |

如果你只想看英文內容、也不在意海報，TMDB 可以留空 —— 光 Trakt 就夠。如果想要非英文的完整本地化（包括 genres 和海報），**請填 TMDB key**（[免費註冊](https://www.themoviedb.org/settings/api)）。貼上 key 之後，點旁邊的 **Test** 按鈕驗證是否有效，再做第一次同步。

→ [兩個 key 的完整設定教學](SETUP.zh-TW.md)

## 📦 安裝

<details open>
<summary><b>Obsidian 第三方外掛市集（推薦）</b></summary>

1. 設定 → 第三方外掛 → **瀏覽**
2. 搜尋 **Sync Trakt**
3. 點 **安裝** → **啟用**

外掛目錄頁：https://community.obsidian.md/plugins/sync-trakt

</details>

<details>
<summary><b>開發模式（從原始碼建構）</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # 產生 main.js
npm run lint
npm run test:i18n  # 跑煙霧測試
```

然後把 `main.js`、`manifest.json`、`styles.css` 複製到 `<vault>/.obsidian/plugins/sync-trakt/`。

</details>

<details>
<summary><b>本地測試（手動安裝）</b></summary>

1. 從 [Releases](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) 下載 `main.js`、`manifest.json`、`styles.css`
2. 把三個檔案放到 `<你的-vault>/.obsidian/plugins/sync-trakt/`
3. 設定 → 第三方外掛 → 啟用 **Sync Trakt**

</details>

## 📚 文件

| 文件 | 用途 |
|---|---|
| [SETUP](SETUP.zh-TW.md) | Trakt + TMDB API 申請，首次設定，常見問題 |
| [MANUAL](MANUAL.zh-TW.md) | 完整設定參考、frontmatter 欄位、範本變數、同步行為 |
| [DEVELOPER](../DEVELOPER.md) | 架構概覽、資料流、擴充指南（僅英文） |
| [docs/i18n/](.) | README / SETUP / MANUAL 的 8 種語言翻譯 |

## 🗺️ 路線圖

從 fork 算起的主要版本（按時間順序）：

- [x] **0.1** — 初始 fork。詳細的逐集觀看紀錄、TMDB + Trakt fallback 元數據本地化、雙語 UI（en + zh-CN）、翻譯過的筆記範本（en + zh-CN + zh-TW）、獨立的 plugin id 讓本外掛能跟上游 traktr 共存
- [x] **0.2** — 增量同步。持久化 TMDB 快取（stale-while-revalidate，90 天 TTL 帶抖動）+ Trakt 歷史狀態游標。穩態同步從幾分鐘降到幾秒。→ [spec 0001](../specs/0001-incremental-sync.md)
- [x] **0.3** — Diff-based 寫盤。只重寫 frontmatter 或 managed body 區間確實變了的筆記，多裝置同步層不再每次抖 1200 個檔案。0.3.x 還加了：TMDB API key 測試按鈕 + 元數據語言開啟但沒填 key 時的警告橫幅；針對本地化標題撞名的兩層檔案名 disambiguation（之前 5 部都叫「重生」的劇搶同一個檔案名的問題）。→ [spec 0002](../specs/0002-diff-based-write.md)
- [x] **0.4** — 提交準備。Plugin id 從 `obsidian-sync-trakt` 改成 `sync-trakt`（Obsidian 官方目錄 bot 拒絕含 obsidian 的 id）、`minAppVersion` 調到 1.6.6、首次啟動時透明自動遷移舊資料夾資料。→ [spec 0004](../specs/0004-obsidian-directory-submission.md)
- [x] **0.5** — 裝置本地設定 + 自動清理。每個設定項旁邊的雲朵圖示可單獨控制是否跨裝置同步；遷移後自動清理舊資料夾裡的 binary 檔案（保留 data.json 作為救命稻草），不再讓使用者看到兩個重複的外掛入口。→ [spec 0003](../specs/0003-device-local-settings.md)
- [x] **0.6** — Tab 式設定介面 + 11 種筆記範本語言。設定頁重構成 4 個 tab（通用 / 筆記 / 同步 / Daily Notes）；筆記範本從 3 種擴展到 11 種（新增 ja、ko、fr、de、it、es、pt-BR、ru，全部手工翻譯）；範本語言下拉框只列出已 bundled 的語言。→ [spec 0005](../specs/0005-settings-ui-tabs.md) + [spec 0007](../specs/0007-template-language-expansion.md)
- [x] **0.7** — Daily Notes 整合。每次同步自動把當天事件（看了 / 加入想看 / 收藏 / 評分）按時間順序寫進你的 Daily Note，跟隨範本語言。過去的日期只增不改，今天的內容隨時刷新。手動回溯按鈕支援過去 30 天。→ [spec 0006](../specs/0006-daily-notes-integration.md)
- [ ] **進行中** — 提交到 Obsidian 官方 [Community Plugins 外掛目錄](https://obsidian.md/plugins)。[PR #12757](https://github.com/obsidianmd/obsidian-releases/pull/12757) 審核中
- [ ] **未來** — 更多 UI 翻譯（目前 en + zh-CN）按需增加；更多 bundled 範本語言可按使用者請求新增

## 🤝 致謝

本外掛最初受 [sarimabbas/traktr](https://github.com/sarimabbas/traktr)（MIT 授權）啟發，從中獲得了 Trakt OAuth 接入的最初腳手架。後續大量工作 —— 詳細觀看紀錄聚合、帶翻譯 fallback 鏈的元資料本地化、雙語 UI、帶限流和即時進度回饋的並發抓取、機器管理段落、翻譯感知的範本渲染器、多語言文件體系 —— 已經把程式碼庫重塑成了根本不同的架構。

感謝 [Sarim Abbas](https://github.com/sarimabbas) 提供了最初的起點。原作的 MIT 版權聲明完整保留在 [LICENSE](../../LICENSE) 中，與本專案自己的版權聲明並列。

## 📄 授權

MIT —— 見 [LICENSE](../../LICENSE)。

---

作者：[o1xhack](https://github.com/o1xhack)
