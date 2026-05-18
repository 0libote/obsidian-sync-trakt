/**
 * [1.0.0] Bilingual release-notice log shown by WhatsNewModal.
 *
 * Each entry renders as one line in the modal. `isBugfix: true` adds a
 * `(Bug fix)` / `(Bug 修复)` tag inline after the version, so users can
 * tell at a glance whether a row added a feature or fixed a bug.
 *
 * When adding a new version: **prepend** a new entry to the top (the
 * list is in reverse-chronological order). main.ts filters to entries
 * whose version is strictly greater than the user's last-seen version,
 * so a repeat upgrader only sees what's new since they last clicked
 * "Got it".
 *
 * Entries are inline data (not i18n keys) because the content is
 * historical fact and bilingual at write-time — threading 50+ separate
 * i18n keys for each release line would be more bookkeeping for the
 * same effect.
 */

export interface ReleaseLogEntry {
  version: string;
  isBugfix?: boolean;
  titleEn?: string;
  titleZh?: string;
  en: string;
  zh: string;
}

export interface ReleaseHighlight {
  en: string;
  zh: string;
}

/**
 * Reverse-chronological release log. Topmost = most recent.
 *
 * Scope decision: log starts at 0.6.0 (settings UI tabs + 11-language
 * template expansion). Anything earlier (0.1.x – 0.5.x) is plugin
 * scaffolding / infra work — none of those releases reached enough
 * users to warrant explanation, and the "shipped" entry list would
 * balloon for marginal value.
 */
export const RELEASE_LOG: ReleaseLogEntry[] = [
  {
    version: "1.2.0",
    titleEn: "Daily Notes-only auto-sync",
    titleZh: "Daily Notes 独立自动同步",
    en: "Daily Notes can now auto-sync on their own interval without running the full media-note write pipeline. The Daily-only path refreshes the same Trakt sources, detailed watch history, and TMDB / Trakt metadata used by full sync, then updates existing Daily Note files only. Media notes are not created, renamed, deleted, or rewritten. Full sync and Daily-only sync share one lock, so manual buttons and both timers cannot write concurrently. The timer settings are device-local by default, including existing installs after upgrade, so a Mac can refresh Daily Notes frequently while iOS keeps automatic timers off. If the rendered Daily Note block is unchanged, the Daily-only timer does not rewrite the file or show an updated notice. Full sync now folds the Daily Notes result into the full sync completion notice instead of showing two separate final notices.",
    zh: "Daily Notes 现在可以使用独立间隔自动同步，不必触发完整媒体笔记写入流程。Daily-only 路径会刷新与 full sync 相同的 Trakt 来源、详细观看历史以及 TMDB / Trakt 元数据，然后只更新已存在的 Daily Note 文件；不会创建、重命名、删除或重写媒体笔记。full sync 和 Daily-only sync 共用同一个锁，所以手动按钮和两个定时器不会并发写入。这个定时器设置默认按设备本地保存，老用户升级后也会迁移成默认本地，因此 Mac 可以高频刷新 Daily Notes，iOS 可以保持自动定时关闭。如果渲染出来的 Daily Note 区块没有变化，Daily-only 定时器不会重写文件，也不会显示“已更新”。完整同步会把 Daily Notes 结果合并到完整同步完成通知里，不再连续显示两个最终通知。",
  },
  {
    version: "1.1.2",
    titleEn: "TMDB cache invalidation bugfix",
    titleZh: "TMDB 缓存失效修复",
    isBugfix: true,
    en: "Fixes an upgrade issue where users who already installed 1.1.1 could stay on stale TMDB runtime-cache entries written by older title-picking logic. Those entries are now refetched automatically, so Daily Notes and media-note filenames can update from old English or wrong-locale titles without requiring users to manually clear the TMDB cache.",
    zh: "修复已经安装 1.1.1 的用户可能继续读取旧版标题选择逻辑写入的 TMDB runtime 缓存的问题。旧缓存现在会自动重新拉取，因此 Daily Notes 和媒体笔记文件名可以从旧英文标题或错误 locale 标题更新回来，不需要用户手动清空 TMDB 缓存。",
  },
  {
    version: "1.1.1",
    titleEn: "Runtime cache storage and safer maintenance",
    titleZh: "运行缓存存储与维护安全性",
    en: "Large TMDB and detailed-watch-history caches now live outside the vault in local runtime storage, so synced data.json stays small and frequent auto-sync no longer rewrites multi-megabyte plugin data. A synced full-refresh coordinator keeps Mac / Windows / iOS devices from writing stale detailed history. Same-ID note lookup avoids duplicate notes during Obsidian Sync races, and the Sync tab includes a confirmed dedupe tool for existing duplicates. Critical maintenance actions now show second-confirmation dialogs with impact details. Strict TMDB fallback keeps metadata locale boundaries intact: zh-CN, zh-TW / zh-HK, Japanese, Korean, and fallback languages are not substituted across incompatible variants; original-language titles are only used when compatible with the user's metadata locale. TMDB cache entries from older title-picking logic are refetched automatically so stale cached titles do not keep Daily Notes or media notes in the wrong language.",
    zh: "大型 TMDB 缓存与详细观看历史缓存现在放在 vault 外的本机运行存储里，同步的 data.json 保持很小，频繁自动同步不会再重写数 MB 的插件数据。同步的全量刷新协调字段会避免 Mac / Windows / iOS 设备用过期详细历史写回笔记。同 ID 笔记实时查找可避免 Obsidian Sync 竞态下生成重复笔记，同步页也提供带确认弹窗的去重工具来清理已有重复项。断开连接、清空缓存、清空历史状态、去重同步笔记、恢复默认等关键维护操作，现在统一增加二次确认弹窗并说明具体影响。严格 TMDB 回退会保持 metadata locale 边界：zh-CN、zh-TW / zh-HK、日文、韩文和回退语言不会跨不兼容变体互相顶替；只有与用户 metadata locale 兼容的原语言标题才会用于补标题。旧版标题选择逻辑写入过的 TMDB 缓存会自动重新拉取，避免错误缓存标题继续让 Daily Notes 或媒体笔记停留在错误语言。",
  },
  {
    version: "1.0.1",
    isBugfix: true,
    en: "Repair malformed plugin frontmatter on existing media notes and avoid YAML parser failures during sync.",
    zh: "修复已有媒体笔记中损坏的插件 frontmatter，避免同步时被 YAML 解析错误卡住。",
  },
  {
    version: "1.0.0",
    en: "Filename auto-rename on language change. Default ON — disable in Settings → Localization if you'd rather rename manually.",
    zh: "切换语言时自动重命名文件名。默认开启 —— 想手动重命名的话，可在「设置 → 本地化」关闭。",
  },
  {
    version: "0.9.0",
    en: "Metadata language fallback — strict primary + user-defined secondary.",
    zh: "元数据语言回退 —— 严格主语言 + 用户自定义次选语言。",
  },
  {
    version: "0.8.1",
    isBugfix: true,
    en: "Address Obsidian directory submission validator findings.",
    zh: "通过 Obsidian 官方目录提交检查。",
  },
  {
    version: "0.8.0",
    en: "Incremental sync mode for Daily Notes (preserves your edits inside markers).",
    zh: "Daily Notes 增量同步模式（保护 marker 之间的手动编辑）。",
  },
  {
    version: "0.7.4",
    en: "Plugin version row at top of General tab.",
    zh: "通用 tab 顶部显示当前版本号。",
  },
  {
    version: "0.7.3",
    isBugfix: true,
    en: 'Unified all notifications under "Sync Trakt:" prefix.',
    zh: "所有通知统一加上「Sync Trakt:」前缀。",
  },
  {
    version: "0.7.2",
    isBugfix: true,
    en: "Daily Notes — empty marker pair now gets filled on backfill.",
    zh: "Daily Notes —— 空 marker 区间现在能被回填。",
  },
  {
    version: "0.7.1",
    isBugfix: true,
    en: "Address Obsidian bot lint + post-PR audit findings.",
    zh: "处理 Obsidian bot lint + PR review 后续审计问题。",
  },
  {
    version: "0.7.0",
    en: "Daily Notes integration — auto-inject per-event lines (watched / watchlist / favorite / rated) into your Daily Note.",
    zh: "Daily Notes 集成 —— 自动把每条事件（观看 / 想看 / 收藏 / 评分）注入到你的 Daily Note。",
  },
  {
    version: "0.6.0",
    en: "Tabbed settings UI + 11 bundled note-template languages.",
    zh: "设置页 tab 化 + 11 种内置笔记模板语言。",
  },
];

export const RECENT_UPDATE_HIGHLIGHTS: ReleaseHighlight[] = [
  {
    en: "Daily Notes can auto-sync independently from full media-note sync, using the same source data without rewriting media notes.",
    zh: "Daily Notes 可独立于完整媒体笔记同步自动刷新，复用同一套来源数据，但不重写媒体笔记。",
  },
  {
    en: "Large TMDB and detailed-watch-history caches live in local runtime storage, keeping synced data.json small.",
    zh: "大型 TMDB 与详细观看历史缓存放在本机 runtime storage，同步的 data.json 保持小体积。",
  },
  {
    en: "Automatic filename rename keeps localized media notes aligned when metadata language changes.",
    zh: "切换元数据语言后，媒体笔记文件名可自动跟随重命名。",
  },
  {
    en: "Metadata fallback lets you use a strict primary language with a secondary fallback.",
    zh: "元数据语言支持严格主语言 + 次选回退语言。",
  },
  {
    en: "Daily Notes integration can write watched / watchlist / favorite / rating events into daily notes.",
    zh: "Daily Notes 集成可把观看、想看、收藏、评分事件写入日记。",
  },
  {
    en: "Tabbed settings and bundled note templates make the plugin easier to use across languages.",
    zh: "设置页已 tab 化，并内置多语言笔记模板，跨语言使用更清晰。",
  },
];

export function entryForVersion(version: string): ReleaseLogEntry | undefined {
  return RELEASE_LOG.find((e) => e.version === version);
}

/**
 * Strict-greater-than comparator for `x.y.z` semver strings.
 *
 * - `isVersionNewer("1.0.0", "0.9.0")` → true
 * - `isVersionNewer("0.7.10", "0.7.9")` → true (numeric, not lexicographic)
 * - `isVersionNewer("1.0.0", "1.0.0")` → false (strict)
 * - `isVersionNewer("1.0.0", "")` → true (empty = never-seen, "lower than" anything)
 * - `isVersionNewer("", "1.0.0")` → false
 *
 * We don't depend on a semver package; our versions are plain x.y.z with
 * no pre-release suffixes, so a hand-rolled numeric comparator is enough.
 */
export function isVersionNewer(a: string, b: string): boolean {
  if (!a) return false;
  if (!b) return true;
  const pa = a.split(".").map((n) => parseInt(n, 10));
  const pb = b.split(".").map((n) => parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

/**
 * Return all RELEASE_LOG entries strictly newer than `sinceVersion`.
 * Order is preserved (most-recent first). Used by main.ts to trim the
 * What's-new modal to just "what changed since you last clicked Got it".
 *
 * When `sinceVersion` is "" (never shown), returns the entire log.
 */
export function entriesNewerThan(sinceVersion: string): ReleaseLogEntry[] {
  return RELEASE_LOG.filter((e) => isVersionNewer(e.version, sinceVersion));
}
