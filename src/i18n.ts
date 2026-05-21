/**
 * Plugin-level UI strings (settings tab, command palette, notices, auth
 * modal). Out of scope of the upstream i18n proposal — fork-only feature
 * driven by the local user's preference for a Simplified Chinese UI.
 *
 * The METADATA language (frontmatter title/overview/genres/etc.) is a
 * separate axis controlled by `metadataLanguage` and lives in settings.ts;
 * this module is purely about the strings the plugin renders to the user.
 */

export const UI_LANGUAGES = ["en", "zh-CN"] as const;

export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const STRINGS = {
  // ── [0.6.0] Settings page tab labels ──
  "tabs.general": { en: "General", "zh-CN": "通用" },
  "tabs.notes":   { en: "Notes",   "zh-CN": "笔记" },
  "tabs.sync":    { en: "Sync",    "zh-CN": "同步" },
  "tabs.daily":   { en: "Daily Notes", "zh-CN": "日记" },
  "tabs.daily.placeholder": {
    en: "Daily Notes integration coming in 0.7.0.",
    "zh-CN": "Daily Notes 集成功能将在 0.7.0 版本提供。",
  },

  // ── [0.7.0] Daily Notes integration (spec 0006) ──
  "daily.heading": { en: "Daily notes integration", "zh-CN": "Daily Notes 集成" },
  "daily.enabled.name": {
    en: "Enable Daily Notes integration",
    "zh-CN": "启用 Daily Notes 集成",
  },
  "daily.enabled.desc": {
    en: "Auto-insert per-event lines into your Daily Note on every sync. Past days are add-only; today is overwritten so newer events appear on subsequent syncs. We never modify Daily Note content outside our marker region.",
    "zh-CN": "每次同步时自动把事件按时间插入到你的 Daily Note。过去的日期只增不改；今天的内容每次同步都会被刷新，让晚上看的新内容能在下次同步出现。我们永远不会修改 marker 区间之外的内容。",
  },
  "daily.folder.name": { en: "Daily Notes folder", "zh-CN": "Daily Notes 文件夹" },
  "daily.folder.desc": {
    en: "Must be an existing folder. We do NOT create folders or files — only modify files that already exist.",
    "zh-CN": "必须是已存在的文件夹。本功能**不会创建**文件夹或文件 —— 只修改已经存在的文件。",
  },
  "daily.format.name": { en: "Filename format", "zh-CN": "文件名格式" },
  "daily.format.desc": {
    en: "Moment.js format string. Examples: YYYY-MM-DD, YYYY/YYYY.MM.DD, YYYY-[W]ww/YYYY-MM-DD. Must match how your Daily Notes plugin (or you manually) names files.",
    "zh-CN": "Moment.js 格式字符串。比如 YYYY-MM-DD、YYYY/YYYY.MM.DD、YYYY-[W]ww/YYYY-MM-DD。必须跟你 Daily Notes 插件（或你手动）的文件命名一致。",
  },
  "daily.markerStart.name": { en: "Start marker", "zh-CN": "起始 marker" },
  "daily.markerEnd.name": { en: "End marker", "zh-CN": "结束 marker" },
  "daily.marker.desc": {
    en: "Default: %% trakt:daily:start %% — invisible Obsidian comment. Change to visible markdown (e.g. ## Trakt today) if you want the section to show in reading view.",
    "zh-CN": "默认 %% trakt:daily:start %% —— 隐形 Obsidian 注释。想让区间在阅读模式可见就改成 markdown 标题（比如 ## 今日 Trakt）。",
  },
  "daily.warning": {
    en: "Content between the two markers is managed by the plugin. Today's marker region can be refreshed on sync, so keep manual notes outside the markers.",
    "zh-CN": "两个 marker 之间的内容由插件自动管理。今天的 marker 区间可能会在同步时刷新；手写内容请放在 marker 外面。",
  },
  "daily.preview.name": { en: "Entry format preview", "zh-CN": "条目格式预览" },
  "daily.preview.desc": {
    en: "Entries are formatted as: time — verb display. Verbs follow your Note template language setting (below). Unsupported / custom languages fall back to English. The preview re-renders live as you change settings.",
    "zh-CN": "条目格式为：时间 — 动词 内容。动词跟随下方的「笔记模板语言」设置。不支持的语言（包括自定义的稀有代码）会回退到英文。下方预览会随设置实时刷新。",
  },
  "daily.sources.heading": { en: "Source events that appear in Daily Notes", "zh-CN": "在 Daily Notes 显示的事件类型" },
  "daily.sources.desc": {
    en: "Each event type is gated by its corresponding Sync source toggle. If you turn off a source, those events won't appear in Daily Notes either.",
    "zh-CN": "每种事件类型都跟着对应的「同步来源」开关。关掉某个来源，相应事件也不会出现在 Daily Notes 里。",
  },
  "daily.sources.watched": {
    en: "Watched → requires Sync watch history (detailed)",
    "zh-CN": "看了 → 需要开启「同步详细观看记录」",
  },
  "daily.sources.watchlist": {
    en: "Added to watchlist → requires Sync watchlist",
    "zh-CN": "加入想看 → 需要开启「同步想看清单」",
  },
  "daily.sources.favorites": {
    en: "Favorited → requires Sync favorites",
    "zh-CN": "收藏了 → 需要开启「同步收藏」",
  },
  "daily.sources.ratings": {
    en: "Rated → requires Sync ratings",
    "zh-CN": "打分 → 需要开启「同步评分」",
  },
  "daily.autoSync.heading": {
    en: "Daily Notes-only auto-sync",
    "zh-CN": "Daily Notes 独立自动同步",
  },
  "daily.autoSync.name": {
    en: "Auto-update Daily Notes without media-note sync",
    "zh-CN": "自动更新 Daily Notes（不写媒体笔记）",
  },
  "daily.autoSync.desc": {
    en: "Runs on its own timer. It refreshes the Trakt/TMDB data needed for Daily Notes and updates existing Daily Note files only. You can keep the Sync tab auto-sync enabled too; both timers share one lock.",
    "zh-CN": "使用独立定时器运行。它会刷新 Daily Notes 所需的 Trakt/TMDB 数据，只更新已存在的 Daily Note 文件。可以和「同步」里的自动同步同时开启；两个定时器共用同一个锁。",
  },
  "daily.autoSync.interval.name": {
    en: "Daily Notes auto-sync interval (minutes)",
    "zh-CN": "Daily Notes 自动同步间隔（分钟）",
  },
  "daily.autoSync.interval.desc": {
    en: "How often to refresh Daily Notes. Minimum 5, maximum 360. This setting is device-local by default, so each device can choose its own cadence.",
    "zh-CN": "刷新 Daily Notes 的频率。最小 5，最大 360。该设置默认仅本设备生效，所以每台设备可以使用自己的频率。",
  },
  // [0.8.0] Today-mode write strategy. Section sits at the bottom of
  // the Daily Notes tab, after Manual backfill. Renders a comparison
  // table so the user can pick the right mode for their workflow.
  "daily.syncMode.heading": { en: "Sync mode", "zh-CN": "同步模式" },
  "daily.syncMode.name": { en: "Today's sync mode", "zh-CN": "今天的同步模式" },
  "daily.syncMode.desc": {
    en: "How today's marker region is updated on every sync. Past days are unaffected.",
    "zh-CN": "今日 marker 区间每次同步时的更新方式。不影响过去的日期。",
  },
  "daily.syncMode.default": { en: "Default", "zh-CN": "默认" },
  "daily.syncMode.incremental": { en: "Incremental", "zh-CN": "增量" },
  // Comparison table headers + cells. Split per-cell so each language
  // reads naturally rather than getting a glued translation.
  "daily.syncMode.table.col.scenario": { en: "Scenario", "zh-CN": "场景" },
  "daily.syncMode.table.col.default": { en: "Default", "zh-CN": "默认" },
  "daily.syncMode.table.col.incremental": {
    en: "Incremental",
    "zh-CN": "增量",
  },
  "daily.syncMode.table.row.append.scenario": {
    en: "Append text to a rendered line",
    "zh-CN": "行尾追加感想",
  },
  "daily.syncMode.table.row.append.default": {
    en: "Deleted",
    "zh-CN": "被删掉",
  },
  "daily.syncMode.table.row.append.incremental": {
    en: "Preserved",
    "zh-CN": "保留",
  },
  "daily.syncMode.table.row.insert.scenario": {
    en: "Insert a custom line in the middle",
    "zh-CN": "中间插一行笔记",
  },
  "daily.syncMode.table.row.insert.default": {
    en: "Deleted",
    "zh-CN": "被删掉",
  },
  "daily.syncMode.table.row.insert.incremental": {
    en: "Preserved",
    "zh-CN": "保留",
  },
  "daily.syncMode.table.row.delete.scenario": {
    en: "Delete a rendered line",
    "zh-CN": "删除某一行",
  },
  "daily.syncMode.table.row.delete.default": {
    en: "Restored next sync",
    "zh-CN": "下次同步自动恢复",
  },
  "daily.syncMode.table.row.delete.incremental": {
    en: "Re-added at end",
    "zh-CN": "下次同步从末尾追加回来",
  },
  "daily.syncMode.table.row.edit.scenario": {
    en: "Edit a rendered line",
    "zh-CN": "改了某一行内容",
  },
  "daily.syncMode.table.row.edit.default": {
    en: "Deleted",
    "zh-CN": "被删掉",
  },
  "daily.syncMode.table.row.edit.incremental": {
    en: "Both lines coexist",
    "zh-CN": "新旧两行并存",
  },
  "daily.syncMode.table.row.lang.scenario": {
    en: "Switch metadata language",
    "zh-CN": "切换 metadata 语言",
  },
  "daily.syncMode.table.row.lang.default": {
    en: "Re-renders in new language",
    "zh-CN": "整段重渲染成新语言",
  },
  "daily.syncMode.table.row.lang.incremental": {
    en: "Both languages coexist",
    "zh-CN": "新旧语言并存",
  },
  "daily.syncMode.table.row.rating.scenario": {
    en: "Change rating on Trakt",
    "zh-CN": "Trakt 上修改评分",
  },
  "daily.syncMode.table.row.rating.default": {
    en: "Rating updates",
    "zh-CN": "评分更新",
  },
  "daily.syncMode.table.row.rating.incremental": {
    en: "Both ratings coexist",
    "zh-CN": "新旧评分两行并存",
  },
  "daily.syncMode.table.row.removed.scenario": {
    en: "Delete event on Trakt",
    "zh-CN": "Trakt 删除观看记录",
  },
  "daily.syncMode.table.row.removed.default": {
    en: "Line disappears",
    "zh-CN": "对应行消失",
  },
  "daily.syncMode.table.row.removed.incremental": {
    en: "Old line stays",
    "zh-CN": "旧行保留",
  },

  "daily.backfill.heading": { en: "Manual backfill", "zh-CN": "手动回溯" },
  // [1.0.0] Slider + N-days input replaced with a date-range modal.
  // Settings now collapses to a single button that opens the modal.
  "daily.backfill.button.desc": {
    en: "Pick a start and end date, then run a one-shot backfill. Skips dates without an existing Daily Note. Refreshes the enabled Sync sources first, then writes matching Daily Note events.",
    "zh-CN": "选起始和结束日期，跑一次回溯。该天没有 Daily Note 文件就直接跳过。会先刷新已开启的同步来源，再写入匹配的 Daily Note 事件。",
  },
  "daily.backfill.button": { en: "Backfill…", "zh-CN": "手动回溯…" },
  "daily.backfill.modal.title": {
    en: "Backfill Daily Notes",
    "zh-CN": "回溯 Daily Notes",
  },
  "daily.backfill.modal.presetLabel": {
    en: "Quick select",
    "zh-CN": "快捷选择",
  },
  "daily.backfill.modal.preset.last7": {
    en: "Last 7 days",
    "zh-CN": "最近 7 天",
  },
  "daily.backfill.modal.preset.last30": {
    en: "Last 30 days",
    "zh-CN": "最近 30 天",
  },
  "daily.backfill.modal.preset.thisMonth": {
    en: "This month",
    "zh-CN": "本月",
  },
  "daily.backfill.modal.preset.lastMonth": {
    en: "Last month",
    "zh-CN": "上月",
  },
  "daily.backfill.modal.startDate": { en: "Start date", "zh-CN": "起始日期" },
  "daily.backfill.modal.endDate": { en: "End date", "zh-CN": "结束日期" },
  "daily.backfill.modal.rangeDays": {
    en: "Range: {days} day(s)",
    "zh-CN": "区间：{days} 天",
  },
  "daily.backfill.modal.existingNotes": {
    en: "Existing Daily Notes in range: {count}",
    "zh-CN": "其中存在的 Daily Note：{count} 篇",
  },
  "daily.backfill.modal.invalid": {
    en: "Start date must be on or before end date.",
    "zh-CN": "起始日期必须早于或等于结束日期。",
  },
  "daily.backfill.modal.body": {
    en: "For each day in the range:\n• No Daily Note → skip\n• Empty marker region (e.g. from your template) → fill it\n• Marker region already has Trakt content → skip (kept as-is)\n• No markers → append a fresh marker region at the END of the file\n\nContent outside our marker region is NEVER modified.",
    "zh-CN": "对区间内每一天：\n• 没有 Daily Note → 跳过\n• 空的 marker 区间（例如来自模板）→ 填入当天事件\n• marker 区间已有 Trakt 内容 → 跳过（保持原样）\n• 没有 marker → 在文件**末尾**追加 marker 区间和当天事件\n\nmarker 区间之外的内容**永远不会**被修改。",
  },
  "daily.backfill.modal.confirm": { en: "Backfill", "zh-CN": "开始回溯" },
  "daily.backfill.modal.cancel": { en: "Cancel", "zh-CN": "取消" },
  "daily.backfill.done": {
    en: "Sync Trakt: backfilled {wrote} day(s), skipped {skipped}.",
    "zh-CN": "Sync Trakt：已回溯 {wrote} 天，跳过 {skipped} 天。",
  },
  // [0.7.3] Catch-up notice variants — picked in main.ts based on result.
  // Old single-key version exposed the raw {todayMode} enum to the user
  // ("today wrote_new"), which was a bug. Split into purpose-built keys.
  "daily.catchUpDone.todayOnly": {
    en: "Sync Trakt: Daily Note updated.",
    "zh-CN": "Sync Trakt：Daily Note 已更新。",
  },
  "daily.catchUpDone.withPast": {
    en: "Sync Trakt: Daily Note updated, {wrote} past day(s) filled.",
    "zh-CN": "Sync Trakt：Daily Note 已更新，过去 {wrote} 天新填入。",
  },
  "daily.catchUpDone.pastOnly": {
    en: "Sync Trakt: {wrote} past day(s) filled in Daily Notes.",
    "zh-CN": "Sync Trakt：过去 {wrote} 天已填入 Daily Note。",
  },
  // [0.7.3] Result notices for the "sync today only" command.
  "daily.today.updated": {
    en: "Sync Trakt: today's Daily Note updated.",
    "zh-CN": "Sync Trakt：今日 Daily Note 已更新。",
  },
  "daily.today.noFile": {
    en: "Sync Trakt: no Daily Note for today.",
    "zh-CN": "Sync Trakt：今天没有 Daily Note。",
  },
  "daily.today.unchanged": {
    en: "Sync Trakt: today's Daily Note is already up to date.",
    "zh-CN": "Sync Trakt：今日 Daily Note 已是最新。",
  },
  "syncResult.dailyNotes.todayOnly": {
    en: " Daily Note updated.",
    "zh-CN": " Daily Note 已更新。",
  },
  "syncResult.dailyNotes.withPast": {
    en: " Daily Note updated; {wrote} past day(s) filled.",
    "zh-CN": " Daily Note 已更新，过去 {wrote} 天新填入。",
  },
  "syncResult.dailyNotes.pastOnly": {
    en: " {wrote} past day(s) filled in Daily Notes.",
    "zh-CN": " 过去 {wrote} 天已填入 Daily Note。",
  },
  "daily.disabled": {
    en: "Sync Trakt: Daily Notes integration is disabled.",
    "zh-CN": "Sync Trakt：Daily Notes 集成未开启。",
  },
  "cmd.syncDailyNotesToday": {
    en: "Sync to daily notes (today only)",
    "zh-CN": "同步到 Daily Notes（仅今天）",
  },

  // [0.7.4] Static version row at the top of the General tab — name
  // is i18n'd, value comes from this.plugin.manifest.version at render
  // time so it never needs manual maintenance across releases.
  "plugin.version.name": { en: "Version", "zh-CN": "版本" },
  "plugin.version.buildDate": {
    en: "Build created: {date}",
    "zh-CN": "Build 创建时间：{date}",
  },
  "plugin.version.openWhatsNew": {
    en: "Open update notes",
    "zh-CN": "打开更新说明",
  },

  // ── Authentication section ──
  "auth.heading": { en: "Authentication", "zh-CN": "认证" },
  "auth.clientId.name": {
    en: "Trakt client ID",
    "zh-CN": "Trakt 客户端 ID",
  },
  "auth.clientId.desc": {
    en: "Create an app at trakt.tv/oauth/applications to get this.",
    "zh-CN": "在 trakt.tv/oauth/applications 创建应用以获取。",
  },
  "auth.clientSecret.name": {
    en: "Trakt client secret",
    "zh-CN": "Trakt 客户端密钥",
  },
  "auth.clientSecret.desc": {
    en: "From the same application page.",
    "zh-CN": "在同一个应用页面中获取。",
  },
  "auth.connection.name": {
    en: "Connection status",
    "zh-CN": "连接状态",
  },
  "auth.connection.connected": {
    en: "Connected to Trakt.",
    "zh-CN": "已连接到 Trakt。",
  },
  "auth.connection.notConnected": {
    en: "Not connected.",
    "zh-CN": "未连接。",
  },
  "auth.connection.disconnect": { en: "Disconnect", "zh-CN": "断开连接" },
  "auth.connection.connect": { en: "Connect", "zh-CN": "连接" },
  "auth.connection.disconnectedNotice": {
    en: "Sync Trakt: disconnected.",
    "zh-CN": "Sync Trakt：已断开连接。",
  },
  "auth.connection.needCredentialsNotice": {
    en: "Sync Trakt: fill in client ID and secret first.",
    "zh-CN": "Sync Trakt：请先填写客户端 ID 和密钥。",
  },
  "auth.sync.name": {
    en: "Cross-device sync",
    "zh-CN": "多设备同步",
  },
  "auth.sync.desc": {
    en: "Auth state (Trakt tokens, TMDB key, all settings) is stored in this vault's plugin data folder and follows your vault sync. To share auth between Mac and mobile: enable 'Plugin data' in Obsidian Sync, or use any vault sync layer (Syncthing, iCloud + Advanced Data Protection, Cryptomator). The plugin doesn't store anything on a server.",
    "zh-CN":
      "授权状态（Trakt token、TMDB key、所有设置）保存在本 vault 的插件数据文件夹，跟随 vault 同步。要在 Mac 和手机间共享授权：在 Obsidian Sync 设置里勾选「Plugin data」，或使用 Syncthing、iCloud（开启 Advanced Data Protection）、Cryptomator 等任何 vault 同步层。本插件不在任何服务器存储数据。",
  },

  // ── TMDB section ──
  "tmdb.heading": { en: "TMDB", "zh-CN": "TMDB" },
  "tmdb.apiKey.name": { en: "API key", "zh-CN": "API 密钥" },
  "tmdb.apiKey.desc": {
    en: "Recommended. Powers poster images AND complete metadata translation — including genres — in your chosen language. Without a key, posters are skipped and translations fall back to Trakt (covers title / overview / tagline; genres stay English). Get a free key at themoviedb.org/settings/api.",
    "zh-CN":
      "推荐填写。海报图片和**完整的元数据翻译（含 genres）**都依赖它。不填的话海报会跳过，翻译会回退到 Trakt（覆盖 title / overview / tagline，但 genres 留英文）。在 themoviedb.org/settings/api 免费获取。",
  },
  "tmdb.apiKey.placeholder": {
    en: "Paste your API key",
    "zh-CN": "粘贴你的 API 密钥",
  },
  // [0.3.2] TMDB API key test button
  "tmdb.apiKey.test.name": {
    en: "Test API key",
    "zh-CN": "测试 API 密钥",
  },
  "tmdb.apiKey.test.desc": {
    en: "Verify the key above is valid by making a single request to TMDB. Run this after pasting your key to catch typos before your next sync.",
    "zh-CN":
      "向 TMDB 发一次请求验证上方的 key 是否有效。粘贴 key 后建议测一下，避免到了下一次同步才发现是错的。",
  },
  "tmdb.apiKey.test.button": { en: "Test", "zh-CN": "测试" },
  "tmdb.apiKey.test.testing": { en: "Testing…", "zh-CN": "测试中…" },
  "tmdb.apiKey.test.ok": {
    en: "✓ Connected — your TMDB key works.",
    "zh-CN": "✓ 连接成功 —— TMDB key 有效。",
  },
  "tmdb.apiKey.test.empty": {
    en: "Enter a TMDB key above first.",
    "zh-CN": "请先在上方填入 TMDB key。",
  },
  "tmdb.apiKey.test.unauthorized": {
    en: "✗ Invalid key. TMDB rejected the request — check for typos.",
    "zh-CN": "✗ 无效 key。TMDB 拒绝了请求 —— 检查一下有没有拼错。",
  },
  "tmdb.apiKey.test.network": {
    en: "✗ Network error. Couldn't reach TMDB — check your connection.",
    "zh-CN": "✗ 网络错误。连不上 TMDB —— 检查一下网络。",
  },
  // [0.3.2] Inline warning shown under Metadata language when set without TMDB key
  "loc.noTmdbWarning": {
    en: "⚠ No TMDB key set. Translation will fall back to Trakt — title / overview / tagline only; genres stay English and posters are skipped. Add a TMDB key above for full localization.",
    "zh-CN":
      "⚠ 未设置 TMDB key。翻译会回退到 Trakt —— 仅覆盖 title / overview / tagline；genres 留英文、海报跳过。要获得完整本地化，请在上方填入 TMDB key。",
  },
  "tmdb.posterSize.name": { en: "Poster size", "zh-CN": "海报尺寸" },
  "tmdb.posterSize.desc": {
    en: "Image size for posters embedded in notes.",
    "zh-CN": "嵌入笔记的海报图片尺寸。",
  },

  // [0.2.0] TMDB cache controls
  "tmdb.cache.ttl.name": {
    en: "TMDB cache TTL",
    "zh-CN": "TMDB 缓存有效期",
  },
  "tmdb.cache.ttl.desc": {
    en: "How long cached TMDB metadata stays fresh before being revalidated. Stale entries still serve immediately and refresh in the background, so syncs are never blocked. Default 90 days; ±5 days jitter per entry to spread the revalidation load. Set to Never to keep cached entries indefinitely (use the Clear cache button for manual refresh).",
    "zh-CN":
      "缓存的 TMDB 元数据多久之后会被重新验证。过期条目仍会立即返回旧值并在后台异步刷新，同步永远不会被阻塞。默认 90 天，每条目附加 ±5 天随机抖动，分散重验证负载。选「永不过期」即保持缓存不变（要手动刷新请用下方的 Clear 按钮）。",
  },
  "tmdb.cache.ttl.never": {
    en: "Never expire",
    "zh-CN": "永不过期",
  },
  "tmdb.cache.ttl.7": { en: "7 days", "zh-CN": "7 天" },
  "tmdb.cache.ttl.30": { en: "30 days", "zh-CN": "30 天" },
  "tmdb.cache.ttl.90": { en: "90 days (default)", "zh-CN": "90 天（默认）" },
  "tmdb.cache.ttl.365": { en: "365 days", "zh-CN": "365 天" },
  "tmdb.cache.entries": {
    en: "Currently cached: {count} entries",
    "zh-CN": "当前缓存：{count} 条",
  },
  "tmdb.cache.clear.name": {
    en: "Clear TMDB cache",
    "zh-CN": "清空 TMDB 缓存",
  },
  "tmdb.cache.clear.desc": {
    en: "Drops every cached metadata entry. The next sync re-fetches everything from TMDB (takes a few minutes for large libraries). Useful if you suspect cached titles / posters are stale beyond what the TTL captures.",
    "zh-CN":
      "丢弃所有已缓存的元数据。下次同步会从 TMDB 重新拉取全部条目（大库可能需要几分钟）。当你怀疑缓存的标题 / 海报已过时、超出 TTL 范围时可以手动清。",
  },
  "tmdb.cache.clear.button": {
    en: "Clear cache",
    "zh-CN": "清空缓存",
  },
  "tmdb.cache.clear.notice": {
    en: "Sync Trakt: TMDB cache cleared.",
    "zh-CN": "Sync Trakt：TMDB 缓存已清空。",
  },

  // ── Localization section ──
  "loc.heading": { en: "Localization", "zh-CN": "本地化" },
  "loc.metadataLanguage.name": {
    en: "Metadata language",
    "zh-CN": "元数据语言",
  },
  "loc.metadataLanguage.desc": {
    en: "Translates title, overview, tagline, and genres in your synced notes via TMDB. Original English values are preserved in *_original_* frontmatter fields. Tags are not affected. If your filename template uses {{title}}, changing the language renames existing notes on the next sync (controlled by \"Auto-rename on language change\" below). TMDB API key is required for translations; without it, falls back to Trakt's translation endpoint (covers title/overview/tagline only, no genres).",
    "zh-CN":
      "通过 TMDB 翻译同步笔记中的 title、overview、tagline 和 genres。原始英文值保留在 *_original_* frontmatter 字段中。标签不受影响。如果你的文件名模板使用 {{title}}，切换语言时下次同步会自动重命名已有笔记（由下方「切换语言时自动重命名」控制）。翻译需要 TMDB API 密钥；没有 TMDB 密钥时会回退到 Trakt 的翻译端点（仅覆盖 title/overview/tagline，不包含 genres）。",
  },
  "loc.metadataLanguage.default": {
    en: "Default (English / Trakt original)",
    "zh-CN": "默认（英文 / Trakt 原文）",
  },
  "loc.metadataLanguage.custom": {
    en: "Custom (specify below)",
    "zh-CN": "自定义（在下方输入）",
  },
  "loc.customLanguage.name": {
    en: "Custom language code",
    "zh-CN": "自定义语言代码",
  },
  "loc.customLanguage.desc": {
    en: "BCP 47 / ISO format, e.g. tr-TR, th-TH, ar-SA. Leave blank to disable.",
    "zh-CN": "BCP 47 / ISO 格式，比如 tr-TR、th-TH、ar-SA。留空则禁用。",
  },
  "loc.customLanguage.placeholder": {
    en: "Language code",
    "zh-CN": "语言代码",
  },

  // [0.9.0] Metadata fallback language — spec 0008.
  "loc.fallbackLanguage.name": {
    en: "Fallback language",
    "zh-CN": "回退语言",
  },
  "loc.fallbackLanguage.desc": {
    en: "If your metadata language has no translation for an item, try this one instead. When set, the primary language becomes a strict match — variants like zh-TW won't substitute for zh-CN. The English original is always kept as the final fallback in *_original_* frontmatter fields.",
    "zh-CN":
      "当主语言没有对应翻译时，使用这个语言作为回退。设置回退后，主语言变成严格匹配 —— 比如设了简体中文就不会再用繁体中文凑数。英文原文始终保留在 *_original_* frontmatter 字段中作为最终回退。",
  },
  "loc.fallbackLanguage.none": {
    en: "No fallback (loose match)",
    "zh-CN": "不回退（宽松匹配）",
  },

  // [1.0.0 / spec 0009] Auto-rename + Rename now controls.
  "loc.autoRename.name": {
    en: "Auto-rename on language change",
    "zh-CN": "切换语言时自动重命名",
  },
  "loc.autoRename.desc": {
    en: "When you change Metadata language or Fallback language, existing notes are renamed on the next sync to match the new title. Internal Obsidian links auto-update. Note content (frontmatter + body) is updated either way; this only controls the filename.",
    "zh-CN":
      "切换主语言或回退语言后，下次同步会自动重命名已有笔记，让文件名跟新标题一致。Obsidian 内链会自动更新。无论开关如何，frontmatter 和正文都会被更新；这里只控制文件名是否跟着改。",
  },
  "loc.renameNow.name": {
    en: "Rename existing notes now",
    "zh-CN": "现在重命名已有笔记",
  },
  "loc.renameNow.desc": {
    en: "Walk every note in your sync folder and rename it to match your current language + filename-template settings. Useful when auto-rename was off, or to apply changes without waiting for the next sync. Note content is not touched.",
    "zh-CN":
      "扫描同步文件夹里的每一篇笔记，按当前的语言 + 文件名模板设置重命名。当自动重命名关闭、或者你不想等下次同步时使用。笔记内容不会被改动。",
  },
  "loc.renameNow.button": {
    en: "Rename now",
    "zh-CN": "立即重命名",
  },
  "loc.renameNow.done": {
    en: "Sync Trakt: renamed {renamed} of {scanned} note(s).",
    "zh-CN": "Sync Trakt：扫描 {scanned} 篇笔记，重命名 {renamed} 篇。",
  },

  // [1.0.0] Generic "What's new" modal — fires on each new-version launch.
  // See src/release-log.ts for the per-version bilingual content.
  "whatsNew.title": {
    en: "Sync Trakt — what's new",
    "zh-CN": "Sync Trakt —— 更新说明",
  },
  "whatsNew.current": {
    en: "Main update",
    "zh-CN": "本次主要更新",
  },
  "whatsNew.recent": {
    en: "Recent highlights",
    "zh-CN": "近期更新回顾",
  },
  "whatsNew.bugfix": {
    en: "Bug fix",
    "zh-CN": "Bug 修复",
  },
  "whatsNew.footer": {
    en: "Full release notes are on GitHub.",
    "zh-CN": "完整发布说明请见 GitHub。",
  },
  "whatsNew.github": {
    en: "View on GitHub",
    "zh-CN": "在 GitHub 查看",
  },
  "whatsNew.dismiss": {
    en: "Got it",
    "zh-CN": "知道了",
  },
  "loc.uiLanguage.name": {
    en: "Plugin UI language",
    "zh-CN": "插件界面语言",
  },
  "loc.uiLanguage.desc": {
    en: "Language for this plugin's settings, commands, and notices. Existing notes are not affected.",
    "zh-CN":
      "本插件的设置界面、命令和提示语言。已有笔记不会受到影响。",
  },
  "loc.templateLanguage.name": {
    en: "Note template language",
    "zh-CN": "笔记模板语言",
  },
  "loc.templateLanguage.desc": {
    en: "Language for the default Movie / Show note templates. Same options as Metadata language. Bundled translations: English, Simplified Chinese (zh-CN), Traditional Chinese (zh-TW / zh-HK). Other codes fall back to English — customize the template by hand if you want a different language. Switching this auto-rewrites unmodified default templates; customized templates are preserved.",
    "zh-CN":
      "电影 / 剧集笔记默认模板的语言。选项与「元数据语言」一致。内置翻译：英文、简体中文 (zh-CN)、繁体中文 (zh-TW / zh-HK)。其他语言会回退到英文模板 —— 想用其他语言请手动修改模板。切换此项时，没被改过的默认模板会自动更新；已自定义的模板保持不变。",
  },

  // ── Notes section ──
  "notes.heading": { en: "Notes", "zh-CN": "笔记" },
  "notes.folder.name": { en: "Notes folder", "zh-CN": "笔记文件夹" },
  "notes.folder.desc": {
    en: "Vault folder where notes are stored.",
    "zh-CN": "存储笔记的 vault 文件夹。",
  },
  "notes.filename.name": {
    en: "Filename template",
    "zh-CN": "文件名模板",
  },
  "notes.filename.desc": {
    en: "Template for note filenames. Variables: {{title}}, {{year}}, {{imdb_id}}, {{trakt_id}}.",
    "zh-CN":
      "笔记文件名模板。变量：{{title}}、{{year}}、{{imdb_id}}、{{trakt_id}}。",
  },
  "notes.prefix.name": { en: "Property prefix", "zh-CN": "属性前缀" },
  "notes.prefix.desc": {
    en: 'Prefix for all frontmatter properties added by this plugin. E.g. "trakt_" → trakt_title, trakt_watched. Leave blank for no prefix.',
    "zh-CN":
      "本插件添加的所有 frontmatter 属性的前缀。例如 \"trakt_\" → trakt_title、trakt_watched。留空表示不加前缀。",
  },

  // ── Note templates section ──
  "templates.heading": { en: "Note templates", "zh-CN": "笔记模板" },
  "templates.movie.name": {
    en: "Movie note template",
    "zh-CN": "电影笔记模板",
  },
  "templates.movie.desc": {
    en: "Template for the body of movie notes. Uses {{variable}} syntax.",
    "zh-CN": "电影笔记正文的模板。使用 {{变量}} 语法。",
  },
  "templates.show.name": {
    en: "Show template",
    "zh-CN": "剧集模板",
  },
  "templates.show.desc": {
    en: "Template for the body of TV show notes. Uses {{variable}} syntax.",
    "zh-CN": "电视剧笔记正文的模板。使用 {{变量}} 语法。",
  },
  "templates.reset": {
    en: "Reset to default",
    "zh-CN": "恢复默认",
  },

  // ── Tags section ──
  "tags.heading": { en: "Tags", "zh-CN": "标签" },
  "tags.add.name": { en: "Add tags", "zh-CN": "添加标签" },
  "tags.add.desc": {
    en: "Add metadata tags to the note frontmatter on each sync. E.g. #trakt/genre/action.",
    "zh-CN":
      "每次同步时向笔记 frontmatter 添加元数据标签。例如 #trakt/genre/action。",
  },
  "tags.prefix.name": { en: "Tag prefix", "zh-CN": "标签前缀" },
  "tags.prefix.desc": {
    en: 'Prefix for tags. E.g. "trakt" → #trakt/movie, #trakt/genre/action.',
    "zh-CN":
      "标签前缀。例如 \"trakt\" → #trakt/movie、#trakt/genre/action。",
  },

  // ── Tag notes section ──
  "tagNotes.heading": { en: "Tag notes", "zh-CN": "标签笔记" },
  "tagNotes.heading.desc": {
    en: "Tag notes are topic files you link to/from your notes. Stick to one of tags or tag notes, or use both.",
    "zh-CN":
      "标签笔记是你笔记之间相互链接的主题文件。只用标签或只用标签笔记其中之一即可，也可以两者并用。",
  },
  "tagNotes.add.name": {
    en: "Add tag notes to frontmatter",
    "zh-CN": "添加标签笔记到 frontmatter",
  },
  "tagNotes.add.desc": {
    en: "Add a wikilink list property to the note frontmatter on each sync. E.g. [[trakt/genre/action]]. Or leave this setting off and use the {{tag_notes}} template variable to place links in the note body instead.",
    "zh-CN":
      "每次同步时向 frontmatter 添加 wikilink 列表属性。例如 [[trakt/genre/action]]。或保持关闭并使用 {{tag_notes}} 模板变量将链接放在正文中。",
  },
  "tagNotes.create.name": {
    en: "Create tag notes",
    "zh-CN": "创建标签笔记",
  },
  "tagNotes.create.desc": {
    en: "Automatically create tag note files if they don't exist.",
    "zh-CN": "自动创建不存在的标签笔记文件。",
  },
  "tagNotes.folder.name": {
    en: "Tag notes folder",
    "zh-CN": "标签笔记文件夹",
  },
  "tagNotes.folder.desc": {
    en: 'Folder for tag notes. Used for frontmatter links, file creation, and the {{tag_notes}} template variable. E.g. "trakt" → [[trakt/genre/action]].',
    "zh-CN":
      "标签笔记的文件夹。用于 frontmatter 链接、文件创建和 {{tag_notes}} 模板变量。例如 \"trakt\" → [[trakt/genre/action]]。",
  },

  // ── Sync sources section ──
  "syncSources.heading": { en: "Sync sources", "zh-CN": "同步来源" },
  "syncSources.watchlist.name": {
    en: "Sync watchlist",
    "zh-CN": "同步想看清单",
  },
  "syncSources.watchlist.desc": {
    en: "Items you want to watch.",
    "zh-CN": "你想看的内容。",
  },
  "syncSources.favorites.name": {
    en: "Sync favorites",
    "zh-CN": "同步收藏",
  },
  "syncSources.favorites.desc": {
    en: "Items you've marked as favorites.",
    "zh-CN": "你标记为收藏的内容。",
  },
  "syncSources.watched.name": {
    en: "Sync watch history",
    "zh-CN": "同步观看记录",
  },
  "syncSources.watched.desc": {
    en: "Items you've watched. Adds play count and last watched date. Can be large.",
    "zh-CN":
      "你看过的内容。会添加播放次数和最近观看时间。可能数据量较大。",
  },
  "syncSources.watchedDetail.name": {
    en: "Sync watch history (detailed)",
    "zh-CN": "同步详细观看记录",
  },
  "syncSources.watchedDetail.desc": {
    en: "Adds per-episode (or per-movie) watch timestamps to the note body via {{watch_history}}. Re-watches are listed separately. Trakt's /sync/history endpoint is used; subsequent syncs only fetch events newer than the last sync, with a periodic full re-pull (configurable below) to detect deletions.",
    "zh-CN":
      "通过 {{watch_history}} 在笔记正文中添加每集（或每部电影）的观看时间戳；重看会单独列出。使用 Trakt 的 /sync/history 端点；之后每次同步只拉取自上次同步以来的新事件，并按下方配置的周期重新全量刷新一次以检测删除。",
  },

  // [0.2.0] History state controls (only shown when syncWatchedDetail is on)
  "history.fullRefreshInterval.name": {
    en: "History full-refresh interval (days)",
    "zh-CN": "历史全量刷新间隔（天）",
  },
  "history.fullRefreshInterval.desc": {
    en: "How often the plugin re-fetches the entire Trakt watch history (instead of just new events) to detect deletions on Trakt's side. Smaller value = faster deletion detection at the cost of an occasional slow sync. Default 7 days.",
    "zh-CN":
      "插件多久重新拉取一次完整 Trakt 观看历史（而不只是新事件），用于检测 Trakt 那边的删除。值越小，删除检测越快，但偶尔有一次慢同步。默认 7 天。",
  },
  "history.state.stats": {
    en: "Tracked: {movies} movies, {shows} shows, {events} watch events",
    "zh-CN": "已跟踪：{movies} 部电影，{shows} 部剧集，{events} 个观看事件",
  },
  "history.state.clear.name": {
    en: "Clear history state",
    "zh-CN": "清空历史状态",
  },
  "history.state.clear.desc": {
    en: "Drops the locally aggregated watch history. The next sync triggers a full re-pull from Trakt to rebuild it. Useful if you suspect the local state has drifted from Trakt (or as a hard reset).",
    "zh-CN":
      "丢弃本地聚合的观看历史。下次同步会触发一次 Trakt 全量重新拉取来重建。如果你怀疑本地状态已和 Trakt 不一致（或想硬重置）可以用。",
  },
  "history.state.clear.button": {
    en: "Clear history state",
    "zh-CN": "清空历史状态",
  },
  "history.state.clear.notice": {
    en: "Sync Trakt: watch history cleared. Next sync will rebuild it.",
    "zh-CN": "Sync Trakt：观看历史已清空。下次同步会重新构建。",
  },
  "syncSources.ratings.name": {
    en: "Sync ratings",
    "zh-CN": "同步评分",
  },
  "syncSources.ratings.desc": {
    en: "Items you've rated (1–10 scale).",
    "zh-CN": "你评过分的内容（1–10 分）。",
  },

  // ── Sync behavior section ──
  "syncBehavior.heading": { en: "Sync behavior", "zh-CN": "同步行为" },
  "syncBehavior.movies.name": { en: "Sync movies", "zh-CN": "同步电影" },
  "syncBehavior.movies.desc": { en: "Include movies.", "zh-CN": "包含电影。" },
  "syncBehavior.shows.name": { en: "Sync shows", "zh-CN": "同步剧集" },
  "syncBehavior.shows.desc": { en: "Include shows.", "zh-CN": "包含剧集。" },
  "syncBehavior.startup.name": {
    en: "Sync on startup",
    "zh-CN": "启动时同步",
  },
  "syncBehavior.startup.desc": {
    en: "Automatically sync when Obsidian starts.",
    "zh-CN": "Obsidian 启动时自动同步。",
  },
  "syncBehavior.autoSync.name": { en: "Auto-sync", "zh-CN": "自动同步" },
  "syncBehavior.autoSync.desc": {
    en: "Periodically sync in the background.",
    "zh-CN": "定时在后台自动同步。",
  },
  "syncBehavior.interval.name": {
    en: "Auto-sync interval (minutes)",
    "zh-CN": "自动同步间隔（分钟）",
  },
  "syncBehavior.interval.desc": {
    en: "How often to sync. Minimum 5, maximum 360.",
    "zh-CN": "同步频率。最小 5，最大 360。",
  },
  "syncBehavior.communityStats.policy.name": {
    en: "Community rating/votes update policy",
    "zh-CN": "社区评分/投票数更新策略",
  },
  "syncBehavior.communityStats.policy.desc": {
    en: "Controls how often Trakt community rating and vote count are written to media notes. Smart reduces Obsidian Sync version churn from tiny rating/vote changes.",
    "zh-CN":
      "控制 Trakt 社区评分和投票数写入媒体笔记的频率。Smart 可减少微小评分/投票变化造成的 Obsidian Sync 历史版本增长。",
  },
  "syncBehavior.communityStats.policy.everySync": {
    en: "Every sync",
    "zh-CN": "每次同步",
  },
  "syncBehavior.communityStats.policy.smart": {
    en: "Smart",
    "zh-CN": "Smart",
  },
  "syncBehavior.communityStats.interval.name": {
    en: "Minimum update interval (days)",
    "zh-CN": "最短更新间隔（天）",
  },
  "syncBehavior.communityStats.interval.desc": {
    en: "In Smart mode, write community rating/votes after this many days even if the change is small. Minimum 1, maximum 30.",
    "zh-CN":
      "Smart 模式下，即使变化很小，超过这个天数后也允许写入社区评分/投票数。最小 1，最大 30。",
  },
  "syncBehavior.communityStats.ratingThreshold.name": {
    en: "Rating change threshold",
    "zh-CN": "评分变化阈值",
  },
  "syncBehavior.communityStats.ratingThreshold.desc": {
    en: "In Smart mode, write when the absolute community rating change is at least this value.",
    "zh-CN": "Smart 模式下，社区评分的绝对变化大于等于此值时写入。",
  },
  "syncBehavior.communityStats.votesThreshold.name": {
    en: "Votes change threshold (%)",
    "zh-CN": "投票数变化阈值（%）",
  },
  "syncBehavior.communityStats.votesThreshold.desc": {
    en: "In Smart mode, write when the absolute vote-count change is at least this percentage.",
    "zh-CN": "Smart 模式下，投票数的绝对变化比例大于等于此百分比时写入。",
  },
  "syncBehavior.overwrite.name": {
    en: "Overwrite existing note body",
    "zh-CN": "覆盖现有笔记正文",
  },
  "syncBehavior.overwrite.desc": {
    en: "When off, only frontmatter is updated and your notes are preserved. When on, the full note is regenerated from the template on every sync — any edits you've made to the note body will be permanently lost.",
    "zh-CN":
      "关闭时仅更新 frontmatter，正文保持不变。开启后每次同步都会从模板重新生成整个笔记 —— 你对正文做的任何修改都会永久丢失。",
  },
  "syncBehavior.delete.name": {
    en: "Remove notes for deleted items",
    "zh-CN": "删除已移除条目的笔记",
  },
  "syncBehavior.delete.desc": {
    en: "When on, notes from all sync sources are moved to trash.",
    "zh-CN": "开启后，已从所有同步来源移除的条目对应的笔记会被移至回收站。",
  },

  // ── Sync maintenance section ──
  "syncMaintenance.heading": { en: "Maintenance", "zh-CN": "维护" },
  "syncMaintenance.dedupe.name": {
    en: "Deduplicate synced notes",
    "zh-CN": "去重同步笔记",
  },
  "syncMaintenance.dedupe.desc": {
    en: "Scan the current sync folder, group notes by trakt_type + trakt_id, keep the note that best matches your current filename template, and move duplicate copies to Obsidian trash. No Trakt or TMDB API calls are made.",
    "zh-CN":
      "扫描当前同步文件夹，按 trakt_type + trakt_id 分组，保留最符合当前文件名模板的那篇，把重复副本移到 Obsidian 回收站。不会调用 Trakt 或 TMDB API。",
  },
  "syncMaintenance.dedupe.button": {
    en: "Deduplicate",
    "zh-CN": "去重",
  },
  "syncMaintenance.dedupe.running": {
    en: "Deduplicating…",
    "zh-CN": "去重中…",
  },
  "syncMaintenance.dedupe.done": {
    en: "Sync Trakt: dedupe scanned duplicate groups {groups}, moved {trashed} note(s) to trash, renamed {renamed}, failed {failed}.",
    "zh-CN":
      "Sync Trakt：去重扫描到 {groups} 组重复，移入回收站 {trashed} 篇，重命名 {renamed} 篇，失败 {failed}。",
  },

  // ── Confirmation modals ──
  "confirm.cancel": { en: "Cancel", "zh-CN": "取消" },
  "confirm.disconnect.title": {
    en: "Disconnect Trakt account?",
    "zh-CN": "断开 Trakt 账号？",
  },
  "confirm.disconnect.body": {
    en: "This removes the saved Trakt access and refresh tokens from this plugin.\nYour synced notes, settings, TMDB cache, and history state stay in place.\nSync will stop until you connect the account again.",
    "zh-CN":
      "这会移除插件里保存的 Trakt access token 和 refresh token。\n已经同步的笔记、设置、TMDB 缓存和历史状态都会保留。\n重新连接账号之前，插件无法继续同步 Trakt。",
  },
  "confirm.disconnect.confirm": {
    en: "Disconnect",
    "zh-CN": "断开连接",
  },
  "confirm.clearTmdb.title": {
    en: "Clear TMDB cache?",
    "zh-CN": "清空 TMDB 缓存？",
  },
  "confirm.clearTmdb.body": {
    en: "This clears cached TMDB metadata such as poster URLs, translated titles, overviews, taglines, and genres.\nNotes are not deleted or edited immediately. The next sync may re-fetch metadata from TMDB.\nThis runtime cache lives in local device storage, not synced data.json, so clearing it does not reduce Obsidian Sync storage history.",
    "zh-CN":
      "这会清空本机缓存的 TMDB 元数据，包括海报地址、翻译标题、简介、tagline 和类型。\n已有笔记不会立刻被删除或修改。下次同步可能会重新从 TMDB 拉取元数据。\n这些 runtime 缓存位于本机设备存储，不在同步的 data.json 里；清空它不会减少 Obsidian Sync 的历史占用。",
  },
  "confirm.clearTmdb.confirm": {
    en: "Clear cache",
    "zh-CN": "清空缓存",
  },
  "confirm.clearHistory.title": {
    en: "Clear watch-history state?",
    "zh-CN": "清空观看历史状态？",
  },
  "confirm.clearHistory.body": {
    en: "This clears the local detailed watch-history state used to render per-movie and per-episode watch-history sections.\nExisting notes are not deleted immediately. The next detailed sync will rebuild the state from Trakt and may refresh managed watch-history sections.",
    "zh-CN":
      "这会清空本机用于渲染电影和剧集详细观看记录的历史状态。\n已有笔记不会立刻被删除。下次详细同步会从 Trakt 重新构建状态，并可能刷新插件管理的观看记录区块。",
  },
  "confirm.clearHistory.confirm": {
    en: "Clear history state",
    "zh-CN": "清空历史状态",
  },
  "confirm.dedupe.title": {
    en: "Deduplicate synced notes?",
    "zh-CN": "去重同步笔记？",
  },
  "confirm.dedupe.body": {
    en: "This scans the current sync folder and groups notes by trakt_type + trakt_id.\nFor each duplicate group, the note that best matches your current filename template is kept, and the other copies are moved to Obsidian trash.\nNo Trakt or TMDB API calls are made.",
    "zh-CN":
      "这会扫描当前同步文件夹，并按 trakt_type + trakt_id 分组。\n每组重复项会保留最符合当前文件名模板的一篇，其余副本会移入 Obsidian 回收站。\n这个操作不会调用 Trakt 或 TMDB API。",
  },
  "confirm.dedupe.confirm": {
    en: "Deduplicate",
    "zh-CN": "去重",
  },
  "confirm.reset.title": {
    en: "Reset settings to defaults?",
    "zh-CN": "恢复默认设置？",
  },
  "confirm.reset.body": {
    en: "This resets plugin settings and plugin state such as folders, templates, sync sources, cache TTLs, Daily Notes options, TMDB cache, and detailed watch-history state.\nTrakt authentication credentials and UI language are preserved. Existing notes are not deleted.",
    "zh-CN":
      "这会把插件设置和插件状态恢复为默认值，包括文件夹、模板、同步来源、缓存有效期、Daily Notes 选项、TMDB 缓存和详细观看历史状态。\nTrakt 认证信息和界面语言会保留。已有笔记不会被删除。",
  },
  "confirm.reset.confirm": {
    en: "Reset settings",
    "zh-CN": "恢复默认",
  },

  // ── Reset section ──
  "reset.heading": { en: "Reset", "zh-CN": "重置" },
  "reset.button.name": {
    en: "Reset to defaults",
    "zh-CN": "恢复全部默认",
  },
  "reset.button.desc": {
    en: "Clear all settings back to their default values. Authentication credentials are preserved.",
    "zh-CN": "把所有设置恢复为默认值。认证凭据会被保留。",
  },
  "reset.notice": {
    en: "Sync Trakt: settings reset to defaults.",
    "zh-CN": "Sync Trakt：设置已恢复默认。",
  },

  // ── Commands ──
  "cmd.sync": { en: "Sync", "zh-CN": "同步" },
  "cmd.connect": { en: "Connect account", "zh-CN": "连接账号" },
  "cmd.disconnect": { en: "Disconnect account", "zh-CN": "断开账号" },
  "cmd.forceFullHistoryRefresh": {
    en: "Force full watch-history refresh",
    "zh-CN": "强制全量刷新观看历史",
  },
  "cmd.clearTmdbCache": {
    en: "Clear TMDB metadata cache",
    "zh-CN": "清空 TMDB 元数据缓存",
  },

  // ── Notices ──
  "notice.notConnected": {
    en: "Sync Trakt: not connected. Open settings to authenticate.",
    "zh-CN": "Sync Trakt：未连接。请在设置中完成认证。",
  },
  "notice.needCredentials": {
    en: "Sync Trakt: fill in client ID and secret in settings first.",
    "zh-CN": "Sync Trakt：请先在设置中填写客户端 ID 和密钥。",
  },
  "notice.alreadySyncing": {
    en: "Sync Trakt: sync already running.",
    "zh-CN": "Sync Trakt：同步正在进行中。",
  },
  // [0.4.0] Shown once on first launch of 0.4.0 if state was migrated
  // from the legacy `obsidian-sync-trakt` plugin folder.
  "notice.migratedFromLegacyFolder": {
    en: "Sync Trakt: settings migrated from the legacy plugin folder. Your Trakt token, TMDB cache, and history state are preserved.",
    "zh-CN": "Sync Trakt：已从旧插件目录迁移设置。Trakt token、TMDB 缓存和历史状态都已保留。",
  },

  // [0.5.0] Cloud icon tooltips for the per-setting sync toggle. See spec 0003.
  "settings.cloud.synced.tooltip": {
    en: "This setting syncs across devices via Obsidian Sync. Click to make it device-local.",
    "zh-CN": "此设置通过 Obsidian Sync 跨设备同步。点击改为仅本设备生效。",
  },
  "settings.cloud.local.tooltip": {
    en: "This setting is local to this device only. Click to sync it across devices.",
    "zh-CN": "此设置仅在本设备生效。点击改为跨设备同步。",
  },
  "notice.syncComplete": {
    en: "Sync Trakt: {added} new, {updated} updated, {unchanged} unchanged, {removed} removed.",
    "zh-CN": "Sync Trakt：新增 {added}，更新 {updated}，未变 {unchanged}，移除 {removed}。",
  },
  "notice.syncCompleteWithFailures": {
    en: " {failed} failed.",
    "zh-CN": " 失败 {failed}。",
  },
  // [1.0.0] Optional suffix appended when one or more notes were renamed
  // during the sync. Suppressed when 0 to keep the steady-state message
  // (added/updated/unchanged/removed) uncluttered.
  "notice.syncCompleteWithRenames": {
    en: " {renamed} renamed.",
    "zh-CN": " 重命名 {renamed}。",
  },
  "notice.syncFailed": {
    en: "Sync Trakt: sync failed — {msg}",
    "zh-CN": "Sync Trakt：同步失败 — {msg}",
  },
  "notice.syncMore": {
    en: " (+{count} more — see console)",
    "zh-CN": "（还有 {count} 条 — 见控制台）",
  },

  // ── Status bar ──
  "status.syncing": { en: "⟳ Syncing…", "zh-CN": "⟳ 同步中…" },
  "status.dailySyncing": {
    en: "⟳ Syncing Daily Notes…",
    "zh-CN": "⟳ 同步 Daily Notes 中…",
  },
  // [0.7.3] Prefix used by the in-progress sync Notice (re-rendered per
  // progress tick) and by the per-error follow-up notice. Notice strings
  // for one-shot Notices bake the prefix in directly instead.
  "status.prefix": { en: "Sync Trakt: ", "zh-CN": "Sync Trakt：" },

  // ── Progress messages (status bar during sync) ──
  "progress.fetchingTrakt": {
    en: "⟳ Fetching from Trakt…",
    "zh-CN": "⟳ 正在拉取 Trakt 数据…",
  },
  "progress.fetchingTraktHistory": {
    en: "⟳ Fetching new watch events…",
    "zh-CN": "⟳ 正在拉取新观看事件…",
  },
  "progress.fullHistoryRefresh": {
    en: "⟳ Full history refresh (detecting deletions)…",
    "zh-CN": "⟳ 全量刷新观看历史（检测删除）…",
  },
  "progress.fetchingMetadata": {
    en: "⟳ Loading metadata: {done}/{total}",
    "zh-CN": "⟳ 加载元数据：{done}/{total}",
  },
  "progress.fetchingTranslations": {
    en: "⟳ Loading translations: {done}/{total}",
    "zh-CN": "⟳ 加载翻译：{done}/{total}",
  },
  "progress.writingNotes": {
    en: "⟳ Writing notes: {done}/{total}",
    "zh-CN": "⟳ 写入笔记：{done}/{total}",
  },

  // ── Auth modal ──
  "authModal.title": { en: "Connect", "zh-CN": "连接" },
  "authModal.requestingCode": {
    en: "Requesting device code...",
    "zh-CN": "正在请求设备码…",
  },
  "authModal.openLink": {
    en: "Open the link below and enter the code:",
    "zh-CN": "打开下方链接并输入这串代码：",
  },
  "authModal.copyHint": { en: "Click to copy", "zh-CN": "点击复制" },
  "authModal.codeCopied": {
    en: "Sync Trakt: pairing code copied.",
    "zh-CN": "Sync Trakt：配对码已复制。",
  },
  "authModal.codeExpiresIn": {
    en: "Code expires in {n}s",
    "zh-CN": "代码将在 {n} 秒后过期",
  },
  "authModal.codeExpired": {
    en: "Code expired. Please close and try again.",
    "zh-CN": "代码已过期，请关闭后重试。",
  },
  "authModal.cancel": { en: "Cancel", "zh-CN": "取消" },
  "authModal.success": {
    en: "Sync Trakt: connected to Trakt.",
    "zh-CN": "Sync Trakt：已连接到 Trakt。",
  },
  "authModal.errorPrefix": { en: "Error: {msg}", "zh-CN": "错误：{msg}" },
  "authModal.failedStart": {
    en: "Failed to start auth: {msg}",
    "zh-CN": "无法开始授权：{msg}",
  },

  // ── Token refresh errors (thrown from ensureValidToken) ──
  "auth.error.notConnected": {
    en: "Not connected to Trakt. Please connect first.",
    "zh-CN": "尚未连接到 Trakt，请先连接。",
  },
  "auth.error.sessionExpired": {
    en: "Trakt session expired. Please reconnect.",
    "zh-CN": "Trakt 会话已过期，请重新连接。",
  },
} as const;

export type StringKey = keyof typeof STRINGS;

/**
 * Look up a UI string by key in the requested language. Falls back to English
 * if the language is missing for that key, then to the key itself if it's
 * misspelled (defensive — should never happen with TS).
 */
export function t(key: StringKey, lang: UiLanguage): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}

/**
 * Convenience: returns a curried translator bound to one language. Use this
 * inside long render functions to avoid threading `lang` through every call.
 */
export function getTranslator(
  lang: UiLanguage,
): (key: StringKey, vars?: Record<string, string | number>) => string {
  return (key, vars) => {
    let s = t(key, lang);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };
}
