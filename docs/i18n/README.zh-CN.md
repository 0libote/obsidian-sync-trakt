# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**把你的 [Trakt.tv](https://trakt.tv) 观看记录变成一份高度本地化的 Markdown 库 —— 带逐集观看时间戳、覆盖 15+ 语言的元数据，以及不会让你 vault 频繁抖动的安静增量同步。**

> 🌐 [English](../../README.md) · **简体中文** · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ 为什么用这个

- **详细观看记录** —— 每一集是哪一天几点看的、有没有重看，全都同步到笔记里，每天追剧实时更新
- **覆盖 15+ 语言的元数据** —— 通过 TMDB 把 title / overview / tagline / genres 翻译过来。内置预设涵盖中文（简体 / 繁体 / 港繁）、日文、韩文、法文、德文、西班牙文（西班牙 / 墨西哥）、葡萄牙文（巴西）、意大利文、俄文，外加一个自定义模式，可填任意 TMDB 支持的 BCP-47 语言代码。英文原文始终保留在 `*_original_*` frontmatter 字段
- **增量同步** _(0.2.0)_ —— 首次同步把本地 TMDB 缓存 + Trakt 历史状态填好；之后每次同步只拉变化的部分。稳态同步时间从几分钟降到几秒。详见 [spec 0001](../specs/0001-incremental-sync.md)
- **安静写盘** _(0.3.0)_ —— 同步只重写**内容真的变了**的笔记。看完一集后，1200 项的影库只重写 1 个笔记，而不是 1200 个 —— Obsidian Sync / iCloud / Syncthing 等多设备同步层不再每次都重传整个库。详见 [spec 0002](../specs/0002-diff-based-write.md)

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

上面的元数据本地化覆盖很多语言；**插件自身的 UI** 是另一条独立、规模较小的轴。**设置面板、命令面板、提示弹窗**目前支持 **English** 和 **简体中文**。**内置笔记模板**提供英文、简体中文 (`zh-CN`)、繁体中文 (`zh-TW` / `zh-HK`) 三种；其他模板语言代码会回退到英文模板 —— 暂时请手动改模板，或者 [开个 issue](https://github.com/o1xhack/obsidian-sync-trakt/issues) 申请加入预置翻译。UI 语言按需扩展。

<!-- screenshot: bilingual-ui -->

## 🔄 多设备同步

授权状态（Trakt token、TMDB key、所有设置）保存在 vault 的 `.obsidian/plugins/obsidian-sync-trakt/data.json` 里，跟随你的 vault 同步走。在 Mac 上配一次，通过 Obsidian Sync（勾选 `Plugin data` 同步）、Syncthing、iCloud + 高级数据保护、或 Cryptomator 同步到 iPhone。**插件不在任何服务器存储数据**。

## 📊 在 Obsidian Bases 里查看影库

`trakt_poster_url` frontmatter 字段**开箱即用**，配合 [Obsidian Bases](https://help.obsidian.md/bases)（Obsidian 1.9.3+）—— 在你同步出来的文件夹上建一个 database 视图，海报会作为缩略图显示：

- **卡片视图**：打开 Display 设置 → 把 **Image property** 选成 `trakt_poster_url`
- **表格视图**（1.9.4+）：加一个 formula 列，用 `image(note.trakt_poster_url)`

按 `trakt_type = "movie"` / `"show"` 过滤、按 `trakt_year` / `trakt_rating` / `trakt_my_rating` 排序、按 `trakt_genres` 分组都行。Dataview 查询用的那套 frontmatter 属性，Bases 视图也能直接用 —— 没有额外配置。

## 🚀 快速开始

1. 通过 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 安装 → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. 设置 → **Obsidian Sync Trakt** → 填 Trakt + TMDB API key（[配置指南](SETUP.zh-CN.md)）
3. 命令面板 → **Traktr: Sync**

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

<details>
<summary><b>BRAT（推荐）</b></summary>

[BRAT](https://github.com/TfTHacker/obsidian42-brat) 让 Obsidian 可以从任意 GitHub 仓库直接安装并自动更新插件。

1. 在第三方插件里安装并启用 **Obsidian42 - BRAT**
2. 设置 → BRAT → **Add a beta plugin for testing**
3. 粘贴：
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. 点 **Add Plugin** → 在第三方插件里启用

之后每次 Obsidian 启动 BRAT 会自动检查更新并拉取新 release。

</details>

<details>
<summary><b>手动安装</b></summary>

1. 从 [Releases](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) 下载 `main.js`、`manifest.json`、`styles.css`
2. 把三个文件放到 `<你的-vault>/.obsidian/plugins/obsidian-sync-trakt/`
3. 设置 → 第三方插件 → 启用 **Obsidian Sync Trakt**

</details>

<details>
<summary><b>Obsidian 第三方插件市场（待提交）</b></summary>

> ⚠️ 尚未上架 Obsidian 官方第三方插件目录。等被收录后这条会变成推荐路径。在那之前请用上方的 BRAT。

</details>

<details>
<summary><b>从源码构建</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # 生成 main.js
npm run lint
npm run test:i18n  # 跑冒烟测试
```

然后把 `main.js`、`manifest.json`、`styles.css` 复制到 `<vault>/.obsidian/plugins/obsidian-sync-trakt/`。

</details>

## 📚 文档

| 文档 | 用途 |
|---|---|
| [SETUP](SETUP.zh-CN.md) | Trakt + TMDB API 申请，首次配置，常见问题 |
| [MANUAL](MANUAL.zh-CN.md) | 完整设置参考、frontmatter 字段、模板变量、同步行为 |
| [DEVELOPER](../DEVELOPER.md) | 架构概览、数据流、扩展指南（仅英文） |
| [docs/i18n/](.) | README / SETUP / MANUAL 的 8 种语言翻译 |

## 🗺️ 路线图

- [x] 详细的逐集观看记录同步
- [x] 覆盖 15+ 预设语言的元数据本地化 + 任意 TMDB 支持语言代码的自定义模式
- [x] 双语插件 UI（en + zh-CN）；其他语言按需扩展
- [x] 翻译过的默认笔记模板（en + zh-CN + zh-TW）
- [x] TMDB 元数据缓存（0.2.0）—— 切换语言不重打 API，稳态同步几秒钟搞定
- [x] Trakt 历史增量拉取（0.2.0）—— 只拉上次同步之后的新观看事件
- [x] Diff-based 写盘（0.3.0）—— 只重写真的变了的笔记，不再触发跨设备同步雪崩
- [ ] 提交到 Obsidian 第三方插件目录
- [ ] 更多 UI 翻译（ja / ko / fr / ...）按需增加

## 🤝 致谢

本插件最初受 [sarimabbas/traktr](https://github.com/sarimabbas/traktr)（MIT 许可证）启发，从中获得了 Trakt OAuth 接入的最初脚手架。后续大量工作 —— 详细观看记录聚合、带翻译 fallback 链的元数据本地化、双语 UI、带限流和实时进度反馈的并发抓取、机器管理段落、翻译感知的模板渲染器、多语言文档体系 —— 已经把代码库重塑成了根本不同的架构。

感谢 [Sarim Abbas](https://github.com/sarimabbas) 提供了最初的起点。原作的 MIT 版权声明完整保留在 [LICENSE](../../LICENSE) 中，与本项目自己的版权声明并列。

## 📄 许可证

MIT —— 见 [LICENSE](../../LICENSE)。

---

作者：[o1xhack](https://github.com/o1xhack)
