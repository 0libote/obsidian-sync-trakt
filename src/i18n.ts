/**
 * Plugin-level UI strings (settings tab, command palette, notices, auth
 * modal). Out of scope of the upstream i18n proposal — fork-only feature
 * driven by the local user's preference for a Simplified Chinese UI.
 *
 * The METADATA language (frontmatter title/overview/genres/etc.) is a
 * separate axis controlled by `metadataLanguage` and lives in settings.ts;
 * this module is purely about the strings the plugin renders to the user.
 */

export type UiLanguage = "en" | "zh-CN";

const STRINGS = {
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
    en: "Traktr connected.",
    "zh-CN": "Traktr 已连接。",
  },
  "auth.connection.notConnected": {
    en: "Not connected.",
    "zh-CN": "未连接。",
  },
  "auth.connection.disconnect": { en: "Disconnect", "zh-CN": "断开连接" },
  "auth.connection.connect": { en: "Connect", "zh-CN": "连接" },
  "auth.connection.disconnectedNotice": {
    en: "Traktr disconnected.",
    "zh-CN": "Traktr 已断开连接。",
  },
  "auth.connection.needCredentialsNotice": {
    en: "Please enter your client ID and secret first.",
    "zh-CN": "请先填写客户端 ID 和密钥。",
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
    en: "Optional. Get a free key at themoviedb.org/settings/api. If blank, poster images are skipped.",
    "zh-CN":
      "可选。在 themoviedb.org/settings/api 免费获取。留空则跳过海报图片。",
  },
  "tmdb.apiKey.placeholder": {
    en: "Paste your API key",
    "zh-CN": "粘贴你的 API 密钥",
  },
  "tmdb.posterSize.name": { en: "Poster size", "zh-CN": "海报尺寸" },
  "tmdb.posterSize.desc": {
    en: "Image size for posters embedded in notes.",
    "zh-CN": "嵌入笔记的海报图片尺寸。",
  },

  // ── Localization section ──
  "loc.heading": { en: "Localization", "zh-CN": "本地化" },
  "loc.metadataLanguage.name": {
    en: "Metadata language",
    "zh-CN": "元数据语言",
  },
  "loc.metadataLanguage.desc": {
    en: "Translates title, overview, tagline, and genres in your synced notes via TMDB. Original English values are preserved in *_original_* frontmatter fields. Tags are not affected. If your filename template uses {{title}}, changing the language will rename notes on next sync — consider switching to {{original_title}} ({{year}}) first. TMDB API key is required for translations; without it, falls back to Trakt's translation endpoint (covers title/overview/tagline only, no genres).",
    "zh-CN":
      "通过 TMDB 翻译同步笔记中的 title、overview、tagline 和 genres。原始英文值保留在 *_original_* frontmatter 字段中。标签不受影响。如果你的文件名模板使用 {{title}}，切换语言会在下次同步时重命名笔记 —— 建议先把模板改为 {{original_title}} ({{year}})。翻译需要 TMDB API 密钥；没有 TMDB 密钥时会回退到 Trakt 的翻译端点（仅覆盖 title/overview/tagline，不包含 genres）。",
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
    en: "Adds per-episode (or per-movie) watch timestamps to the note body via {{watch_history}}. Re-watches are listed separately. Pulls Trakt's /sync/history endpoint — slower than the summary above for large libraries (one entry per individual watch event, paginated at 100/page).",
    "zh-CN":
      "通过 {{watch_history}} 在笔记正文中添加每集（或每部电影）的观看时间戳；重看会单独列出。会调用 Trakt 的 /sync/history 端点，对大库用户来说比上方的概要同步慢得多（每个观看事件一条记录，每页 100 条）。",
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
    en: "Settings reset to defaults.",
    "zh-CN": "设置已恢复默认。",
  },

  // ── Commands ──
  "cmd.sync": { en: "Sync", "zh-CN": "同步" },
  "cmd.connect": { en: "Connect account", "zh-CN": "连接账号" },
  "cmd.disconnect": { en: "Disconnect account", "zh-CN": "断开账号" },

  // ── Notices ──
  "notice.notConnected": {
    en: "Traktr not connected. Use settings or the command palette to connect.",
    "zh-CN":
      "Traktr 未连接。请通过设置或命令面板连接。",
  },
  "notice.needCredentials": {
    en: "Please configure your client ID and secret in settings first.",
    "zh-CN": "请先在设置中填写客户端 ID 和密钥。",
  },
  "notice.alreadySyncing": {
    en: "Sync already in progress.",
    "zh-CN": "同步已经在进行中。",
  },
  "notice.syncComplete": {
    en: "Sync complete: {added} added, {updated} updated, {removed} removed",
    "zh-CN": "同步完成：新增 {added}，更新 {updated}，移除 {removed}",
  },
  "notice.syncCompleteWithFailures": {
    en: ", {failed} failed",
    "zh-CN": "，失败 {failed}",
  },
  "notice.syncFailed": {
    en: "Traktr sync failed: {msg}",
    "zh-CN": "Traktr 同步失败：{msg}",
  },
  "notice.syncMore": {
    en: " (+{count} more — see console)",
    "zh-CN": "（还有 {count} 条 — 见控制台）",
  },

  // ── Status bar ──
  "status.syncing": { en: "⟳ Syncing…", "zh-CN": "⟳ 同步中…" },
  "status.prefix": { en: "Traktr: ", "zh-CN": "Traktr：" },

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
    en: "Code copied to clipboard!",
    "zh-CN": "代码已复制到剪贴板！",
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
    en: "Successfully connected!",
    "zh-CN": "已成功连接！",
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
