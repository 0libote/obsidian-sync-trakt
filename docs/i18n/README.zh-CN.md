# Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.8.7%2B-7c3aed)](https://obsidian.md)

**把你的 [Trakt.tv](https://trakt.tv) 观看记录变成一份高度本地化的 Markdown 库 —— 带逐集观看时间戳、覆盖 15+ 语言的元数据，以及不会让你 vault 频繁抖动的安静增量同步。**

> 🌐 [English](../../README.md) · **简体中文** · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ 为什么用这个

- **详细观看记录** —— 每一集是哪一天几点看的、有没有重看，全都同步到笔记里，每天追剧实时更新
- **覆盖 15+ 语言的元数据** —— 通过 TMDB 把 title / overview / tagline / genres 翻译过来。内置预设涵盖中文（简体 / 繁体 / 港繁）、日文、韩文、法文、德文、西班牙文（西班牙 / 墨西哥）、葡萄牙文（巴西）、意大利文、俄文，外加自定义模式可填任意 TMDB 支持的 locale。**严格主语言 + 用户自定义回退**（比如简中没有就退到英文）—— 不会再出现想要简中却悄悄给你繁中凑数的情况。英文原文始终保留在 `*_original_*` frontmatter 字段
- **文件名跟随语言** —— 切换元数据语言后，已有笔记会在下次同步自动重命名匹配新标题；Obsidian 内链自动更新（用的是 `fileManager.renameFile`）。设置里也有「立即重命名」按钮可手动触发
- **11 种笔记模板语言** —— 内置手工翻译的笔记模板，覆盖 en + zh-CN + zh-TW + ja + ko + fr + de + it + es + pt-BR + ru。在模板语言下拉框里选择，随时切换不会丢失你的自定义内容
- **Tab 式设置界面** —— 通用 / 笔记 / 同步 / Daily Notes 四个 tab。最后查看的 tab 按设备记忆
- **Daily Notes 集成** —— 每次同步自动在你的 Daily Note 中插入当天的事件（看了 / 加入想看 / 收藏 / 评分），按时间排序，跟随你的模板语言。Marker 区间内的内容由插件管理，**区间之外的内容绝不修改**。**增量模式**（可选）让你在 marker 区间内手写的批注也能在每次同步后保留。手动回溯改成日期区间选择器，配快捷预设（最近 7 天 / 最近 30 天 / 本月 / 上月）。详见 [spec 0006](../specs/0006-daily-notes-integration.md)
- **增量同步** —— 首次同步把本地 TMDB 缓存 + Trakt 历史状态填好；之后每次同步只拉变化的部分。稳态同步时间从几分钟降到几秒。详见 [spec 0001](../specs/0001-incremental-sync.md)
- **安静写盘** —— 同步只重写**内容真的变了**的笔记。看完一集后，1200 项的影库只重写 1 个笔记，而不是 1200 个 —— Obsidian Sync / iCloud / Syncthing 等多设备同步层不再每次都重传整个库。详见 [spec 0002](../specs/0002-diff-based-write.md)
- **按设置粒度的云端开关** —— 每个设置项可单独决定要不要跨设备同步。比如 Mac 上每 30 分钟自动同步，iPhone 上完全关闭 —— 互不打扰。详见 [spec 0003](../specs/0003-device-local-settings.md)

## 🎬 详细观看记录

打开 **同步详细观看记录** 后，插件会调用 Trakt 的 `/sync/history` 端点，把每集（或每部电影）的观看时间戳直接渲染到笔记正文里 —— 而且会随你看新集一起更新：

```markdown
## 观看记录
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

重看的集会用逗号分隔；按季 / 集编号排序。整个段落用 `%% trakt:watch-history %%` 标记包住 —— 插件只更新标记之间的内容，**你在笔记其他地方手写的内容一字不动**。

<!-- screenshot: watch-history -->

## 🌐 元数据本地化

把 **元数据语言** 设置改成你想要的，同步出来的笔记里 title / overview / tagline / genres 都会通过 TMDB 翻译过来（没填 TMDB key 时回退到 Trakt 翻译端点）。英文原文保留在 `trakt_original_*` 字段：

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

标签和 tag-note 路径**永远是英文** —— 你已有的 Dataview 查询不会因为切换语言而失效。

<!-- screenshot: metadata-localization -->

## 🌍 插件 UI 和笔记模板

上面的元数据本地化是一条轴，插件自身的几个表面是另外的轴：

- **设置面板、命令面板、提示弹窗** 目前支持 **English** 和 **简体中文**。其他 UI 语言按需扩展 —— 想贡献的话欢迎 [开个 issue](https://github.com/o1xhack/obsidian-sync-trakt/issues)
- **内置笔记模板** 共 11 种语言 —— 英文、简体中文 (zh-CN)、繁体中文 (zh-TW / zh-HK)、日文、韩文、法文、德文、意大利文、西班牙文、葡萄牙文 (BR)、俄文。手工翻译，不是机翻；段落标题、列表标签、标点符号都按各语言的习惯（日文用全角冒号、法文用空格冒号 etc.）。模板语言下拉框只列这 11 种；不在列表里的语言会回退到英文（而不是悄悄挑一个邻近的方言凑数）

<!-- screenshot: bilingual-ui -->

## 📅 Daily Notes 集成

每次同步自动把当天事件按时间顺序插入到你的 Daily Note 中 —— 看了的剧集、加入想看的、收藏的、打分的，全部包括：

```markdown
%% trakt:daily:start %%
10:00 — 看了 低智商犯罪 (2026) S1E16, S1E17
14:30 — 加入想看 黑暗骑士 (2008)
21:30 — 打分 9/10 重生 (2020)
%% trakt:daily:end %%
```

每种事件类型受对应的「同步来源」开关控制 —— 比如关掉「同步收藏」，收藏事件就不会出现在 Daily Notes 里。动词（`看了` / `視聴` / `시청` / `a regardé`…）跟随你的**模板语言**设置，覆盖全部 11 种内置语言。

**安全契约**：marker 区间内的内容由插件管理，**区间之外的内容绝不修改**。过去的日期默认只增不改（已有的 marker 不会被覆盖）；今天的内容每次同步都会刷新。**增量模式**（可选）把今天的行为也改成只追加，这样你在 marker 区间内手写的批注也能在每次同步后保留。

**手动回溯**用日期区间选择器，配快捷预设（最近 7 天 / 最近 30 天 / 本月 / 上月）。点确认前会实时显示"该区间内有多少篇 Daily Note 实际存在"。在 **设置 → Daily Notes** 里配置文件夹和文件名格式（Moment.js 语法，比如 `YYYY-MM-DD` 或 `YYYY/YYYY.MM.DD`）。详见 [spec 0006](../specs/0006-daily-notes-integration.md)。

## 🔄 多设备同步

授权状态（Trakt token、TMDB key、所有设置）保存在 vault 的 `.obsidian/plugins/sync-trakt/data.json` 里，跟随你的 vault 同步走。在 Mac 上配一次，通过 Obsidian Sync（勾选 `Plugin data` 同步）、Syncthing、iCloud + 高级数据保护、或 Cryptomator 同步到 iPhone。**插件不在任何服务器存储数据**。

**任何单个设置都可以单独退出跨设备同步** —— 设置项旁边有个小云朵图标可以切换（目前已开放给「启动时同步」、「自动同步」、「自动同步间隔」、「插件 UI 语言」四项）。适合"Mac 上 30 分钟自动同步、iPhone 上不要"这种场景。

## 📊 在 Obsidian Bases 里查看影库

`trakt_poster_url` frontmatter 字段**开箱即用**，配合 [Obsidian Bases](https://help.obsidian.md/bases)（Obsidian 1.9.3+）—— 在你同步出来的文件夹上建一个 database 视图，海报会作为缩略图显示：

- **卡片视图**：打开 Display 设置 → 把 **Image property** 选成 `trakt_poster_url`
- **表格视图**（1.9.4+）：加一个 formula 列，用 `image(note.trakt_poster_url)`

按 `trakt_type = "movie"` / `"show"` 过滤、按 `trakt_year` / `trakt_rating` / `trakt_my_rating` 排序、按 `trakt_genres` 分组都行。Dataview 查询用的那套 frontmatter 属性，Bases 视图也能直接用 —— 没有额外配置。

## 🚀 快速开始

1. 设置 → 第三方插件 → **浏览** → 搜索 **Sync Trakt** → **安装** → **启用**
2. 设置 → **Sync Trakt** → 填 Trakt + TMDB API key（[配置指南](SETUP.zh-CN.md)）
3. 命令面板 → **Sync Trakt: Sync**

## 🔑 API key 各自解锁什么

插件用到两个 API。**Trakt 是必需的** —— 没有它插件什么都同步不了。**TMDB 是可选的**，但解锁的恰好是大多数人安装本插件的真正动机。具体如下：

| 功能 | Trakt API<br/>_（必需）_ | TMDB API<br/>_（推荐）_ |
|---|:---:|:---:|
| 同步 Trakt 库（watchlist、watched、favorites、ratings） | ✅ | — |
| 逐集观看时间戳 | ✅ | — |
| title / overview / tagline 翻译成你的语言 | ✅ 基础 | ✅ 更高质量 |
| **genres 翻译成你的语言** | ❌ | ✅ |
| **笔记内嵌入海报图片** | ❌ | ✅ |

如果你只想看英文内容、也不在意海报，TMDB 可以留空 —— 光 Trakt 就够。如果想要非英文的完整本地化（包括 genres 和海报），**请填 TMDB key**（[免费注册](https://www.themoviedb.org/settings/api)）。粘贴 key 之后，点旁边的 **Test** 按钮验证是否有效，再做第一次同步。

→ [两个 key 的完整配置教程](SETUP.zh-CN.md)

## 📦 安装

<details open>
<summary><b>Obsidian 第三方插件市场（推荐）</b></summary>

1. 设置 → 第三方插件 → **浏览**
2. 搜索 **Sync Trakt**
3. 点 **安装** → **启用**

插件目录页：https://community.obsidian.md/plugins/sync-trakt

</details>

<details>
<summary><b>开发模式（从源码构建）</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # 生成 main.js
npm run lint
npm run test:i18n  # 跑冒烟测试
```

然后把 `main.js`、`manifest.json`、`styles.css` 复制到 `<vault>/.obsidian/plugins/sync-trakt/`。

</details>

<details>
<summary><b>本地测试（手动安装）</b></summary>

1. 从 [Releases](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) 下载 `main.js`、`manifest.json`、`styles.css`
2. 把三个文件放到 `<你的-vault>/.obsidian/plugins/sync-trakt/`
3. 设置 → 第三方插件 → 启用 **Sync Trakt**

</details>

## 📚 文档

| 文档 | 用途 |
|---|---|
| [SETUP](SETUP.zh-CN.md) | Trakt + TMDB API 申请，首次配置，常见问题 |
| [MANUAL](MANUAL.zh-CN.md) | 完整设置参考、frontmatter 字段、模板变量、同步行为 |
| [DEVELOPER](../DEVELOPER.md) | 架构概览、数据流、扩展指南（仅英文） |
| [docs/i18n/](.) | README / SETUP / MANUAL 的 8 种语言翻译 |

## 🗺️ 路线图

从 fork 算起的主要版本（按时间顺序）：

- [x] **0.1** — 初始 fork。详细的逐集观看记录、TMDB + Trakt fallback 元数据本地化、双语 UI（en + zh-CN）、翻译过的笔记模板（en + zh-CN + zh-TW）、独立的 plugin id 让本插件能跟上游 traktr 共存
- [x] **0.2** — 增量同步。持久化 TMDB 缓存（stale-while-revalidate，90 天 TTL 带抖动）+ Trakt 历史状态游标。稳态同步从几分钟降到几秒。→ [spec 0001](../specs/0001-incremental-sync.md)
- [x] **0.3** — Diff-based 写盘。只重写 frontmatter 或 managed body 区间确实变了的笔记，多设备同步层不再每次抖 1200 个文件。0.3.x 还加了：TMDB API key 测试按钮 + 元数据语言开启但没填 key 时的警告横幅；针对本地化标题撞名的两层文件名 disambiguation（之前 5 部都叫"重生"的剧抢同一个文件名的问题）。→ [spec 0002](../specs/0002-diff-based-write.md)
- [x] **0.4** — 提交准备。Plugin id 从 `obsidian-sync-trakt` 改成 `sync-trakt`（Obsidian 官方目录 bot 拒绝含 obsidian 的 id）、`minAppVersion` 调到 1.6.6、首次启动时透明自动迁移老目录数据。→ [spec 0004](../specs/0004-obsidian-directory-submission.md)
- [x] **0.5** — 设备本地设置 + 自动清理。每个设置项旁边的云朵图标可单独控制是否跨设备同步；迁移后自动清理老目录里的 binary 文件（保留 data.json 作为救命稻草），不再让用户看到两个重复的插件入口。→ [spec 0003](../specs/0003-device-local-settings.md)
- [x] **0.6** — Tab 式设置界面 + 11 种笔记模板语言。设置页重构成 4 个 tab（通用 / 笔记 / 同步 / Daily Notes）；笔记模板从 3 种扩展到 11 种（新增 ja、ko、fr、de、it、es、pt-BR、ru，全部手工翻译）；模板语言下拉框只列出已 bundled 的语言。→ [spec 0005](../specs/0005-settings-ui-tabs.md) + [spec 0007](../specs/0007-template-language-expansion.md)
- [x] **0.7** — Daily Notes 集成。每次同步自动把当天事件（看了 / 加入想看 / 收藏 / 评分）按时间顺序写进你的 Daily Note，跟随模板语言。过去的日期只增不改，今天的内容随时刷新。→ [spec 0006](../specs/0006-daily-notes-integration.md)
- [x] **0.8** — Daily Notes **增量同步模式**。可选模式：今天的 marker 区间从"全替换"改成"只追加"，这样你在区间内手写的批注每次同步都能保留。
- [x] **0.9** — **元数据语言回退**。在「元数据语言」下方新加"回退语言"下拉。设置后主语言变严格匹配（不会再用 zh-TW 凑 zh-CN），命中不到再走回退，最后才退到英文原文。→ [spec 0008](../specs/0008-metadata-language-fallback.md)
- [x] **1.0** — **文件名自动重命名 + 持久化"更新说明"弹窗 + 日期区间回溯**。切换元数据语言后，已有笔记下次同步自动重命名（Obsidian 内链自动跟随）。每个新版本首次启动会弹一次"更新说明"，显示距上次以来的版本变化。手动回溯改为日期区间选择器（起始 / 结束 + 快捷预设）。→ [spec 0009](../specs/0009-filename-rename.md)
- [ ] **未来** — 更多 UI 翻译（目前 en + zh-CN）按需增加；更多 bundled 模板语言可按用户请求添加

## 🤝 致谢

本插件最初受 [sarimabbas/traktr](https://github.com/sarimabbas/traktr)（MIT 许可证）启发，从中获得了 Trakt OAuth 接入的最初脚手架。后续大量工作 —— 详细观看记录聚合、带翻译 fallback 链的元数据本地化、双语 UI、带限流和实时进度反馈的并发抓取、机器管理段落、翻译感知的模板渲染器、多语言文档体系 —— 已经把代码库重塑成了根本不同的架构。

感谢 [Sarim Abbas](https://github.com/sarimabbas) 提供了最初的起点。原作的 MIT 版权声明完整保留在 [LICENSE](../../LICENSE) 中，与本项目自己的版权声明并列。

## 📄 许可证

MIT —— 见 [LICENSE](../../LICENSE)。

---

作者：[o1xhack](https://github.com/o1xhack)
