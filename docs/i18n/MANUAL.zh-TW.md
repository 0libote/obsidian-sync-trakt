# Obsidian Sync Trakt — 使用手冊

> 🌐 [English](../MANUAL.md) · [简体中文](MANUAL.zh-CN.md) · **繁體中文** · [日本語](MANUAL.ja.md)

## 1. 它是什麼

本外掛從 [Trakt.tv](https://trakt.tv) 拉取你的資料，在 vault 裡為每部電影 /
電視劇建立一篇 Markdown 筆記。每篇筆記包含：

- **Frontmatter** —— 結構化元資料（標題、年份、類型、評分、觀看狀態、Trakt/IMDB/TMDB ID、海報 URL、同步時間戳）
- **正文** —— 由可自訂的範本渲染，範本用 `{{變數}}` 佔位符
- **標籤** —— 自動從類型、類型分類、同步來源生成（選填）
- **Tag notes** —— 通往主題檔案的 wikilink，建構筆記圖譜（選填）
- **觀看紀錄** —— 選用段落，從 Trakt 的 `/sync/history` 端點拉取每集（或每部電影）的觀看時間戳

電影和劇集存在同一個資料夾下，靠 frontmatter 欄位 `trakt_type`（`movie` 或 `show`）區分。Dataview 查詢可按任一類型過濾。

本外掛 fork 自 [sarimabbas/traktr](https://github.com/sarimabbas/traktr)；致謝和新增內容詳見 README。

---

## 2. 安裝

手動安裝：

1. 從 [最新 release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) 下載 `main.js`、`manifest.json`、`styles.css`
2. 在你的 vault 裡建立資料夾 `.obsidian/plugins/obsidian-sync-trakt/`
3. 把三個檔案複製進去
4. 開啟 Obsidian → 設定 → 第三方外掛 → 啟用 **Obsidian Sync Trakt**

或透過 [BRAT](https://github.com/TfTHacker/obsidian42-brat)：新增 beta 外掛 `o1xhack/obsidian-sync-trakt`。

---

## 3. 初始設定

### 3a. 建立 Trakt 應用

1. 登入 [trakt.tv](https://trakt.tv)，去 **Settings → Your API Apps → New Application**
2. 取個名字（比如 "Obsidian Sync Trakt"）
3. **Redirect URI** 填 `urn:ietf:wg:oauth:2.0:oob`
4. 儲存。複製 **Client ID** 和 **Client Secret**

### 3b.（選填）申請 TMDB API key

海報圖片從 [The Movie Database](https://themoviedb.org) 拉取。免費 API key 即可。不申請的話筆記不帶海報。

1. 在 themoviedb.org 註冊帳號
2. **Settings → API → Create → Developer**
3. 複製 **API Key (v3 auth)**

完整的申請流程見 [SETUP.zh-TW.md](SETUP.zh-TW.md)。

---

## 4. 授權流程

1. 開啟 **設定 → Traktr**
2. 貼上 **Trakt Client ID** 和 **Client Secret**
3. 點 **Connect to Trakt** —— 彈窗顯示一個 URL 和一個簡短的裝置碼
4. 在瀏覽器開啟 URL，輸入裝置碼，授權
5. 彈窗輪詢 Trakt，授權完成後自動關閉
6. Connection status 欄位顯示 "Connected to Trakt"

要撤銷存取，點設定面板裡的 **Disconnect**，或執行命令 **Traktr: Disconnect account**。

每次同步前 access token 自動更新（無需手動重新授權）。

---

## 5. 設定參考

### Authentication

| 設定項 | 說明 |
|---|---|
| Trakt Client ID | 來自你的 Trakt API 應用。 |
| Trakt Client Secret | 來自同一個應用頁面。 |
| Connection status | 顯示目前狀態；提供連線或斷開按鈕。 |

### TMDB（海報圖片）

| 設定項 | 預設值 | 說明 |
|---|---|---|
| TMDB API key | _(空)_ | 選填。留空則跳過海報圖片。 |
| Poster size | `w500` | 從 TMDB 拉取的圖片寬度變體。可選：w92、w154、w185、w342、w500、w780、original。 |
| TMDB cache TTL | `90 天` | 快取的 TMDB 元數據多久之後會被重新驗證。**永不過期**則保持快取不變（只能手動清空）。過期條目會立即返回舊值並在背景非同步刷新，同步永遠不會被阻塞。每條目附加 ±5 天隨機抖動，1000+ 條目不會同一天集體過期。詳見 [spec 0001](../specs/0001-incremental-sync.md) §A。 |
| Clear cache | _(按鈕)_ | 丟棄所有已快取的元數據。下次同步會從 TMDB 重新拉取全部條目（大庫可能需要幾分鐘）。設定項的描述裡會顯示當前快取的條目數。 |

### Localization

選填。把同步筆記裡的 `title`、`overview`、`tagline`、`genres` 翻譯過來。標籤和 tag-note wikilink **始終保持英文**，已有的 Dataview 查詢不受影響。

| 設定項 | 預設值 | 說明 |
|---|---|---|
| Metadata language | `Default (English / Trakt original)` | 翻譯目標語言。選 `Default` 關閉本地化；已有筆記保持與 i18n 之前完全一致。預設涵蓋簡體 / 繁體中文、日文、韓文、英文變體、法文、德文、西班牙文（ES/MX）、巴西葡萄牙文、義大利文、俄文；選 `Custom` 輸入任意 BCP 47 代碼（比如 `tr-TR`）。 |
| Custom language code | `(空)` | 僅在上面選 `Custom` 時顯示。 |

啟用本地化後，同步按以下順序解析翻譯：

1. **TMDB**（首選）—— 一次合併請求拿回本地化的 `title` / `overview` / `tagline` / `genres` 加上海報 URL。需要 TMDB API key。
2. **Trakt `/translations/{lang}`**（回退）—— 沒填 TMDB API key 時使用。只覆蓋 `title` / `overview` / `tagline`，`genres` 保持英文。
3. **英文原文** —— 兩個 API 都沒有翻譯時按欄位回退。

### Notes

| 設定項 | 預設值 | 說明 |
|---|---|---|
| Notes folder | `trakt` | 所有筆記的存放資料夾。不存在時自動建立。 |
| Filename template | `{{title}} ({{year}})` | 筆記檔名範本。變數：`{{title}}`、`{{year}}`、`{{imdb_id}}`、`{{trakt_id}}`。 |
| Property prefix | `trakt_` | 外掛寫入的所有 frontmatter 屬性的前綴（比如 `trakt_title`、`trakt_watched`）。留空表示不加前綴。 |

### Note templates

| 設定項 | 預設值 | 說明 |
|---|---|---|
| Movie note template | _(見下文)_ | 電影筆記正文的 Markdown 範本。使用 `{{變數}}` 語法。 |
| TV show note template | _(見下文)_ | 劇集筆記正文的 Markdown 範本。使用 `{{變數}}` 語法。 |

兩個範本都有 **Reset to default** 按鈕。

**常見自訂：**

- **標題（Title）** —— 沒有獨立的「Title 範本」欄位。標題既是筆記的**檔名**（由 **Filename template** 設定控制），也透過 `{{title}}` 變數暴露給正文範本。如果你想在每篇筆記頂部顯示標題作為一級標題，**在 Movie / TV show 範本開頭加一行 `# {{title}}` 即可**。
- **標語（Tagline）** —— 內建的電影範本把 tagline 渲染成引用塊（`> {{tagline}}`）。**直接修改範本文字就能改格式** —— 比如改成 `**標語：** *{{tagline}}*` 做行內標籤，或者整行刪掉。劇集在 Trakt 資料裡沒有 tagline，所以劇集範本不參考它。
- **其他** —— [§ 6.3 範本變數](#範本變數) 裡所有變數都可用；可以自由刪改 / 重排各段落。改壞了點 **Reset to default** 重新開始。

### Tags

| 設定項 | 預設值 | 說明 |
|---|---|---|
| Add tags | on | 每次同步在 frontmatter 裡新增 Obsidian 標籤（比如 `#trakt/genre/action`）。 |
| Tag prefix | `trakt` | 生成標籤的前綴（比如 `trakt` → `#trakt/movie`、`#trakt/genre/action`）。 |

### Tag notes

Tag notes 是你筆記之間相互連結的主題檔案，建構關係圖譜。**用標籤或 tag notes 二選一即可**，兩者並用是冗餘的。

| 設定項 | 預設值 | 說明 |
|---|---|---|
| Add tag notes to frontmatter | off | 每次同步在 frontmatter 加一個 wikilink 列表屬性（比如 `[[trakt/genre/action]]`）。或者保持關閉並在範本裡用 `{{tag_notes}}` 把連結放在正文中。 |
| Create tag notes | off | 自動建立不存在的空 tag note 檔案。 |
| Tag notes folder | `trakt` | tag note 檔案的資料夾。用於 frontmatter 連結、檔案建立、`{{tag_notes}}` 範本變數。 |

### Sync sources

| 設定項 | 預設值 | 說明 |
|---|---|---|
| Sync watchlist | on | 你 Trakt watchlist 上的內容（想看的）。 |
| Sync favorites | on | 你標記為收藏的內容。 |
| Sync watch history | off | 你看過的內容。每個項目帶播放次數和最近觀看日期。可能資料量大。 |
| Sync watch history (detailed) | off | 在上面的開關之上疊加。呼叫 Trakt 的 `/sync/history` 端點，透過 `{{watch_history}}` 範本變數在筆記正文裡顯示每集（或每部電影）的觀看時間戳。**0.2.0 起增量同步** —— 之後每次同步只拉取自上次同步以來的新事件，加上按下方配置的週期定時全量刷新一次以檢測刪除。預設 OFF；只在 "Sync watch history" 開啟時顯示。 |
| History full-refresh interval (days) | `7` | _(僅在「Sync watch history (detailed)」開啟時顯示)_ 外掛多久重新拉取一次完整 Trakt 觀看歷史（而不只是新事件），用於檢測 Trakt 那邊的刪除。值越小，刪除檢測越快，但偶爾有一次慢同步。 |
| Clear history state | _(按鈕)_ | _(僅在詳細同步開啟時顯示)_ 丟棄本地聚合的觀看歷史。下次同步會從頭重建。描述裡會顯示目前追蹤的電影 / 劇集 / 事件數。 |
| Sync ratings | off | 你打過分的內容（1-10）。 |

### Sync behavior

| 設定項 | 預設值 | 說明 |
|---|---|---|
| Sync movies | on | 同步包含電影。 |
| Sync TV shows | on | 同步包含劇集。 |
| Sync on startup | off | Obsidian 啟動時自動同步（延遲 5 秒）。 |
| Auto-sync | off | 後台定時同步。 |
| Auto-sync interval | 60 min | 自動同步頻率（5-360 分鐘）。僅在自動同步開啟時顯示。 |
| Overwrite existing note body | off | **關閉**時只更新 frontmatter，正文保留。**開啟**時每次同步從範本重新產生整個筆記 —— 你對正文的修改會永久遺失。 |
| Remove notes for deleted items | off | **開啟**時，已不在任何啟用同步來源裡的項目對應的筆記會被移到資源回收筒。 |

### Reset

**Reset to defaults** 把所有設定恢復為預設值。認證憑證和 TMDB API key 會保留。

---

## 6. 筆記格式

### Frontmatter 欄位

下面所有欄位都加配置的 **Property prefix**（預設 `trakt_`）。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `trakt_title` | string | 電影或劇集的標題。 |
| `trakt_year` | number | 發行年份。 |
| `trakt_type` | `movie` \| `show` | 內容類型。 |
| `trakt_id` | number | Trakt 數字 ID。 |
| `trakt_slug` | string | Trakt URL slug。 |
| `trakt_imdb_id` | string | IMDB ID（比如 `tt1234567`）。 |
| `trakt_tmdb_id` | number | TMDB 數字 ID。 |
| `trakt_tvdb_id` | number | TVDB ID（僅劇集）。 |
| `trakt_genres` | list | 類型分類列表。 |
| `trakt_runtime` | number | 時長，分鐘（劇集是每集時長）。 |
| `trakt_certification` | string | 年齡分級（比如 `PG-13`）。 |
| `trakt_rating` | number | Trakt 社群評分（0-10）。 |
| `trakt_votes` | number | Trakt 投票數。 |
| `trakt_country` | string | 出品國代碼。 |
| `trakt_language` | string | 主要語言代碼。 |
| `trakt_status` | string | 狀態（比如 `released`、`ended`、`returning series`）。 |
| `trakt_overview` | string | 劇情簡介。 |
| `trakt_released` | string | 上映日期（僅電影，YYYY-MM-DD）。 |
| `trakt_tagline` | string | 標語（僅電影）。 |
| `trakt_network` | string | 播出平台（僅劇集）。 |
| `trakt_aired_episodes` | number | 已播出集數（僅劇集）。 |
| `trakt_first_aired` | string | 首播日期（僅劇集，YYYY-MM-DD）。 |
| `trakt_watchlist` | boolean | 同步自 watchlist 時存在。 |
| `trakt_watchlist_added_at` | string | 加入 watchlist 的 ISO 時間戳。 |
| `trakt_watched` | boolean | 同步自觀看紀錄時存在。 |
| `trakt_plays` | number | 觀看 / 播放次數。 |
| `trakt_last_watched_at` | string | 最近觀看的 ISO 時間戳。 |
| `trakt_episodes_watched` | number | 已觀看集數（僅劇集）。 |
| `trakt_favorite` | boolean | 同步自收藏時存在。 |
| `trakt_favorited_at` | string | 收藏的 ISO 時間戳。 |
| `trakt_my_rating` | number | 你的個人評分（1-10）。 |
| `trakt_rated_at` | string | 評分的 ISO 時間戳。 |
| `trakt_url` | string | Trakt 頁面 URL。 |
| `trakt_imdb_url` | string | IMDB 頁面 URL。 |
| `trakt_poster_url` | string | TMDB 海報圖片 URL。 |
| `trakt_synced_at` | string | 同步最近一次**真正修改這條筆記**的 ISO 時間戳。0.3.0 起只在筆記內容實際有變化時才更新 —— 不是每次 sync 都刷新。可作為 Bases / Dataview「最近變更」視圖的排序鍵。 |
| `trakt_tag_notes` | list | tag note 檔案的 wikilink（"Add tag notes to frontmatter" 開啟時）。 |
| `tags` | list | 自動產生的 Obsidian 標籤（"Add tags" 開啟時）。 |
| `trakt_original_title` | string | 英文 / 源語言標題。僅在 **Metadata language** 設定時存在。 |
| `trakt_original_overview` | string | 英文 / 源語言劇情簡介。僅在 **Metadata language** 設定時存在。 |
| `trakt_original_tagline` | string | 英文 / 源語言標語（僅電影）。僅在 **Metadata language** 設定時存在。 |
| `trakt_original_genres` | list | 英文 / 源語言類型分類列表。僅在 **Metadata language** 設定時存在。 |
| `trakt_metadata_language` | string | 目前活躍的語言代碼（比如 `zh-TW`）。僅在 **Metadata language** 設定時存在。 |

### 自動產生的標籤

預設標籤前綴 `trakt`：

- `#trakt/movie` 或 `#trakt/show`
- 每個類型分類產生一個 `#trakt/genre/<genre>`
- 在 watchlist 上：`#trakt/watchlist`
- 看過：`#trakt/watched`
- 收藏：`#trakt/favorite`
- 評過分：`#trakt/rated`

### 範本變數

筆記正文範本用 `{{變數}}` 語法。可用變數：

| 變數 | 說明 |
|---|---|
| `{{title}}` | 標題 |
| `{{year}}` | 發行年份 |
| `{{type}}` | `movie` 或 `show` |
| `{{overview}}` | 劇情簡介 |
| `{{genres}}` | 逗號分隔的類型分類列表 |
| `{{runtime}}` | 時長（分鐘） |
| `{{trakt_rating}}` | 社群評分 |
| `{{trakt_votes}}` | 投票數 |
| `{{certification}}` | 年齡分級 |
| `{{country}}` | 國家代碼 |
| `{{language}}` | 語言代碼 |
| `{{status}}` | 發行 / 播出狀態 |
| `{{trakt_id}}` | Trakt 數字 ID |
| `{{trakt_slug}}` | Trakt slug |
| `{{imdb_id}}` | IMDB ID |
| `{{tmdb_id}}` | TMDB ID |
| `{{tvdb_id}}` | TVDB ID |
| `{{trakt_url}}` | Trakt URL |
| `{{imdb_url}}` | IMDB URL |
| `{{poster_url}}` | 海報圖片 URL（沒填 TMDB key 時為空；該行從輸出中省略） |
| `{{tag_notes}}` | 逗號分隔的 tag note wikilink（無論 tag notes 設定如何始終可用） |
| `{{tagline}}` | 標語（電影） |
| `{{released}}` | 上映日期（電影） |
| `{{network}}` | 播出平台（劇集） |
| `{{aired_episodes}}` | 已播出集數（劇集） |
| `{{first_aired}}` | 首播日期（劇集） |
| `{{watchlist}}` | 在 watchlist 上時為 `true` |
| `{{watchlist_added_at}}` | 加入 watchlist 的時間戳 |
| `{{watched}}` | 看過時為 `true` |
| `{{plays}}` | 播放次數 |
| `{{last_watched_at}}` | 最近觀看日期 |
| `{{episodes_watched}}` | 已觀看集數（劇集） |
| `{{favorite}}` | 收藏時為 `true` |
| `{{favorited_at}}` | 收藏時間戳 |
| `{{my_rating}}` | 你的評分（1-10） |
| `{{rated_at}}` | 評分時間戳 |
| `{{original_title}}` | 英文 / 源語言標題。即使本地化關閉也可用（此時等於 `{{title}}`）。 |
| `{{original_overview}}` | 英文 / 源語言劇情簡介。始終可用。 |
| `{{original_tagline}}` | 英文 / 源語言標語（電影）。始終可用。 |
| `{{original_genres}}` | 英文 / 源語言類型列表，逗號分隔。始終可用。 |
| `{{metadata_language}}` | 活躍的語言代碼，本地化關閉時為 `""`。 |
| `{{watch_history}}` | **Sync watch history (detailed)** 開啟時是完整的 **觀看紀錄** 段落（`## 標題` + bullet 列表）；否則為空字串。標題文字按你的 **Note template language** 設定（English / 简体中文 / 繁體中文）。 |
| `{{watch_history_list}}` | 內容和 `{{watch_history}}` 相同但不帶標題行。如果你想在自訂範本裡自己寫標題用這個。 |

### 觀看紀錄的渲染

**Sync watch history (detailed)** 啟用後，每篇看過的筆記正文裡會出現一個 `## 觀看紀錄` 段落，列出每個觀看事件：

劇集 —— 每集一個 bullet，重看的集時間戳逗號分隔：

```markdown
## 觀看紀錄
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

電影 —— 每次觀看一行：

```markdown
## 觀看紀錄
- 2023-12-25 19:00
- 2024-06-10 22:30
- 2025-02-14 20:15
```

時間戳按你的本地時區格式化（Trakt 存的是 UTC，渲染時轉成本地）。劇集按季 → 集編號排序；同集內的時間戳按時間順序排。

---

## 7. 同步行為

### 建立 vs 更新

- **新項目**（沒有匹配 `trakt_type` + `trakt_id` 的現有筆記）：用完整範本建立筆記。
- **已存在項目**：行為取決於 **Overwrite existing note body** 設定：
  - **關閉**（預設）：只更新 frontmatter；`---` 下面的所有內容保持不變，你的個人筆記得以保留。
  - **開啟**：整篇筆記（frontmatter + 正文）從範本重新產生 —— 正文修改會遺失。

### 刪除

啟用 **Remove notes for deleted items** 後，每次同步結束時，組合 `type:id` 不在任何啟用同步來源裡的筆記會被移到系統資源回收筒。

### 切換語言

切換 **Metadata language** 然後再同步：

- frontmatter 用新語言重寫；`trakt_original_*` 欄位始終保留英文值。
- 如果 **filename template** 裡包含 `{{title}}`，下次同步時所有筆記會被重新命名成新語言的標題。Obsidian 的連結更新會自動修復 wikilink，但**先備份你的 vault**。
- 想讓檔名跨語言切換保持穩定，**在切換語言前**把範本改成 `{{original_title}} ({{year}})`。
- 標籤（`#trakt/genre/...`）和 tag-note wikilink（`[[trakt/genre/...]]`）始終用原始英文類型分類，所以已有的 Dataview 查詢切換語言後也能正常運作。
- 切回 **Default (English / Trakt original)** 時 frontmatter 改回英文；下次同步不再寫 `trakt_original_*` 和 `trakt_metadata_language` 欄位，所以這些欄位會留在已有筆記裡直到你手動刪除或重新產生筆記（開啟 **Overwrite existing note body** 跑一次同步可完全重生）。

### 跑同步

- **手動**：命令 **Traktr: Sync**（命令面板可存取）
- **啟動時**：在設定裡啟用 **Sync on startup**（Obsidian 載入後 5 秒觸發）
- **定時**：啟用 **Auto-sync** 並設定間隔
- **強制全量歷史刷新**：命令 **Traktr: Force full watch-history refresh** —— 跳過週期間隔，立刻重新拉取整個 Trakt 歷史。當你剛在 Trakt 上刪了一個錯誤的 scrobble、想立刻讓外掛檢測到，可以用這個
- **清空 TMDB 快取**：命令 **Traktr: Clear TMDB metadata cache** —— 清空所有已快取的 TMDB 條目。下次同步會從 TMDB 重新拉取所有元數據。和 Settings → TMDB → **Clear cache** 按鈕等效

### 同步為什麼這麼快（0.2.0+）

第一次同步把本地快取填好之後，後續同步的 API 呼叫數只取決於真正變了的內容：

- **TMDB 元數據快取**跨同步、跨裝置保留。一部電影的標題 / 海報 / 簡介只拉一次，之後一直複用，直到 TTL 過期或你手動 Clear。**典型同步 ~5-10 次 TMDB 呼叫，而不是 ~1200 次**
- **Trakt 歷史增量拉取**用 `?start_at=<上次同步時間>`。一週的新觀看通常一頁就夠（1 次 API 呼叫）。每隔 `History full-refresh interval (days)` 週期做一次全量重拉以檢測刪除

完整設計原理見 [`specs/0001-incremental-sync.md`](../specs/0001-incremental-sync.md)。

### Dataview 查詢範例

按類型過濾：
```dataview
TABLE trakt_year, trakt_rating, trakt_watched
FROM "trakt"
WHERE trakt_type = "movie"
SORT trakt_rating DESC
```

只顯示收藏：
```dataview
TABLE trakt_year, trakt_my_rating
FROM "trakt"
WHERE trakt_favorite = true
SORT trakt_my_rating DESC
```

顯示你的 watchlist：
```dataview
TABLE trakt_year, trakt_type, trakt_genres
FROM "trakt"
WHERE trakt_watchlist = true
SORT trakt_year DESC
```
