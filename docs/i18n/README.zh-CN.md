# Obsidian Sync Trakt

> [English](../../README.md) · [简体中文](README.zh-CN.md)

Obsidian 插件——把你的 [Trakt.tv](https://trakt.tv) 数据（想看清单 / 观看历史 /
收藏 / 评分）同步成 Markdown 笔记，支持**逐集观看时间戳**和**元数据本地化**
（中文、日文等）。

## 功能

- 每部电影或电视剧一篇 Markdown 笔记，包含结构化 frontmatter、可自定义的
  正文模板，以及可选标签
- 同步 Trakt 的四种来源：**想看清单**、**观看历史**、**收藏**、**评分**。
  多个来源会合并到同一篇笔记
- **详细观看记录**——可选启用，从 Trakt 的 `/sync/history` 端点拉取每集（或
  每部电影）的观看时间戳，渲染到笔记正文里。详见
  [`详细观看记录`](#详细观看记录) 章节
- **元数据本地化**——通过 TMDB（或 Trakt 翻译端点作为回退）翻译
  `title`、`overview`、`tagline`、`genres`。英文原文保留在 `*_original_*`
  frontmatter 字段。**标签始终保持英文**，确保已有的 Dataview 查询不受影响
- **双语 UI**——设置面板、命令面板、提示弹窗支持 **English** 或 **简体中文**
- **翻译过的默认模板**——内置英文、简体中文 (`zh-CN`)、繁体中文
  (`zh-TW` / `zh-HK`) 三种语言的笔记默认模板
- 通过 TMDB 提供海报图片（可选）
- 仅更新 frontmatter 模式可保留你对正文的手动修改
- 启动时同步、定时自动同步均可配置
- 支持标签笔记（可作为内联标签的替代）

## 详细观看记录

在设置里勾选 **同步详细观看记录** 后，插件会调用 Trakt 的 `/sync/history`
端点，把每个观看事件聚合到笔记正文里。默认模板会把这一段渲染在
`Trakt 状态` 和 `链接` 之间：

```markdown
## 观看记录
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

电影则是每次观看一行时间戳。如果你的库很大（几百部剧 / 几千集观看记录），
**首次同步可能需要几分钟**——这个端点每页 100 条，每次观看事件就是一条。

详细模式**默认关闭**。轻量的"概要"模式（只有 `plays` 次数和
`last_watched_at`）依然由原来的 **同步观看记录** 开关控制。

## 前置要求

- [Trakt.tv](https://trakt.tv) 账号 + OAuth 应用
  ([trakt.tv/oauth/applications](https://trakt.tv/oauth/applications)，
  Redirect URI 必须填 `urn:ietf:wg:oauth:2.0:oob`)
- [TMDB](https://themoviedb.org) API key——海报图片必需，元数据本地化推荐
  ([themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))

详细的申请步骤见 [docs/i18n/SETUP.zh-CN.md](SETUP.zh-CN.md)（如果有这份
独立的中文配置文档）；或者参考英文 [README](../../README.md) 里的链接。

## 安装

### Obsidian 第三方插件市场 *（占位 —— 待提交）*

> ⚠️ **尚未上架。** 等本插件被 Obsidian 官方第三方插件目录收录后（以及类似
> 「红天社区」之类的中文 Obsidian 插件社区），下面这条路径会成为推荐方式。

上架之后的步骤：

1. Obsidian → 设置 → 第三方插件 → 浏览
2. 搜索 `Obsidian Sync Trakt`
3. 点击 **安装**，再点 **启用**

在那之前请用下方的 BRAT 方式。

### BRAT（目前推荐）

[BRAT](https://github.com/TfTHacker/obsidian42-brat) 让 Obsidian 可以从任意
GitHub 仓库直接安装并自动更新插件。步骤：

1. 在第三方插件里安装并启用 **Obsidian42 - BRAT**
2. 设置 → BRAT → **Add a beta plugin for testing**
3. 粘贴仓库路径：
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. 点 **Add Plugin**。BRAT 会自动安装最新 release，之后每次推 tag 都会自动
   更新
5. 设置 → 第三方插件 → 启用 **Obsidian Sync Trakt**

### 手动安装

1. 从 [Releases](https://github.com/o1xhack/obsidian-sync-trakt/releases)
   下载最新的 `main.js`、`manifest.json`、`styles.css`
2. 放到 `<你的-vault>/.obsidian/plugins/obsidian-sync-trakt/`
3. 设置 → 第三方插件 → 启用 **Obsidian Sync Trakt**

### 从源码构建

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # 生成 main.js
npm run lint
npm run test:i18n  # 跑冒烟测试
```

然后把 `main.js` / `manifest.json` / `styles.css` 复制到
`<vault>/.obsidian/plugins/obsidian-sync-trakt/`。

## 文档

- [doc/MANUAL.md](../../doc/MANUAL.md) ——完整设置参考、frontmatter 字段、
  模板变量、同步行为（英文）
- [doc/DEVELOPER.md](../../doc/DEVELOPER.md) ——架构概览、数据流、扩展指南
  （英文）
- [docs/i18n/](.) ——README 的翻译版本

## 上游致谢

本插件 fork 自
[**sarimabbas/traktr**](https://github.com/sarimabbas/traktr)（MIT 许可证）。
核心同步引擎、frontmatter / 模板结构、标签笔记系统全部直接继承自上游项目。
由衷感谢 [Sarim Abbas](https://github.com/sarimabbas) 的原始工作。

## 许可证

MIT——见 [LICENSE](../../LICENSE)。同时包含上游的版权声明（Sarim Abbas）
和本 fork 的版权声明（o1xhack）；两份声明都生效，原文保留在 LICENSE 文件中。

---

作者：[o1xhack](https://github.com/o1xhack)
