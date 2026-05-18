# Sync Trakt — 用户手册

> 🌐 [English](../MANUAL.md) · **简体中文** · [繁體中文](MANUAL.zh-TW.md) · [日本語](MANUAL.ja.md)

## 1. 它是什么

本插件从 [Trakt.tv](https://trakt.tv) 拉取你的数据，在 vault 里为每部电影 /
电视剧创建一篇 Markdown 笔记。每篇笔记包含：

- **Frontmatter** —— 结构化元数据（标题、年份、类型、评分、观看状态、Trakt/IMDB/TMDB ID、海报 URL、同步时间戳）
- **正文** —— 由可自定义的模板渲染，模板用 `{{变量}}` 占位符
- **标签** —— 自动从类型、类型分类、同步来源生成（可选）
- **Tag notes** —— 通往主题文件的 wikilink，构建笔记图谱（可选）
- **观看记录** —— 可选段落，从 Trakt 的 `/sync/history` 端点拉取每集（或每部电影）的观看时间戳

电影和剧集存在同一个文件夹下，靠 frontmatter 字段 `trakt_type`（`movie` 或 `show`）区分。Dataview 查询可按任一类型过滤。

本插件 fork 自 [sarimabbas/traktr](https://github.com/sarimabbas/traktr)；致谢和新增内容详见 README。

---

## 2. 安装

手动安装：

1. 从 [最新 release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) 下载 `main.js`、`manifest.json`、`styles.css`
2. 在你的 vault 里创建文件夹 `.obsidian/plugins/obsidian-sync-trakt/`
3. 把三个文件复制进去
4. 打开 Obsidian → 设置 → 第三方插件 → 启用 **Sync Trakt**

或通过 [BRAT](https://github.com/TfTHacker/obsidian42-brat)：添加 beta 插件 `o1xhack/obsidian-sync-trakt`。

---

## 3. 初始配置

### 3a. 创建 Trakt 应用

1. 登录 [trakt.tv](https://trakt.tv)，去 **Settings → Your API Apps → New Application**
2. 起个名字（比如 "Sync Trakt"）
3. **Redirect URI** 填 `urn:ietf:wg:oauth:2.0:oob`
4. 保存。复制 **Client ID** 和 **Client Secret**

### 3b.（可选）申请 TMDB API key

海报图片从 [The Movie Database](https://themoviedb.org) 拉取。免费 API key 即可。不申请的话笔记不带海报。

1. 在 themoviedb.org 注册账号
2. **Settings → API → Create → Developer**
3. 复制 **API Key (v3 auth)**

完整的申请流程见 [SETUP.zh-CN.md](SETUP.zh-CN.md)。

---

## 4. 授权流程

1. 打开 **设置 → Traktr**
2. 粘贴 **Trakt Client ID** 和 **Client Secret**
3. 点 **Connect to Trakt** —— 弹窗显示一个 URL 和一个简短的设备码
4. 在浏览器打开 URL，输入设备码，授权
5. 弹窗轮询 Trakt，授权完成后自动关闭
6. Connection status 字段显示 "Connected to Trakt"

要撤销访问，点设置面板里的 **Disconnect**，或运行命令 **Traktr: Disconnect account**。

每次同步前 access token 自动刷新（无需手动重新授权）。

---

## 5. 设置参考

### Authentication

| 设置项 | 说明 |
|---|---|
| Trakt Client ID | 来自你的 Trakt API 应用。 |
| Trakt Client Secret | 来自同一个应用页面。 |
| Connection status | 显示当前状态；提供连接或断开按钮。 |

### TMDB（海报图片）

| 设置项 | 默认值 | 说明 |
|---|---|---|
| TMDB API key | _(空)_ | 可选。留空则跳过海报图片。 |
| Poster size | `w500` | 从 TMDB 拉取的图片宽度变体。可选：w92、w154、w185、w342、w500、w780、original。 |
| TMDB cache TTL | `90 天` | 缓存的 TMDB 元数据多久之后会被重新验证。**永不过期**则保持缓存不变（只能手动清空）。过期条目会立即返回旧值并在后台异步刷新，同步永远不会被阻塞。每条目附加 ±5 天随机抖动，1000+ 条目不会同一天集体过期。详见 [spec 0001](../specs/0001-incremental-sync.md) §A。 |
| Clear cache | _(按钮)_ | 丢弃所有已缓存的元数据。下次同步会从 TMDB 重新拉取全部条目（大库可能需要几分钟）。设置项的描述里会显示当前缓存的条目数。 |

### Localization

可选。把同步笔记里的 `title`、`overview`、`tagline`、`genres` 翻译过来。标签和 tag-note wikilink **始终保持英文**，已有的 Dataview 查询不受影响。

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Metadata language | `Default (English / Trakt original)` | 翻译目标语言。选 `Default` 关闭本地化；已有笔记保持与 i18n 之前完全一致。预设涵盖简体 / 繁体中文、日文、韩文、英文变体、法文、德文、西班牙文（ES/MX）、巴西葡萄牙文、意大利文、俄文；选 `Custom` 输入任意 BCP 47 代码（比如 `tr-TR`）。 |
| Custom language code | `(空)` | 仅在上面选 `Custom` 时显示。 |

启用本地化后，同步按以下顺序解析翻译：

1. **TMDB**（首选）—— 一次合并请求拿回本地化的 `title` / `overview` / `tagline` / `genres` 加上海报 URL。需要 TMDB API key。
2. **Trakt `/translations/{lang}`**（回退）—— 没填 TMDB API key 时使用。只覆盖 `title` / `overview` / `tagline`，`genres` 保持英文。
3. **英文原文** —— 两个 API 都没有翻译时按字段回退。

### Notes

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Notes folder | `trakt` | 所有笔记的存放文件夹。不存在时自动创建。 |
| Filename template | `{{title}} ({{year}})` | 笔记文件名模板。变量：`{{title}}`、`{{year}}`、`{{imdb_id}}`、`{{trakt_id}}`。 |
| Property prefix | `trakt_` | 插件写入的所有 frontmatter 属性的前缀（比如 `trakt_title`、`trakt_watched`）。留空表示不加前缀。 |

### Note templates

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Movie note template | _(见下文)_ | 电影笔记正文的 Markdown 模板。使用 `{{变量}}` 语法。 |
| TV show note template | _(见下文)_ | 剧集笔记正文的 Markdown 模板。使用 `{{变量}}` 语法。 |

两个模板都有 **Reset to default** 按钮。

**常见自定义：**

- **标题（Title）** —— 没有独立的"Title 模板"字段。标题既是笔记的**文件名**（由 **Filename template** 设置控制），也通过 `{{title}}` 变量暴露给正文模板。如果你想在每篇笔记顶部显示标题作为一级标题，**在 Movie / TV show 模板开头加一行 `# {{title}}` 即可**。
- **标语（Tagline）** —— 内置的电影模板把 tagline 渲染成引用块（`> {{tagline}}`）。**直接修改模板文本就能改格式** —— 比如改成 `**标语：** *{{tagline}}*` 做行内标签，或者整行删掉。剧集在 Trakt 数据里没有 tagline，所以剧集模板不引用它。
- **其他** —— [§ 6.3 模板变量](#模板变量) 里所有变量都可用；可以自由删改 / 重排各段落。改坏了点 **Reset to default** 重新开始。

### Tags

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Add tags | on | 每次同步在 frontmatter 里添加 Obsidian 标签（比如 `#trakt/genre/action`）。 |
| Tag prefix | `trakt` | 生成标签的前缀（比如 `trakt` → `#trakt/movie`、`#trakt/genre/action`）。 |

### Tag notes

Tag notes 是你笔记之间相互链接的主题文件，构建关系图谱。**用标签或 tag notes 二选一即可**，两者并用是冗余的。

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Add tag notes to frontmatter | off | 每次同步在 frontmatter 加一个 wikilink 列表属性（比如 `[[trakt/genre/action]]`）。或者保持关闭并在模板里用 `{{tag_notes}}` 把链接放在正文中。 |
| Create tag notes | off | 自动创建不存在的空 tag note 文件。 |
| Tag notes folder | `trakt` | tag note 文件的文件夹。用于 frontmatter 链接、文件创建、`{{tag_notes}}` 模板变量。 |

### Sync sources

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Sync watchlist | on | 你 Trakt watchlist 上的内容（想看的）。 |
| Sync favorites | on | 你标记为收藏的内容。 |
| Sync watch history | off | 你看过的内容。每个条目带播放次数和最近观看日期。可能数据量大。 |
| Sync watch history (detailed) | off | 在上面的开关之上叠加。调用 Trakt 的 `/sync/history` 端点，通过 `{{watch_history}}` 模板变量在笔记正文里显示每集（或每部电影）的观看时间戳。**0.2.0 起增量同步** —— 之后每次同步只拉取自上次同步以来的新事件，加上按下方配置的周期定时全量刷新一次以检测删除。默认 OFF；只在 "Sync watch history" 开启时显示。 |
| History full-refresh interval (days) | `7` | _(仅在「Sync watch history (detailed)」开启时显示)_ 插件多久重新拉取一次完整 Trakt 观看历史（而不只是新事件），用于检测 Trakt 那边的删除。值越小，删除检测越快，但偶尔有一次慢同步。 |
| Clear history state | _(按钮)_ | _(仅在详细同步开启时显示)_ 丢弃本地聚合的观看历史。下次同步会从头重建。描述里会显示当前跟踪的电影 / 剧集 / 事件数。 |
| Sync ratings | off | 你打过分的内容（1-10）。 |

### Sync behavior

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Sync movies | on | 同步包含电影。 |
| Sync TV shows | on | 同步包含剧集。 |
| Sync on startup | off | Obsidian 启动时自动同步（延迟 5 秒）。 |
| Auto-sync | off | 后台定时同步。 |
| Auto-sync interval | 60 min | 自动同步频率（5-360 分钟）。仅在自动同步开启时显示。 |
| Overwrite existing note body | off | **关闭**时只更新 frontmatter，正文保留。**开启**时每次同步从模板重新生成整个笔记 —— 你对正文的修改会永久丢失。 |
| Remove notes for deleted items | off | **开启**时，已不在任何启用同步来源里的条目对应的笔记会被移到回收站。 |

### Daily Notes

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Enable Daily Notes | off | 允许插件把观看、想看、收藏、评分事件写入已存在的 Daily Note 文件。不会创建缺失的 Daily Note 文件。 |
| Daily Notes folder | _(blank)_ | Daily Note 文件所在文件夹。留空表示 vault 根目录。 |
| Daily Notes filename format | `YYYY-MM-DD` | 用来定位某一天 Daily Note 的 Moment.js 文件名格式。 |
| Start marker / End marker | `%% trakt:daily:start %%` / `%% trakt:daily:end %%` | 插件只管理两个 marker 之间的内容。 |
| Auto-update Daily Notes without media-note sync | off | 定时刷新 Daily Notes 所需的 Trakt/TMDB 数据并更新已存在的 Daily Note 文件；不会创建、重命名、删除或重写媒体笔记。可以和完整 Auto-sync 同时开启，两个定时器共用同一个锁。默认按设备本地保存。 |
| Daily Notes auto-sync interval | `60 min` | Daily Notes-only 定时器的运行频率。默认按设备本地保存。 |
| Manual backfill | _(按钮)_ | 打开日期范围选择器，用 add-only 模式补写已存在的历史 Daily Notes。 |
| Today write mode | Default | Default 会用最新快照替换今天 marker 区域；incremental 会追加新事件行并保留 marker 内手写内容。 |

### Reset

**Reset to defaults** 把所有设置恢复为默认值。认证凭据和 TMDB API key 会保留。

---

## 6. 笔记格式

### Frontmatter 字段

下面所有字段都加配置的 **Property prefix**（默认 `trakt_`）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `trakt_title` | string | 电影或剧集的标题。 |
| `trakt_year` | number | 发行年份。 |
| `trakt_type` | `movie` \| `show` | 内容类型。 |
| `trakt_id` | number | Trakt 数字 ID。 |
| `trakt_slug` | string | Trakt URL slug。 |
| `trakt_imdb_id` | string | IMDB ID（比如 `tt1234567`）。 |
| `trakt_tmdb_id` | number | TMDB 数字 ID。 |
| `trakt_tvdb_id` | number | TVDB ID（仅剧集）。 |
| `trakt_genres` | list | 类型分类列表。 |
| `trakt_runtime` | number | 时长，分钟（剧集是每集时长）。 |
| `trakt_certification` | string | 年龄分级（比如 `PG-13`）。 |
| `trakt_rating` | number | Trakt 社区评分（0-10）。 |
| `trakt_votes` | number | Trakt 投票数。 |
| `trakt_country` | string | 出品国代码。 |
| `trakt_language` | string | 主要语言代码。 |
| `trakt_status` | string | 状态（比如 `released`、`ended`、`returning series`）。 |
| `trakt_overview` | string | 剧情简介。 |
| `trakt_released` | string | 上映日期（仅电影，YYYY-MM-DD）。 |
| `trakt_tagline` | string | 标语（仅电影）。 |
| `trakt_network` | string | 播出平台（仅剧集）。 |
| `trakt_aired_episodes` | number | 已播出集数（仅剧集）。 |
| `trakt_first_aired` | string | 首播日期（仅剧集，YYYY-MM-DD）。 |
| `trakt_watchlist` | boolean | 同步自 watchlist 时存在。 |
| `trakt_watchlist_added_at` | string | 加入 watchlist 的 ISO 时间戳。 |
| `trakt_watched` | boolean | 同步自观看记录时存在。 |
| `trakt_plays` | number | 观看 / 播放次数。 |
| `trakt_last_watched_at` | string | 最近观看的 ISO 时间戳。 |
| `trakt_episodes_watched` | number | 已观看集数（仅剧集）。 |
| `trakt_favorite` | boolean | 同步自收藏时存在。 |
| `trakt_favorited_at` | string | 收藏的 ISO 时间戳。 |
| `trakt_my_rating` | number | 你的个人评分（1-10）。 |
| `trakt_rated_at` | string | 评分的 ISO 时间戳。 |
| `trakt_url` | string | Trakt 页面 URL。 |
| `trakt_imdb_url` | string | IMDB 页面 URL。 |
| `trakt_poster_url` | string | TMDB 海报图片 URL。 |
| `trakt_synced_at` | string | 同步最近一次**真正修改这条笔记**的 ISO 时间戳。0.3.0 起只在笔记内容实际有变化时才更新 —— 不是每次 sync 都刷新。可作为 Bases / Dataview "最近变更" 视图的排序键。 |
| `trakt_tag_notes` | list | tag note 文件的 wikilink（"Add tag notes to frontmatter" 开启时）。 |
| `tags` | list | 自动生成的 Obsidian 标签（"Add tags" 开启时）。 |
| `trakt_original_title` | string | 英文 / 源语言标题。仅在 **Metadata language** 设置时存在。 |
| `trakt_original_overview` | string | 英文 / 源语言剧情简介。仅在 **Metadata language** 设置时存在。 |
| `trakt_original_tagline` | string | 英文 / 源语言标语（仅电影）。仅在 **Metadata language** 设置时存在。 |
| `trakt_original_genres` | list | 英文 / 源语言类型分类列表。仅在 **Metadata language** 设置时存在。 |
| `trakt_metadata_language` | string | 当前活跃的语言代码（比如 `zh-CN`）。仅在 **Metadata language** 设置时存在。 |

### 自动生成的标签

默认标签前缀 `trakt`：

- `#trakt/movie` 或 `#trakt/show`
- 每个类型分类生成一个 `#trakt/genre/<genre>`
- 在 watchlist 上：`#trakt/watchlist`
- 看过：`#trakt/watched`
- 收藏：`#trakt/favorite`
- 评过分：`#trakt/rated`

### 模板变量

笔记正文模板用 `{{变量}}` 语法。可用变量：

| 变量 | 说明 |
|---|---|
| `{{title}}` | 标题 |
| `{{year}}` | 发行年份 |
| `{{type}}` | `movie` 或 `show` |
| `{{overview}}` | 剧情简介 |
| `{{genres}}` | 逗号分隔的类型分类列表 |
| `{{runtime}}` | 时长（分钟） |
| `{{trakt_rating}}` | 社区评分 |
| `{{trakt_votes}}` | 投票数 |
| `{{certification}}` | 年龄分级 |
| `{{country}}` | 国家代码 |
| `{{language}}` | 语言代码 |
| `{{status}}` | 发行 / 播出状态 |
| `{{trakt_id}}` | Trakt 数字 ID |
| `{{trakt_slug}}` | Trakt slug |
| `{{imdb_id}}` | IMDB ID |
| `{{tmdb_id}}` | TMDB ID |
| `{{tvdb_id}}` | TVDB ID |
| `{{trakt_url}}` | Trakt URL |
| `{{imdb_url}}` | IMDB URL |
| `{{poster_url}}` | 海报图片 URL（没填 TMDB key 时为空；该行从输出中省略） |
| `{{tag_notes}}` | 逗号分隔的 tag note wikilink（无论 tag notes 设置如何始终可用） |
| `{{tagline}}` | 标语（电影） |
| `{{released}}` | 上映日期（电影） |
| `{{network}}` | 播出平台（剧集） |
| `{{aired_episodes}}` | 已播出集数（剧集） |
| `{{first_aired}}` | 首播日期（剧集） |
| `{{watchlist}}` | 在 watchlist 上时为 `true` |
| `{{watchlist_added_at}}` | 加入 watchlist 的时间戳 |
| `{{watched}}` | 看过时为 `true` |
| `{{plays}}` | 播放次数 |
| `{{last_watched_at}}` | 最近观看日期 |
| `{{episodes_watched}}` | 已观看集数（剧集） |
| `{{favorite}}` | 收藏时为 `true` |
| `{{favorited_at}}` | 收藏时间戳 |
| `{{my_rating}}` | 你的评分（1-10） |
| `{{rated_at}}` | 评分时间戳 |
| `{{original_title}}` | 英文 / 源语言标题。即使本地化关闭也可用（此时等于 `{{title}}`）。 |
| `{{original_overview}}` | 英文 / 源语言剧情简介。始终可用。 |
| `{{original_tagline}}` | 英文 / 源语言标语（电影）。始终可用。 |
| `{{original_genres}}` | 英文 / 源语言类型列表，逗号分隔。始终可用。 |
| `{{metadata_language}}` | 活跃的语言代码，本地化关闭时为 `""`。 |
| `{{watch_history}}` | **Sync watch history (detailed)** 开启时是完整的 **观看记录** 段落（`## 标题` + bullet 列表）；否则为空字符串。标题文字按你的 **Note template language** 设置（English / 简体中文 / 繁體中文）。 |
| `{{watch_history_list}}` | 内容和 `{{watch_history}}` 相同但不带标题行。如果你想在自定义模板里自己写标题用这个。 |

### 观看记录的渲染

**Sync watch history (detailed)** 启用后，每篇看过的笔记正文里会出现一个 `## 观看记录` 段落，列出每个观看事件：

剧集 —— 每集一个 bullet，重看的集时间戳逗号分隔：

```markdown
## 观看记录
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

电影 —— 每次观看一行：

```markdown
## 观看记录
- 2023-12-25 19:00
- 2024-06-10 22:30
- 2025-02-14 20:15
```

时间戳按你的本地时区格式化（Trakt 存的是 UTC，渲染时转成本地）。剧集按季 → 集编号排序；同集内的时间戳按时间顺序排。

---

## 7. 同步行为

### 创建 vs 更新

- **新条目**（没有匹配 `trakt_type` + `trakt_id` 的现有笔记）：用完整模板创建笔记。
- **已存在条目**：行为取决于 **Overwrite existing note body** 设置：
  - **关闭**（默认）：只更新 frontmatter；`---` 下面的所有内容保持不变，你的个人笔记得以保留。
  - **开启**：整篇笔记（frontmatter + 正文）从模板重新生成 —— 正文修改会丢失。

### 删除

启用 **Remove notes for deleted items** 后，每次同步结束时，组合 `type:id` 不在任何启用同步来源里的笔记会被移到系统回收站。

### 切换语言

切换 **Metadata language** 然后再同步：

- frontmatter 用新语言重写；`trakt_original_*` 字段始终保留英文值。
- 如果 **filename template** 里包含 `{{title}}`，下次同步时所有笔记会被重命名成新语言的标题。Obsidian 的链接更新会自动修复 wikilink，但**先备份你的 vault**。
- 想让文件名跨语言切换保持稳定，**在切换语言前**把模板改成 `{{original_title}} ({{year}})`。
- 标签（`#trakt/genre/...`）和 tag-note wikilink（`[[trakt/genre/...]]`）始终用原始英文类型分类，所以已有的 Dataview 查询切换语言后也能正常工作。
- 切回 **Default (English / Trakt original)** 时 frontmatter 改回英文；下次同步不再写 `trakt_original_*` 和 `trakt_metadata_language` 字段，所以这些字段会留在已有笔记里直到你手动删除或重新生成笔记（开启 **Overwrite existing note body** 跑一次同步可完全重生成）。

### 跑同步

- **手动**：命令 **Traktr: Sync**（命令面板可访问）
- **启动时**：在设置里启用 **Sync on startup**（Obsidian 加载后 5 秒触发）
- **定时**：启用 **Auto-sync** 并设置间隔
- **Daily Notes-only 定时**：启用 **Daily Notes → Auto-update Daily Notes without media-note sync**，可以只更新 Daily Notes，不写媒体笔记
- **强制全量历史刷新**：命令 **Traktr: Force full watch-history refresh** —— 跳过周期间隔，立刻重新拉取整个 Trakt 历史。当你刚在 Trakt 上删了一个错误的 scrobble、想立刻让插件检测到，可以用这个
- **清空 TMDB 缓存**：命令 **Traktr: Clear TMDB metadata cache** —— 清空所有已缓存的 TMDB 条目。下次同步会从 TMDB 重新拉取所有元数据。和 Settings → TMDB → **Clear cache** 按钮等效

### 同步为什么这么快（0.2.0+）

第一次同步把本地缓存填好之后，后续同步的 API 调用数只取决于真正变了的内容：

- **TMDB 元数据缓存**跨同步、跨设备保留。一部电影的标题 / 海报 / 简介只拉一次，之后一直复用，直到 TTL 过期或你手动 Clear。**典型同步 ~5-10 次 TMDB 调用，而不是 ~1200 次**
- **Trakt 历史增量拉取**用 `?start_at=<上次同步时间>`。一周的新观看通常一页就够（1 次 API 调用）。每隔 `History full-refresh interval (days)` 周期做一次全量重拉以检测删除

完整设计原理见 [`specs/0001-incremental-sync.md`](../specs/0001-incremental-sync.md)。

### Dataview 查询示例

按类型过滤：
```dataview
TABLE trakt_year, trakt_rating, trakt_watched
FROM "trakt"
WHERE trakt_type = "movie"
SORT trakt_rating DESC
```

只显示收藏：
```dataview
TABLE trakt_year, trakt_my_rating
FROM "trakt"
WHERE trakt_favorite = true
SORT trakt_my_rating DESC
```

显示你的 watchlist：
```dataview
TABLE trakt_year, trakt_type, trakt_genres
FROM "trakt"
WHERE trakt_watchlist = true
SORT trakt_year DESC
```
