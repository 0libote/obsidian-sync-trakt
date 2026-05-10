/**
 * Smoke tests for the i18n implementation. Run with:
 *   npm run test:i18n
 *
 * These tests exercise pure logic without needing a real Obsidian instance.
 * They cover:
 *   1. Backward compat: language="" produces byte-identical frontmatter
 *   2. i18n on with TMDB-style translation: localized fields + originals
 *   3. Tags use original English genres regardless of language
 *   4. Trakt translation picker prefers exact country match
 *   5. Effective language helper handles dropdown + custom mode
 */

import {
  buildFrontmatterData,
  renderNote,
  renderWatchHistorySection,
  renderWatchHistoryList,
} from "../src/note-renderer";
import {
  pickTraktTranslation,
  type TraktTranslation,
} from "../src/trakt-api";
import {
  aggregateMovieHistory,
  aggregateShowHistory,
} from "../src/sync-engine";
import type { TraktHistoryItem } from "../src/types";
import {
  DEFAULT_SETTINGS,
  DEFAULT_MOVIE_TEMPLATE_EN,
  DEFAULT_MOVIE_TEMPLATE_ZH_CN,
  DEFAULT_MOVIE_TEMPLATE_ZH_TW,
  DEFAULT_SHOW_TEMPLATE_EN,
  DEFAULT_SHOW_TEMPLATE_ZH_CN,
  DEFAULT_SHOW_TEMPLATE_ZH_TW,
  getDefaultMovieTemplate,
  getDefaultShowTemplate,
  getEffectiveMetadataLanguage,
  getEffectiveTemplateLanguage,
  type TraktrSettings,
} from "../src/settings";
import { getTranslator, t } from "../src/i18n";
import type { NormalizedItem } from "../src/types";

let failures = 0;
let passes = 0;

function assertEq<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passes++;
    console.log(`  PASS ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}`);
    console.error(`    actual:   ${a}`);
    console.error(`    expected: ${e}`);
  }
}

function assertTrue(cond: boolean, label: string) {
  if (cond) {
    passes++;
    console.log(`  PASS ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}`);
  }
}

function assertContains(haystack: string, needle: string, label: string) {
  if (haystack.includes(needle)) {
    passes++;
    console.log(`  PASS ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}: missing ${JSON.stringify(needle)}`);
    console.error(`    in: ${haystack.slice(0, 200)}`);
  }
}

function assertNotContains(haystack: string, needle: string, label: string) {
  if (!haystack.includes(needle)) {
    passes++;
    console.log(`  PASS ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}: should not contain ${JSON.stringify(needle)}`);
  }
}

function makeMovie(): NormalizedItem {
  return {
    type: "movie",
    title: "The Dark Knight",
    year: 2008,
    ids: { trakt: 4, slug: "the-dark-knight-2008", imdb: "tt0468569", tmdb: 155 },
    overview: "Batman fights crime in Gotham.",
    genres: ["Action", "Crime", "Drama"],
    runtime: 152,
    rating: 8.5,
    votes: 12345,
    certification: "PG-13",
    country: "us",
    language: "en",
    status: "released",
    tagline: "Why so serious?",
    released: "2008-07-18",
    watchlist: true,
    watchlist_added_at: "2024-01-01T00:00:00.000Z",
    originalTitle: "The Dark Knight",
    originalOverview: "Batman fights crime in Gotham.",
    originalTagline: "Why so serious?",
    originalGenres: ["Action", "Crime", "Drama"],
  };
}

function makeI18nMovie(): NormalizedItem {
  // Simulate what sync-engine would produce after applyTranslation():
  //  - title/overview/tagline/genres replaced with localized values
  //  - originalTitle/Overview/Tagline/Genres still hold English
  return {
    type: "movie",
    title: "黑暗骑士",
    year: 2008,
    ids: { trakt: 4, slug: "the-dark-knight-2008", imdb: "tt0468569", tmdb: 155 },
    overview: "蝙蝠侠在哥谭打击犯罪。",
    genres: ["动作", "犯罪", "剧情"],
    runtime: 152,
    rating: 8.5,
    votes: 12345,
    certification: "PG-13",
    country: "us",
    language: "en",
    status: "released",
    tagline: "为什么这么严肃？",
    released: "2008-07-18",
    watchlist: true,
    watchlist_added_at: "2024-01-01T00:00:00.000Z",
    originalTitle: "The Dark Knight",
    originalOverview: "Batman fights crime in Gotham.",
    originalTagline: "Why so serious?",
    originalGenres: ["Action", "Crime", "Drama"],
  };
}

function withSettings(overrides: Partial<TraktrSettings> = {}): TraktrSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

// ── Test 1: backward compatibility ────────────────────────────────────────
console.log("\n[1] Backward compat — metadataLanguage='' produces no original_* fields");
{
  const item = makeMovie();
  const settings = withSettings({});

  const fm = buildFrontmatterData(item, settings);
  const keys = Object.keys(fm);

  assertTrue(
    !keys.some((k) => k.includes("original_")),
    "no trakt_original_* keys when i18n is off",
  );
  assertTrue(
    !keys.some((k) => k.includes("metadata_language")),
    "no trakt_metadata_language key when i18n is off",
  );
  assertEq(fm["trakt_title"], "The Dark Knight", "trakt_title is English");
  assertEq(
    fm["trakt_genres"],
    ["Action", "Crime", "Drama"],
    "trakt_genres is English",
  );
  assertEq(
    fm["tags"],
    ["trakt/movie", "trakt/genre/Action", "trakt/genre/Crime", "trakt/genre/Drama", "trakt/watchlist"],
    "tags use English genres",
  );
}

// ── Test 2: i18n on (TMDB-style) ──────────────────────────────────────────
console.log("\n[2] i18n on (zh-CN) — localized fields + English originals + English tags");
{
  const item = makeI18nMovie();
  const settings = withSettings({ metadataLanguage: "zh-CN" });

  const fm = buildFrontmatterData(item, settings);

  assertEq(fm["trakt_title"], "黑暗骑士", "trakt_title is Chinese");
  assertEq(fm["trakt_original_title"], "The Dark Knight", "trakt_original_title is English");
  assertEq(fm["trakt_overview"], "蝙蝠侠在哥谭打击犯罪。", "trakt_overview is Chinese");
  assertEq(
    fm["trakt_original_overview"],
    "Batman fights crime in Gotham.",
    "trakt_original_overview is English",
  );
  assertEq(fm["trakt_tagline"], "为什么这么严肃？", "trakt_tagline is Chinese");
  assertEq(fm["trakt_original_tagline"], "Why so serious?", "trakt_original_tagline is English");
  assertEq(fm["trakt_genres"], ["动作", "犯罪", "剧情"], "trakt_genres is Chinese");
  assertEq(
    fm["trakt_original_genres"],
    ["Action", "Crime", "Drama"],
    "trakt_original_genres is English",
  );
  assertEq(fm["trakt_metadata_language"], "zh-CN", "trakt_metadata_language is set");
  assertEq(
    fm["tags"],
    ["trakt/movie", "trakt/genre/Action", "trakt/genre/Crime", "trakt/genre/Drama", "trakt/watchlist"],
    "tags STILL use English genres (preserves Dataview queries)",
  );
}

// ── Test 3: render full note with i18n ────────────────────────────────────
console.log("\n[3] renderNote — Chinese body, English tags, original_* template vars");
{
  const item = makeI18nMovie();
  const settings = withSettings({
    metadataLanguage: "zh-CN",
    movieNoteTemplate: "TITLE={{title}}\nORIG={{original_title}}\nGENRES={{genres}}\nORIG_GENRES={{original_genres}}\nLANG={{metadata_language}}\n",
  });

  const note = renderNote(item, settings);

  assertContains(note, "TITLE=黑暗骑士", "{{title}} renders Chinese");
  assertContains(note, "ORIG=The Dark Knight", "{{original_title}} renders English");
  assertContains(note, "GENRES=动作, 犯罪, 剧情", "{{genres}} renders Chinese list");
  assertContains(
    note,
    "ORIG_GENRES=Action, Crime, Drama",
    "{{original_genres}} renders English list",
  );
  assertContains(note, "LANG=zh-CN", "{{metadata_language}} renders the active code");
  // Frontmatter should contain English tag
  assertContains(note, "- trakt/genre/Action", "tag list keeps English");
  assertNotContains(note, "- trakt/genre/动作", "tag list does NOT contain Chinese genre");
}

// ── Test 4: backward compat — original_* template vars still resolve ──────
console.log("\n[4] i18n off — {{original_title}} still resolves (to English)");
{
  const item = makeMovie();
  const settings = withSettings({
    movieNoteTemplate: "ORIG={{original_title}}\nLANG=[{{metadata_language}}]\n",
  });
  const note = renderNote(item, settings);
  assertContains(note, "ORIG=The Dark Knight", "{{original_title}} resolves when i18n off");
  assertContains(note, "LANG=[]", "{{metadata_language}} is empty when i18n off");
}

// ── Test 5: pickTraktTranslation ──────────────────────────────────────────
console.log("\n[5] pickTraktTranslation — country-exact > language-only > null");
{
  const translations: TraktTranslation[] = [
    { language: "zh", country: "tw", title: "黑暗騎士", overview: "" },
    { language: "zh", country: "cn", title: "黑暗骑士", overview: "..." },
    { language: "ja", country: "jp", title: "ダークナイト", overview: "..." },
  ];

  const cn = pickTraktTranslation(translations, "zh-CN");
  assertEq(cn?.title, "黑暗骑士", "zh-CN picks country=cn");

  const tw = pickTraktTranslation(translations, "zh-TW");
  assertEq(tw?.title, "黑暗騎士", "zh-TW picks country=tw");

  const hk = pickTraktTranslation(translations, "zh-HK");
  // No HK — falls back to first language=zh entry (tw)
  assertEq(hk?.title, "黑暗騎士", "zh-HK falls back to first zh entry");

  const ja = pickTraktTranslation(translations, "ja-JP");
  assertEq(ja?.title, "ダークナイト", "ja-JP picks Japanese");

  const fr = pickTraktTranslation(translations, "fr-FR");
  assertEq(fr, null, "fr-FR returns null when no match");

  const empty = pickTraktTranslation([], "zh-CN");
  assertEq(empty, null, "empty input returns null");

  const noCountry = pickTraktTranslation(
    [{ language: "ko", title: "다크 나이트", overview: "" }],
    "ko-KR",
  );
  assertEq(noCountry?.title, "다크 나이트", "matches when entry has no country");
}

// ── Test 6: getEffectiveMetadataLanguage ──────────────────────────────────
console.log("\n[6] getEffectiveMetadataLanguage — preset / custom / disabled");
{
  assertEq(getEffectiveMetadataLanguage(withSettings({})), "", "default is disabled");
  assertEq(
    getEffectiveMetadataLanguage(withSettings({ metadataLanguage: "zh-CN" })),
    "zh-CN",
    "preset value passes through",
  );
  assertEq(
    getEffectiveMetadataLanguage(
      withSettings({ metadataLanguage: "custom", customMetadataLanguage: "tr-TR" }),
    ),
    "tr-TR",
    "custom mode reads customMetadataLanguage",
  );
  assertEq(
    getEffectiveMetadataLanguage(
      withSettings({ metadataLanguage: "custom", customMetadataLanguage: "" }),
    ),
    "",
    "custom mode with empty string is disabled",
  );
}

// ── Test 7: filename-stable original genres ───────────────────────────────
console.log("\n[7] addTagNotes uses original genres for wikilinks");
{
  const item = makeI18nMovie();
  const settings = withSettings({
    metadataLanguage: "zh-CN",
    addTagNotes: true,
    tagNotesFolder: "trakt",
  });
  const fm = buildFrontmatterData(item, settings);
  const tagNotes = fm["trakt_tag_notes"] as string[];
  assertTrue(
    tagNotes.includes("[[trakt/genre/Action]]"),
    "tag note links use English genre 'Action'",
  );
  assertTrue(
    !tagNotes.some((l) => l.includes("动作")),
    "tag note links do NOT include localized genre",
  );
}

// ── Test 8: UI language strings ───────────────────────────────────────────
console.log("\n[8] UI translator returns correct language");
{
  assertEq(t("auth.heading", "en"), "Authentication", "EN auth heading");
  assertEq(t("auth.heading", "zh-CN"), "认证", "zh-CN auth heading");
  assertEq(t("loc.heading", "en"), "Localization", "EN loc heading");
  assertEq(t("loc.heading", "zh-CN"), "本地化", "zh-CN loc heading");
  assertEq(t("templates.reset", "en"), "Reset to default", "EN reset button");
  assertEq(t("templates.reset", "zh-CN"), "恢复默认", "zh-CN reset button");

  const tZh = getTranslator("zh-CN");
  assertEq(
    tZh("notice.syncComplete", { added: 5, updated: 3, removed: 1 }),
    "同步完成：新增 5，更新 3，移除 1",
    "interpolated zh-CN notice with vars",
  );
  const tEn = getTranslator("en");
  assertEq(
    tEn("notice.syncComplete", { added: 5, updated: 3, removed: 1 }),
    "Sync complete: 5 added, 3 updated, 1 removed",
    "interpolated en notice with vars",
  );
}

// ── Test 9: Template language helpers ─────────────────────────────────────
console.log(
  "\n[9] getDefault*Template returns correct-language template (or English fallback)",
);
{
  // English variants → English template
  assertEq(getDefaultMovieTemplate(""), DEFAULT_MOVIE_TEMPLATE_EN, "'' → EN");
  assertEq(getDefaultMovieTemplate("en"), DEFAULT_MOVIE_TEMPLATE_EN, "en → EN");
  assertEq(
    getDefaultMovieTemplate("en-US"),
    DEFAULT_MOVIE_TEMPLATE_EN,
    "en-US → EN (only zh has bundled translations besides English)",
  );

  // Simplified Chinese
  assertEq(
    getDefaultMovieTemplate("zh-CN"),
    DEFAULT_MOVIE_TEMPLATE_ZH_CN,
    "zh-CN → Simplified",
  );
  assertEq(
    getDefaultShowTemplate("zh-CN"),
    DEFAULT_SHOW_TEMPLATE_ZH_CN,
    "zh-CN show → Simplified",
  );

  // Traditional Chinese (zh-TW + zh-HK both)
  assertEq(
    getDefaultMovieTemplate("zh-TW"),
    DEFAULT_MOVIE_TEMPLATE_ZH_TW,
    "zh-TW → Traditional",
  );
  assertEq(
    getDefaultMovieTemplate("zh-HK"),
    DEFAULT_MOVIE_TEMPLATE_ZH_TW,
    "zh-HK → Traditional (alias of zh-TW)",
  );
  assertEq(
    getDefaultShowTemplate("zh-TW"),
    DEFAULT_SHOW_TEMPLATE_ZH_TW,
    "zh-TW show → Traditional",
  );

  // Other languages → English fallback
  assertEq(
    getDefaultMovieTemplate("ja-JP"),
    DEFAULT_MOVIE_TEMPLATE_EN,
    "ja-JP → EN fallback (no bundled JP translation)",
  );
  assertEq(
    getDefaultMovieTemplate("fr-FR"),
    DEFAULT_MOVIE_TEMPLATE_EN,
    "fr-FR → EN fallback",
  );
  assertEq(
    getDefaultMovieTemplate("tr-TR"),
    DEFAULT_MOVIE_TEMPLATE_EN,
    "custom code → EN fallback",
  );

  // Content sanity: each language's template contains its own characters
  assertTrue(
    DEFAULT_MOVIE_TEMPLATE_ZH_CN.includes("## 剧情简介"),
    "zh-CN movie has '剧情简介' (Simplified)",
  );
  assertTrue(
    DEFAULT_MOVIE_TEMPLATE_ZH_TW.includes("## 劇情簡介"),
    "zh-TW movie has '劇情簡介' (Traditional)",
  );
  assertTrue(
    DEFAULT_MOVIE_TEMPLATE_ZH_TW.includes("## 我的筆記"),
    "zh-TW movie has Traditional '我的筆記' (not 笔记)",
  );
  assertTrue(
    !DEFAULT_MOVIE_TEMPLATE_ZH_TW.includes("剧情"),
    "zh-TW does NOT contain Simplified '剧'",
  );
  assertTrue(
    !DEFAULT_MOVIE_TEMPLATE_ZH_CN.includes("劇情"),
    "zh-CN does NOT contain Traditional '劇'",
  );
  assertTrue(
    DEFAULT_MOVIE_TEMPLATE_EN.includes("## Overview"),
    "en movie still has 'Overview' heading",
  );
}

// ── Test 9b: getEffectiveTemplateLanguage ────────────────────────────────
console.log("\n[9b] getEffectiveTemplateLanguage — preset / custom / disabled");
{
  assertEq(
    getEffectiveTemplateLanguage(withSettings({})),
    "",
    "default is ''",
  );
  assertEq(
    getEffectiveTemplateLanguage(
      withSettings({ templateLanguage: "zh-TW" }),
    ),
    "zh-TW",
    "preset passes through",
  );
  assertEq(
    getEffectiveTemplateLanguage(
      withSettings({
        templateLanguage: "custom",
        customTemplateLanguage: "tr-TR",
      }),
    ),
    "tr-TR",
    "custom mode reads customTemplateLanguage",
  );
  assertEq(
    getEffectiveTemplateLanguage(
      withSettings({
        templateLanguage: "custom",
        customTemplateLanguage: "",
      }),
    ),
    "",
    "custom + empty string is disabled",
  );
}

// ── Test 10: Defaults stay backward-compatible ────────────────────────────
console.log("\n[10] DEFAULT_SETTINGS still produces English UI + EN templates");
{
  assertEq(DEFAULT_SETTINGS.uiLanguage, "en", "uiLanguage default is 'en'");
  assertEq(
    DEFAULT_SETTINGS.templateLanguage,
    "",
    "templateLanguage default is '' (resolves to EN)",
  );
  assertEq(
    DEFAULT_SETTINGS.customTemplateLanguage,
    "",
    "customTemplateLanguage default is ''",
  );
  assertEq(
    DEFAULT_SETTINGS.movieNoteTemplate,
    DEFAULT_MOVIE_TEMPLATE_EN,
    "movieNoteTemplate default is the English template",
  );
  assertEq(
    DEFAULT_SETTINGS.showNoteTemplate,
    DEFAULT_SHOW_TEMPLATE_EN,
    "showNoteTemplate default is the English template",
  );
}

// ── Test 11: Watch history aggregation (movies) ───────────────────────────
console.log(
  "\n[11] aggregateMovieHistory groups + sorts re-watches per movie id",
);
{
  // Fixture: 3 history entries — Inception watched twice (2024-06 + 2025-02),
  // The Dark Knight watched once. The 2024-06 entry comes AFTER 2025-02 in
  // input order to confirm the helper sorts chronologically.
  const history: TraktHistoryItem[] = [
    {
      id: 1,
      watched_at: "2025-02-14T20:15:00.000Z",
      action: "watch",
      type: "movie",
      movie: { title: "Inception", year: 2010, ids: { trakt: 1, slug: "inception-2010" } },
    },
    {
      id: 2,
      watched_at: "2024-06-10T22:30:00.000Z",
      action: "watch",
      type: "movie",
      movie: { title: "Inception", year: 2010, ids: { trakt: 1, slug: "inception-2010" } },
    },
    {
      id: 3,
      watched_at: "2024-01-15T21:30:00.000Z",
      action: "watch",
      type: "movie",
      movie: { title: "The Dark Knight", year: 2008, ids: { trakt: 4, slug: "the-dark-knight-2008" } },
    },
  ];

  // Pre-populate the merged map as if syncWatched had run.
  const map = new Map<string, NormalizedItem>();
  const inception = makeMovie();
  inception.ids.trakt = 1;
  inception.title = "Inception";
  map.set("movie:1", inception);
  const tdk = makeMovie();
  // makeMovie() already uses trakt=4 + Dark Knight title
  map.set("movie:4", tdk);

  aggregateMovieHistory(history, map);

  assertEq(
    inception.watch_history_movie,
    ["2024-06-10T22:30:00.000Z", "2025-02-14T20:15:00.000Z"],
    "Inception has 2 timestamps, sorted ascending",
  );
  assertEq(
    tdk.watch_history_movie,
    ["2024-01-15T21:30:00.000Z"],
    "The Dark Knight has 1 timestamp",
  );
}

// ── Test 12: Watch history aggregation (shows) ────────────────────────────
console.log(
  "\n[12] aggregateShowHistory groups by (show, S, E) + sorts predictably",
);
{
  // Fixture: same show, S1E1 watched twice, S1E2 once, S2E1 once.
  const history: TraktHistoryItem[] = [
    {
      id: 10,
      watched_at: "2024-04-02T20:00:00.000Z",
      action: "watch",
      type: "episode",
      show: { title: "Show", year: 2020, ids: { trakt: 99, slug: "show-2020" } },
      episode: { season: 2, number: 1, title: "S2E1 title", ids: { trakt: 9911 } },
    },
    {
      id: 11,
      watched_at: "2024-01-15T21:30:00.000Z",
      action: "watch",
      type: "episode",
      show: { title: "Show", year: 2020, ids: { trakt: 99, slug: "show-2020" } },
      episode: { season: 1, number: 1, title: "Pilot", ids: { trakt: 9901 } },
    },
    {
      id: 12,
      watched_at: "2024-03-22T19:00:00.000Z",
      action: "watch",
      type: "episode",
      show: { title: "Show", year: 2020, ids: { trakt: 99, slug: "show-2020" } },
      episode: { season: 1, number: 1, title: "Pilot", ids: { trakt: 9901 } },
    },
    {
      id: 13,
      watched_at: "2024-01-16T22:00:00.000Z",
      action: "watch",
      type: "episode",
      show: { title: "Show", year: 2020, ids: { trakt: 99, slug: "show-2020" } },
      episode: { season: 1, number: 2, title: "Ep2", ids: { trakt: 9902 } },
    },
  ];

  const map = new Map<string, NormalizedItem>();
  const show = makeMovie(); // start from movie helper, then morph
  show.type = "show";
  show.title = "Show";
  show.ids = { trakt: 99, slug: "show-2020" };
  map.set("show:99", show);

  aggregateShowHistory(history, map);

  const eps = show.watch_history_episodes;
  assertTrue(!!eps, "watch_history_episodes populated");
  if (eps) {
    assertEq(eps.length, 3, "3 unique (S, E) entries");
    // Order: S1E1, S1E2, S2E1
    assertEq(`S${eps[0].season}E${eps[0].episode}`, "S1E1", "first entry is S1E1");
    assertEq(`S${eps[1].season}E${eps[1].episode}`, "S1E2", "second entry is S1E2");
    assertEq(`S${eps[2].season}E${eps[2].episode}`, "S2E1", "third entry is S2E1");
    assertEq(
      eps[0].watched_at,
      ["2024-01-15T21:30:00.000Z", "2024-03-22T19:00:00.000Z"],
      "S1E1 has both timestamps, sorted ascending",
    );
    assertEq(
      eps[1].watched_at,
      ["2024-01-16T22:00:00.000Z"],
      "S1E2 has 1 timestamp",
    );
  }
}

// ── Test 13: aggregation skips items not already in the merged map ────────
console.log("\n[13] Aggregators ignore history rows for unknown items");
{
  const history: TraktHistoryItem[] = [
    {
      id: 1,
      watched_at: "2024-01-15T21:30:00.000Z",
      action: "watch",
      type: "movie",
      movie: { title: "Stranger Movie", year: 2020, ids: { trakt: 999, slug: "stranger" } },
    },
  ];
  const map = new Map<string, NormalizedItem>();
  // Map is empty — aggregator should not throw and should not insert anything.
  aggregateMovieHistory(history, map);
  assertEq(map.size, 0, "map stays empty when no matching item exists");
}

// ── Test 14: renderWatchHistoryList — movie & show formats ────────────────
console.log(
  "\n[14] renderWatchHistoryList formats movie timestamps and S/E lines",
);
{
  // Movie path
  const movie = makeMovie();
  movie.watch_history_movie = [
    "2024-06-10T22:30:00.000Z",
    "2025-02-14T20:15:00.000Z",
  ];
  const movieList = renderWatchHistoryList(movie);
  assertTrue(
    movieList.split("\n").length === 2,
    "movie list has 2 lines (one per watch)",
  );
  assertTrue(
    /^- \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(movieList.split("\n")[0]),
    "first line matches '- YYYY-MM-DD HH:MM' format",
  );

  // Show path
  const show = makeMovie();
  show.type = "show";
  show.watch_history_episodes = [
    {
      season: 1,
      episode: 1,
      title: "Pilot",
      watched_at: ["2024-01-15T21:30:00.000Z", "2024-03-22T19:00:00.000Z"],
    },
    {
      season: 1,
      episode: 2,
      watched_at: ["2024-01-16T22:00:00.000Z"],
    },
  ];
  const showList = renderWatchHistoryList(show);
  const lines = showList.split("\n");
  assertEq(lines.length, 2, "show list has 2 lines (one per episode)");
  assertTrue(lines[0].startsWith("- S1E1 — "), "first line starts with '- S1E1 — '");
  assertTrue(
    lines[0].split(", ").length === 2,
    "S1E1 has two comma-separated timestamps",
  );
  assertTrue(lines[1].startsWith("- S1E2 — "), "second line starts with '- S1E2 — '");

  // Empty — when no history populated
  const empty = makeMovie();
  assertEq(renderWatchHistoryList(empty), "", "no detail → empty string");
}

// ── Test 15: renderWatchHistorySection chooses heading by template lang ───
console.log(
  "\n[15] renderWatchHistorySection picks heading from templateLanguage",
);
{
  const show = makeMovie();
  show.type = "show";
  show.watch_history_episodes = [
    { season: 1, episode: 1, watched_at: ["2024-01-15T21:30:00.000Z"] },
  ];

  const sectionEn = renderWatchHistorySection(show, withSettings({ templateLanguage: "" }));
  assertTrue(
    sectionEn.startsWith("## Watch History\n"),
    "default templateLanguage → 'Watch History'",
  );

  const sectionZh = renderWatchHistorySection(
    show,
    withSettings({ templateLanguage: "zh-CN" }),
  );
  assertTrue(
    sectionZh.startsWith("## 观看记录\n"),
    "zh-CN templateLanguage → '观看记录'",
  );

  const sectionTw = renderWatchHistorySection(
    show,
    withSettings({ templateLanguage: "zh-TW" }),
  );
  assertTrue(
    sectionTw.startsWith("## 觀看紀錄\n"),
    "zh-TW templateLanguage → '觀看紀錄'",
  );

  // Empty data → empty section (no orphan heading)
  const empty = makeMovie();
  empty.type = "show";
  assertEq(
    renderWatchHistorySection(empty, withSettings({ templateLanguage: "zh-CN" })),
    "",
    "no detail → empty section (no orphan heading)",
  );
}

// ── Test 16: default templates include {{watch_history}} variable ─────────
console.log("\n[16] All bundled default templates include {{watch_history}}");
{
  for (const [name, tpl] of [
    ["EN movie", DEFAULT_MOVIE_TEMPLATE_EN],
    ["EN show", DEFAULT_SHOW_TEMPLATE_EN],
    ["zh-CN movie", DEFAULT_MOVIE_TEMPLATE_ZH_CN],
    ["zh-CN show", DEFAULT_SHOW_TEMPLATE_ZH_CN],
    ["zh-TW movie", DEFAULT_MOVIE_TEMPLATE_ZH_TW],
    ["zh-TW show", DEFAULT_SHOW_TEMPLATE_ZH_TW],
  ] as const) {
    assertTrue(
      tpl.includes("{{watch_history}}"),
      `${name} template contains {{watch_history}}`,
    );
  }
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(60)}`);
console.log(`Smoke results: ${passes} passed, ${failures} failed`);
console.log("=".repeat(60));
if (failures > 0) {
  process.exit(1);
}
