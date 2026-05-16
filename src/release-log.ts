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
    version: "1.1.0",
    en: "Local runtime cache storage keeps large TMDB and detailed-history caches out of synced data.json.",
    zh: "本机运行缓存存储：大型 TMDB 与详细观看历史缓存不再写入同步的 data.json。",
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
