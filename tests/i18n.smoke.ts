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
  updateManagedBodySections,
  frontmatterWouldChange,
  valuesEqual,
  WATCH_HISTORY_MARKER_START,
  WATCH_HISTORY_MARKER_END,
} from "../src/note-renderer";
import {
  pickTraktTranslation,
  type TraktTranslation,
} from "../src/trakt-api";
import {
  pickBestTranslation,
  cacheEntryFreshness,
  computeCacheExpiry,
  tmdbCacheKey,
  clearTmdbCache,
  tmdbCacheStats,
  fetchMovieMetadata,
  verifyTmdbApiKey,
} from "../src/tmdb-api";
import {
  mergeHistoryEvents,
  replaceFromFullRefresh,
  shouldRunFullRefresh,
  applyHistoryStateToItems,
  clearHistoryState,
  historyStateStats,
  stateFromEvents,
  getIncrementalStartAt,
} from "../src/history-state";
import { processWithConcurrency } from "../src/utils";
import { buildFilename, disambiguatedFilename } from "../src/sync-engine";
import {
  EMPTY_HISTORY_STATE,
  type HistoryState,
  type TmdbCache,
  type TmdbCacheEntry,
  type TraktHistoryItem,
} from "../src/types";
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
    tZh("notice.syncComplete", { added: 5, updated: 3, unchanged: 12, removed: 1 }),
    "同步完成：新增 5，更新 3，未变 12，移除 1",
    "interpolated zh-CN notice with vars",
  );
  const tEn = getTranslator("en");
  assertEq(
    tEn("notice.syncComplete", { added: 5, updated: 3, unchanged: 12, removed: 1 }),
    "Sync complete: 5 added, 3 updated, 12 unchanged, 1 removed",
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

// ── Test 11: mergeHistoryEvents — additive merge (movie + show) ───────────
console.log(
  "\n[11] mergeHistoryEvents groups movies + episodes into HistoryState",
);
{
  // Movies: Inception watched twice (out of chronological order in input,
  // to verify the function sorts on output). The Dark Knight once.
  // Episodes: same show, S1E1 watched twice, S1E2 once, S2E1 once.
  const history: TraktHistoryItem[] = [
    { id: 1, watched_at: "2025-02-14T20:15:00.000Z", action: "watch", type: "movie",
      movie: { title: "Inception", year: 2010, ids: { trakt: 1, slug: "inception-2010" } } },
    { id: 2, watched_at: "2024-06-10T22:30:00.000Z", action: "watch", type: "movie",
      movie: { title: "Inception", year: 2010, ids: { trakt: 1, slug: "inception-2010" } } },
    { id: 3, watched_at: "2024-01-15T21:30:00.000Z", action: "watch", type: "movie",
      movie: { title: "The Dark Knight", year: 2008, ids: { trakt: 4, slug: "tdk" } } },
    { id: 10, watched_at: "2024-04-02T20:00:00.000Z", action: "watch", type: "episode",
      show: { title: "Show", year: 2020, ids: { trakt: 99, slug: "show-2020" } },
      episode: { season: 2, number: 1, title: "S2E1 title", ids: { trakt: 9911 } } },
    { id: 11, watched_at: "2024-01-15T21:30:00.000Z", action: "watch", type: "episode",
      show: { title: "Show", year: 2020, ids: { trakt: 99, slug: "show-2020" } },
      episode: { season: 1, number: 1, title: "Pilot", ids: { trakt: 9901 } } },
    { id: 12, watched_at: "2024-03-22T19:00:00.000Z", action: "watch", type: "episode",
      show: { title: "Show", year: 2020, ids: { trakt: 99, slug: "show-2020" } },
      episode: { season: 1, number: 1, title: "Pilot", ids: { trakt: 9901 } } },
    { id: 13, watched_at: "2024-01-16T22:00:00.000Z", action: "watch", type: "episode",
      show: { title: "Show", year: 2020, ids: { trakt: 99, slug: "show-2020" } },
      episode: { season: 1, number: 2, title: "Ep2", ids: { trakt: 9902 } } },
  ];

  const state: HistoryState = { ...EMPTY_HISTORY_STATE, byMovie: {}, byShow: {}, knownEventIds: [] };
  const newlyAdded = mergeHistoryEvents(state, history);

  assertEq(newlyAdded, 7, "all 7 events ingested as new");
  assertEq(state.byMovie[1], ["2024-06-10T22:30:00.000Z", "2025-02-14T20:15:00.000Z"], "Inception 2 watches sorted");
  assertEq(state.byMovie[4], ["2024-01-15T21:30:00.000Z"], "The Dark Knight 1 watch");
  const eps = state.byShow[99];
  assertTrue(!!eps, "show 99 episode list created");
  assertEq(eps.length, 3, "3 unique (S, E) entries");
  assertEq(`S${eps[0].season}E${eps[0].episode}`, "S1E1", "sort order: S1E1 first");
  assertEq(`S${eps[1].season}E${eps[1].episode}`, "S1E2", "S1E2 second");
  assertEq(`S${eps[2].season}E${eps[2].episode}`, "S2E1", "S2E1 third");
  assertEq(eps[0].watched_at,
    ["2024-01-15T21:30:00.000Z", "2024-03-22T19:00:00.000Z"],
    "S1E1 dual timestamps sorted");
  assertEq(state.knownEventIds.sort(), [1, 2, 3, 10, 11, 12, 13].sort(),
    "all 7 event ids tracked");
  assertEq(state.lastIncrementalSyncAt, "2025-02-14T20:15:00.000Z",
    "lastIncrementalSyncAt updated to latest watched_at");
}

// ── Test 12: mergeHistoryEvents — idempotent on replay ────────────────────
console.log("\n[12] Replaying same events doesn't double-count");
{
  const events: TraktHistoryItem[] = [
    { id: 1, watched_at: "2024-01-15T21:30:00.000Z", action: "watch", type: "movie",
      movie: { title: "M", year: 2020, ids: { trakt: 7, slug: "m" } } },
  ];
  const state: HistoryState = { ...EMPTY_HISTORY_STATE, byMovie: {}, byShow: {}, knownEventIds: [] };
  mergeHistoryEvents(state, events);
  const before = state.byMovie[7].length;
  mergeHistoryEvents(state, events);
  const after = state.byMovie[7].length;
  assertEq(after, before, "second merge of same events is a no-op");
  assertEq(state.knownEventIds.length, 1, "knownEventIds doesn't duplicate");
}

// ── Test 13: mergeHistoryEvents — extending an existing show ──────────────
console.log("\n[13] Watching new episodes appends, doesn't replace");
{
  const state: HistoryState = { ...EMPTY_HISTORY_STATE, byMovie: {}, byShow: {}, knownEventIds: [] };
  // Day 1: watched S1E1 and S1E2.
  mergeHistoryEvents(state, [
    { id: 1, watched_at: "2024-01-15T21:00:00.000Z", action: "watch", type: "episode",
      show: { title: "S", year: 2020, ids: { trakt: 50, slug: "s" } },
      episode: { season: 1, number: 1, title: "P", ids: { trakt: 1 } } },
    { id: 2, watched_at: "2024-01-15T22:00:00.000Z", action: "watch", type: "episode",
      show: { title: "S", year: 2020, ids: { trakt: 50, slug: "s" } },
      episode: { season: 1, number: 2, title: "Ep2", ids: { trakt: 2 } } },
  ]);
  // Day 2: incremental fetch returns S1E3 and a re-watch of S1E1.
  mergeHistoryEvents(state, [
    { id: 3, watched_at: "2024-01-16T21:00:00.000Z", action: "watch", type: "episode",
      show: { title: "S", year: 2020, ids: { trakt: 50, slug: "s" } },
      episode: { season: 1, number: 3, title: "Ep3", ids: { trakt: 3 } } },
    { id: 4, watched_at: "2024-01-17T21:00:00.000Z", action: "watch", type: "episode",
      show: { title: "S", year: 2020, ids: { trakt: 50, slug: "s" } },
      episode: { season: 1, number: 1, title: "P", ids: { trakt: 1 } } },
  ]);
  const eps = state.byShow[50];
  assertEq(eps.length, 3, "3 unique (S, E) after extension");
  const s1e1 = eps.find((e) => e.season === 1 && e.episode === 1)!;
  assertEq(s1e1.watched_at.length, 2, "S1E1 has both watches now");
  const s1e3 = eps.find((e) => e.season === 1 && e.episode === 3)!;
  assertEq(s1e3.watched_at.length, 1, "S1E3 newly added with 1 watch");
}

// ── Test 13b: replaceFromFullRefresh detects deletions ────────────────────
console.log(
  "\n[13b] replaceFromFullRefresh rebuilds state + tracks deleted ids",
);
{
  // State has events 1, 2, 3. Full refresh returns only 1 and 3 (event 2
  // was deleted on Trakt). Result: state holds 1 and 3, deletedCount = 1.
  const state: HistoryState = { ...EMPTY_HISTORY_STATE, byMovie: {}, byShow: {}, knownEventIds: [] };
  mergeHistoryEvents(state, [
    { id: 1, watched_at: "2024-01-15T21:00:00.000Z", action: "watch", type: "movie",
      movie: { title: "M1", year: 2020, ids: { trakt: 1, slug: "m1" } } },
    { id: 2, watched_at: "2024-01-16T21:00:00.000Z", action: "watch", type: "movie",
      movie: { title: "M2", year: 2020, ids: { trakt: 2, slug: "m2" } } },
    { id: 3, watched_at: "2024-01-17T21:00:00.000Z", action: "watch", type: "movie",
      movie: { title: "M3", year: 2020, ids: { trakt: 3, slug: "m3" } } },
  ]);

  const fullPull: TraktHistoryItem[] = [
    { id: 1, watched_at: "2024-01-15T21:00:00.000Z", action: "watch", type: "movie",
      movie: { title: "M1", year: 2020, ids: { trakt: 1, slug: "m1" } } },
    // event 2 deleted on Trakt — absent from full pull
    { id: 3, watched_at: "2024-01-17T21:00:00.000Z", action: "watch", type: "movie",
      movie: { title: "M3", year: 2020, ids: { trakt: 3, slug: "m3" } } },
  ];

  const { deletedCount } = replaceFromFullRefresh(state, fullPull);
  assertEq(deletedCount, 1, "exactly 1 deletion detected");
  assertEq(state.knownEventIds.sort(), [1, 3], "knownEventIds rebuilt to {1,3}");
  assertEq(state.byMovie[2], undefined, "deleted movie's entry removed");
  assertTrue(state.byMovie[1].length === 1, "M1 still has 1 watch");
  assertTrue(state.byMovie[3].length === 1, "M3 still has 1 watch");
  assertTrue(state.lastFullRefreshAt.length > 0, "lastFullRefreshAt set");
}

// ── Test 13c: shouldRunFullRefresh interval logic ─────────────────────────
console.log("\n[13c] shouldRunFullRefresh respects interval + first-run case");
{
  // First run (lastFullRefreshAt = "") → always true
  const fresh: HistoryState = { ...EMPTY_HISTORY_STATE };
  assertTrue(shouldRunFullRefresh(fresh, 7), "empty state: always full refresh");

  // Recently refreshed → false
  const recent: HistoryState = {
    ...EMPTY_HISTORY_STATE,
    lastFullRefreshAt: new Date(Date.now() - 86400_000).toISOString(),
  };
  assertEq(shouldRunFullRefresh(recent, 7), false, "1 day ago, interval 7 → no");

  // Older than interval → true
  const stale: HistoryState = {
    ...EMPTY_HISTORY_STATE,
    lastFullRefreshAt: new Date(Date.now() - 8 * 86400_000).toISOString(),
  };
  assertEq(shouldRunFullRefresh(stale, 7), true, "8 days ago, interval 7 → yes");

  // Malformed timestamp → treated as needing refresh
  const bad: HistoryState = { ...EMPTY_HISTORY_STATE, lastFullRefreshAt: "not-a-date" };
  assertEq(shouldRunFullRefresh(bad, 7), true, "bad timestamp → refresh");
}

// ── Test 13d: applyHistoryStateToItems writes onto NormalizedItems ────────
console.log("\n[13d] applyHistoryStateToItems hydrates watch_history_* fields");
{
  const state: HistoryState = stateFromEvents([
    { id: 1, watched_at: "2024-01-15T21:00:00.000Z", action: "watch", type: "movie",
      movie: { title: "M", year: 2020, ids: { trakt: 4, slug: "m" } } },
    { id: 2, watched_at: "2024-01-15T21:00:00.000Z", action: "watch", type: "episode",
      show: { title: "S", year: 2020, ids: { trakt: 50, slug: "s" } },
      episode: { season: 1, number: 1, ids: { trakt: 901 } } },
  ]);

  const movie = makeMovie();
  // makeMovie() sets ids.trakt = 4 → matches our event
  const show = makeMovie();
  show.type = "show";
  show.ids = { trakt: 50, slug: "s" };

  applyHistoryStateToItems(state, [movie, show]);

  assertTrue(
    Array.isArray(movie.watch_history_movie) && movie.watch_history_movie.length === 1,
    "movie.watch_history_movie populated",
  );
  assertTrue(
    Array.isArray(show.watch_history_episodes) && show.watch_history_episodes.length === 1,
    "show.watch_history_episodes populated",
  );
  // Defensive copy — mutating the item's array shouldn't poison state.
  movie.watch_history_movie!.push("BAD");
  assertEq(state.byMovie[4].length, 1, "state byMovie not affected by item mutation");
}

// ── Test 13e: clearHistoryState resets all fields ─────────────────────────
console.log("\n[13e] clearHistoryState wipes everything in place");
{
  const state: HistoryState = stateFromEvents([
    { id: 1, watched_at: "2024-01-15T21:00:00.000Z", action: "watch", type: "movie",
      movie: { title: "M", year: 2020, ids: { trakt: 1, slug: "m" } } },
  ]);
  state.lastFullRefreshAt = "2024-01-15T22:00:00.000Z";
  clearHistoryState(state);
  assertEq(Object.keys(state.byMovie).length, 0, "byMovie cleared");
  assertEq(Object.keys(state.byShow).length, 0, "byShow cleared");
  assertEq(state.knownEventIds.length, 0, "knownEventIds cleared");
  assertEq(state.lastIncrementalSyncAt, "", "lastIncrementalSyncAt cleared");
  assertEq(state.lastFullRefreshAt, "", "lastFullRefreshAt cleared");
}

// ── Test 13f: getIncrementalStartAt + historyStateStats ───────────────────
console.log("\n[13f] getIncrementalStartAt + historyStateStats");
{
  const empty: HistoryState = { ...EMPTY_HISTORY_STATE };
  assertEq(getIncrementalStartAt(empty), "",
    "empty state → no start_at filter, full pull");
  empty.lastIncrementalSyncAt = "2024-05-01T10:00:00.000Z";
  assertEq(getIncrementalStartAt(empty), "2024-05-01T10:00:00.000Z",
    "after merge → returns stored timestamp");

  const populated: HistoryState = stateFromEvents([
    { id: 1, watched_at: "2024-01-15T21:00:00.000Z", action: "watch", type: "movie",
      movie: { title: "M1", year: 2020, ids: { trakt: 1, slug: "m1" } } },
    { id: 2, watched_at: "2024-01-15T22:00:00.000Z", action: "watch", type: "movie",
      movie: { title: "M2", year: 2020, ids: { trakt: 2, slug: "m2" } } },
    { id: 3, watched_at: "2024-01-15T23:00:00.000Z", action: "watch", type: "episode",
      show: { title: "S", year: 2020, ids: { trakt: 99, slug: "s" } },
      episode: { season: 1, number: 1, ids: { trakt: 901 } } },
  ]);
  const stats = historyStateStats(populated);
  assertEq(stats.movies, 2, "2 movies tracked");
  assertEq(stats.shows, 1, "1 show tracked");
  assertEq(stats.events, 3, "3 events tracked");
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

// ── Test 15: renderWatchHistorySection wraps content in markers ───────────
console.log(
  "\n[15] renderWatchHistorySection wraps section with markers + lang heading",
);
{
  const show = makeMovie();
  show.type = "show";
  show.watch_history_episodes = [
    { season: 1, episode: 1, watched_at: ["2024-01-15T21:30:00.000Z"] },
  ];

  const sectionEn = renderWatchHistorySection(show, withSettings({ templateLanguage: "" }));
  assertTrue(
    sectionEn.startsWith(WATCH_HISTORY_MARKER_START + "\n"),
    "section starts with start marker",
  );
  assertTrue(
    sectionEn.endsWith("\n" + WATCH_HISTORY_MARKER_END),
    "section ends with end marker",
  );
  assertTrue(
    sectionEn.includes("## Watch History\n"),
    "EN heading inside markers",
  );

  const sectionZh = renderWatchHistorySection(
    show,
    withSettings({ templateLanguage: "zh-CN" }),
  );
  assertTrue(
    sectionZh.includes("## 观看记录\n"),
    "zh-CN heading inside markers",
  );

  const sectionTw = renderWatchHistorySection(
    show,
    withSettings({ templateLanguage: "zh-TW" }),
  );
  assertTrue(
    sectionTw.includes("## 觀看紀錄\n"),
    "zh-TW heading inside markers",
  );

  // Empty data → empty section (no orphan heading, no orphan markers)
  const empty = makeMovie();
  empty.type = "show";
  assertEq(
    renderWatchHistorySection(empty, withSettings({ templateLanguage: "zh-CN" })),
    "",
    "no detail → empty section (no orphan heading, no orphan markers)",
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

// ── Test 17: updateManagedBodySections — the in-place body update ─────────
console.log("\n[17] updateManagedBodySections covers replace / append / off");
{
  function showWithEpisodes(episodes: Array<{ season: number; episode: number; watched_at: string[]; }>): NormalizedItem {
    const show = makeMovie();
    show.type = "show";
    show.watch_history_episodes = episodes;
    return show;
  }

  // Case 1: existing markers → replace between them, keep surrounding body
  {
    const oldBody = `Some user-written prose above the section.

%% trakt:watch-history:start %%
## Watch History
- S1E1 — 2024-01-15 21:30
%% trakt:watch-history:end %%

User notes below — should not be touched.`;
    const item = showWithEpisodes([
      { season: 1, episode: 1, watched_at: ["2024-01-15T21:30:00.000Z"] },
      { season: 1, episode: 2, watched_at: ["2024-01-16T22:00:00.000Z"] },
    ]);
    const updated = updateManagedBodySections(
      oldBody,
      item,
      withSettings({ syncWatchedDetail: true }),
    );
    assertTrue(
      updated.includes("Some user-written prose above the section."),
      "preserves prose ABOVE the markers",
    );
    assertTrue(
      updated.includes("User notes below — should not be touched."),
      "preserves prose BELOW the markers",
    );
    assertTrue(
      updated.includes("- S1E2"),
      "section now contains the new S1E2 line",
    );
    // Original body had 1 episode line; new body should have 2 within markers
    const between = updated
      .split(WATCH_HISTORY_MARKER_START)[1]
      ?.split(WATCH_HISTORY_MARKER_END)[0] ?? "";
    assertTrue(
      between.includes("- S1E1") && between.includes("- S1E2"),
      "both episodes are inside the markers",
    );
    assertTrue(
      !updated.includes("S1E1 — 2024-01-15 21:30\n%% trakt:watch-history:end %%") ||
      updated.match(/%% trakt:watch-history:start %%/g)?.length === 1,
      "exactly one set of markers (no duplication)",
    );
  }

  // Case 2: no markers in body → append at end with blank-line separator
  {
    const oldBody = `User wrote a note here.

No watch history section yet.`;
    const item = showWithEpisodes([
      { season: 2, episode: 5, watched_at: ["2024-04-02T20:00:00.000Z"] },
    ]);
    const updated = updateManagedBodySections(
      oldBody,
      item,
      withSettings({ syncWatchedDetail: true }),
    );
    assertTrue(
      updated.startsWith("User wrote a note here."),
      "original body preserved at the start",
    );
    assertTrue(
      updated.includes(WATCH_HISTORY_MARKER_START),
      "start marker appended",
    );
    assertTrue(
      updated.includes(WATCH_HISTORY_MARKER_END),
      "end marker appended",
    );
    assertTrue(
      updated.includes("- S2E5"),
      "S2E5 line present in appended section",
    );
  }

  // Case 3: syncWatchedDetail = false → leave content alone, even if data exists
  {
    const oldBody = "User content. Should be unchanged.";
    const item = showWithEpisodes([
      { season: 1, episode: 1, watched_at: ["2024-01-15T21:30:00.000Z"] },
    ]);
    const updated = updateManagedBodySections(
      oldBody,
      item,
      withSettings({ syncWatchedDetail: false }),
    );
    assertEq(
      updated,
      oldBody,
      "content unchanged when syncWatchedDetail is off",
    );
  }

  // Case 4: markers exist but item has no history → markers cleared to empty
  // (we'd rather show an empty list than yesterday's stale list)
  {
    const oldBody = `Some prose.

%% trakt:watch-history:start %%
## Watch History
- S1E1 — 2024-01-15 21:30
%% trakt:watch-history:end %%

After.`;
    const item = showWithEpisodes([]);
    const updated = updateManagedBodySections(
      oldBody,
      item,
      withSettings({ syncWatchedDetail: true }),
    );
    assertTrue(
      updated.includes("Some prose."),
      "above-marker prose preserved",
    );
    assertTrue(
      updated.includes("After."),
      "below-marker prose preserved",
    );
    assertTrue(
      updated.includes(`${WATCH_HISTORY_MARKER_START}\n${WATCH_HISTORY_MARKER_END}`),
      "markers collapsed to empty pair",
    );
    assertTrue(
      !updated.includes("- S1E1"),
      "stale episode line cleared",
    );
  }

  // Case 5: no markers AND no data → no-op (don't append empty markers)
  {
    const oldBody = "Just some note content with no history.";
    const item = showWithEpisodes([]);
    const updated = updateManagedBodySections(
      oldBody,
      item,
      withSettings({ syncWatchedDetail: true }),
    );
    assertEq(
      updated,
      oldBody,
      "no-op when no data and no existing markers",
    );
  }

  // Case 6: movie path — flat list rather than S/E
  {
    const movie = makeMovie();
    movie.watch_history_movie = [
      "2024-06-10T22:30:00.000Z",
      "2025-02-14T20:15:00.000Z",
    ];
    const oldBody = "Note body.\n";
    const updated = updateManagedBodySections(
      oldBody,
      movie,
      withSettings({ syncWatchedDetail: true }),
    );
    const between = updated
      .split(WATCH_HISTORY_MARKER_START)[1]
      ?.split(WATCH_HISTORY_MARKER_END)[0] ?? "";
    assertTrue(
      between.split("\n").filter((l) => l.startsWith("- ")).length === 2,
      "movie section has 2 timestamp lines",
    );
    assertTrue(
      !between.includes("S1E"),
      "movie section uses flat timestamps, no S/E prefix",
    );
  }
}

// ── Test 18: pickBestTranslation — TMDB title fallback chain ──────────────
console.log(
  "\n[18] pickBestTranslation — handles TMDB locked-blank-title quirk",
);
{
  // Reproduces the user-reported bug: TMDB returns the English original at
  // the top level for movies where zh-CN translation is locked blank, but
  // zh-TW / zh-HK still have valid Chinese titles. We need to walk the
  // translations array client-side to find them.
  const homeAlone2 = {
    poster_path: "/some.jpg",
    original_title: "Home Alone 2: Lost in New York",
    title: "Home Alone 2: Lost in New York", // locked blank → fallback
    overview: "",
    tagline: "",
    genres: [{ name: "Comedy" }, { name: "Family" }],
    translations: {
      translations: [
        {
          iso_639_1: "zh",
          iso_3166_1: "CN",
          data: { title: "", overview: "", tagline: "" }, // locked blank
        },
        {
          iso_639_1: "zh",
          iso_3166_1: "TW",
          data: {
            title: "小鬼當家2：紐約迷途記",
            overview: "...",
            tagline: "",
          },
        },
        {
          iso_639_1: "zh",
          iso_3166_1: "HK",
          data: { title: "寶貝智多星續集 玩轉紐約", overview: "", tagline: "" },
        },
      ],
    },
  };
  const t1 = pickBestTranslation(homeAlone2, "zh-CN", "movie");
  assertTrue(!!t1, "zh-CN: returns a translation despite blank CN row");
  assertEq(
    t1?.title,
    "小鬼當家2：紐約迷途記",
    "zh-CN falls back to TW when CN is blank",
  );

  const t2 = pickBestTranslation(homeAlone2, "zh-TW", "movie");
  assertEq(t2?.title, "小鬼當家2：紐約迷途記", "zh-TW gets TW directly");

  const t3 = pickBestTranslation(homeAlone2, "zh-HK", "movie");
  assertEq(t3?.title, "寶貝智多星續集 玩轉紐約", "zh-HK gets HK directly");
}

// ── Test 19: pickBestTranslation — main response is real translation ──────
console.log(
  "\n[19] pickBestTranslation — trusts main response when it's truly localized",
);
{
  // When TMDB DOES return a real Chinese title at the top level (title
  // differs from original_title), we should trust it and not override with
  // the translations array. Also fills in overview/tagline from translations
  // if main response has them blank.
  const someMovie = {
    poster_path: "/a.jpg",
    original_title: "The Dark Knight",
    title: "黑暗骑士",
    overview: "一段中文 overview。",
    tagline: "",
    genres: [{ name: "动作" }],
    translations: {
      translations: [
        {
          iso_639_1: "zh",
          iso_3166_1: "CN",
          data: {
            title: "黑暗骑士",
            overview: "一段中文 overview。",
            tagline: "为什么这么严肃？",
          },
        },
      ],
    },
  };
  const t = pickBestTranslation(someMovie, "zh-CN", "movie");
  assertEq(t?.title, "黑暗骑士", "uses main title directly");
  assertEq(
    t?.overview,
    "一段中文 overview。",
    "uses main overview directly",
  );
  assertEq(
    t?.tagline,
    "为什么这么严肃？",
    "fills tagline from translations when main is empty",
  );
  assertEq(t?.genres, ["动作"], "genres come from main response");
}

// ── Test 20: pickBestTranslation — no Chinese translation at all ──────────
console.log(
  "\n[20] pickBestTranslation — returns null when no usable translation",
);
{
  const englishOnly = {
    poster_path: "/a.jpg",
    original_title: "Some English Movie",
    title: "Some English Movie", // fallback
    overview: "",
    tagline: "",
    genres: [],
    translations: {
      translations: [
        {
          iso_639_1: "en",
          iso_3166_1: "US",
          data: { title: "Some English Movie" },
        },
        // no zh entries
      ],
    },
  };
  const t = pickBestTranslation(englishOnly, "zh-CN", "movie");
  assertEq(t, null, "no zh entries → null");
}

// ── Test 21: pickBestTranslation — TV uses `name` instead of `title` ──────
console.log("\n[21] pickBestTranslation — TV path reads `name` field");
{
  const someTv = {
    poster_path: "/a.jpg",
    original_name: "Breaking Bad",
    name: "Breaking Bad", // top-level fallback to original
    overview: "",
    tagline: "",
    genres: [{ name: "Drama" }],
    translations: {
      translations: [
        {
          iso_639_1: "zh",
          iso_3166_1: "CN",
          data: { name: "绝命毒师", overview: "...", tagline: "" },
        },
      ],
    },
  };
  const t = pickBestTranslation(someTv, "zh-CN", "tv");
  assertEq(t?.title, "绝命毒师", "TV uses name field");
}

// ── Test 23: TMDB cache key + freshness + expiry math ────────────────────
console.log("\n[23] TMDB cache helpers (key composition, freshness, expiry)");
{
  // Key disambiguates type, id, language so a movie and a show with the
  // same TMDB id never collide.
  assertEq(tmdbCacheKey("movie", 155, "zh-CN"), "movie:155:zh-CN",
    "key includes type, id, language");
  assertEq(tmdbCacheKey("movie", 155, ""), "movie:155:default",
    "empty language → 'default' segment");
  assertEq(tmdbCacheKey("tv", 155, "zh-CN"), "tv:155:zh-CN",
    "movie 155 vs tv 155 different keys");

  // Freshness states.
  const now = 1_000_000_000_000;
  assertEq(cacheEntryFreshness(undefined, now), "missing", "undefined → missing");
  assertEq(cacheEntryFreshness({ poster_url: "", translation: null, cached_at: now - 1000, expires_at: now + 1000 }, now), "fresh",
    "expires_at in future → fresh");
  assertEq(cacheEntryFreshness({ poster_url: "", translation: null, cached_at: now - 10000, expires_at: now - 1 }, now), "stale",
    "expires_at in past → stale");

  // TTL = 0 means never expire (we use MAX_SAFE_INTEGER as sentinel).
  const neverExp = computeCacheExpiry(0, now);
  assertTrue(neverExp >= Number.MAX_SAFE_INTEGER - 1, "TTL 0 → never expires");

  // Positive TTL gets jitter — each call's expiry must be at LEAST 1 day,
  // and the spread across many calls must be wider than 1 day.
  const expiries: number[] = [];
  for (let i = 0; i < 100; i++) {
    expiries.push(computeCacheExpiry(90, now));
  }
  const minExp = Math.min(...expiries);
  const maxExp = Math.max(...expiries);
  assertTrue(minExp >= now + 86_400_000, "all expiries are at least 1 day out");
  assertTrue(maxExp - minExp >= 7 * 86_400_000,
    `100 entries spread expirations across ≥7 days (got ${(maxExp - minExp) / 86_400_000} days)`);
}

// ── Test 24: clearTmdbCache + tmdbCacheStats ──────────────────────────────
console.log("\n[24] clearTmdbCache empties; stats counts entries");
{
  const cache: TmdbCache = {};
  cache["movie:1:default"] = { poster_url: "u1", translation: null, cached_at: 0, expires_at: Number.MAX_SAFE_INTEGER };
  cache["movie:2:zh-CN"] = { poster_url: "u2", translation: null, cached_at: 0, expires_at: Number.MAX_SAFE_INTEGER };
  cache["tv:99:ja-JP"] = { poster_url: "u3", translation: null, cached_at: 0, expires_at: Number.MAX_SAFE_INTEGER };
  assertEq(tmdbCacheStats(cache).entries, 3, "3 entries before clear");
  clearTmdbCache(cache);
  assertEq(tmdbCacheStats(cache).entries, 0, "0 entries after clear");
  assertEq(Object.keys(cache).length, 0, "object keys also empty");
}


// CJS bundle disallows top-level await, so the async work + summary go in
// one IIFE at the end of the file.
void (async () => {
  console.log("\n[22] processWithConcurrency — limits concurrency and reports progress");
  {
    let inFlight = 0;
    let maxObserved = 0;
    const completed: number[] = [];
    const progressUpdates: Array<{ done: number; total: number }> = [];

    const work = async (n: number) => {
      inFlight++;
      if (inFlight > maxObserved) maxObserved = inFlight;
      await new Promise<void>((r) => setTimeout(r, 5 + (n % 3) * 3));
      inFlight--;
      completed.push(n);
    };

    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    await processWithConcurrency(items, 3, work, (done, total) =>
      progressUpdates.push({ done, total }),
    );

    assertEq(completed.length, items.length, "every item processed exactly once");
    assertTrue(
      maxObserved <= 3,
      `max in-flight (${maxObserved}) respects concurrency=3`,
    );
    assertEq(
      progressUpdates.length,
      items.length,
      "progress callback fires once per completion",
    );
    assertEq(progressUpdates[items.length - 1].done, items.length, "final done = total");
    assertEq(progressUpdates[items.length - 1].total, items.length, "total stays correct");
  }

  console.log("\n[25] fetchMovieMetadata — cache hit returns without API call");
  {
    // Pre-populate the cache with a known-fresh entry. fetchMovieMetadata
    // should return the cached value WITHOUT calling requestUrl. We verify
    // by counting calls to the stubbed requestUrl: count must not increase.
    const cache: TmdbCache = {};
    const key = tmdbCacheKey("movie", 999, "zh-CN");
    cache[key] = {
      poster_url: "https://image.tmdb.org/t/p/w500/cached.jpg",
      translation: { title: "缓存标题", overview: "缓存简介", tagline: "", genres: ["动作"] },
      cached_at: Date.now() - 60_000,
      expires_at: Date.now() + 86_400_000 * 30,
    };

    const stub = await import("./stub-obsidian");
    const before = stub.requestUrlMock.calls.length;
    const result = await fetchMovieMetadata(999, "test-key", "w500", "zh-CN", cache, 90);
    const after = stub.requestUrlMock.calls.length;

    assertEq(after, before, "cache hit does not call requestUrl");
    assertEq(result.poster_url, "https://image.tmdb.org/t/p/w500/cached.jpg",
      "returns cached poster");
    assertEq(result.translation?.title, "缓存标题", "returns cached title");
  }

  // ── Test 26-30: spec 0002 diff-based write ────────────────────────────
  // Critical safety property: when frontmatter has any meaningful change,
  // diff MUST return true. False negatives = silent data loss.
  // See spec 0002 §"Acceptance criterion (data integrity)".

  console.log("\n[26] valuesEqual — primitives + arrays (order-sensitive)");
  {
    assertTrue(valuesEqual(1, 1), "1 === 1");
    assertTrue(valuesEqual("a", "a"), '"a" === "a"');
    assertTrue(valuesEqual(true, true), "true === true");
    assertTrue(valuesEqual(null, null), "null === null");
    assertTrue(!valuesEqual(1, "1"), "number 1 !== string '1' (type-strict)");
    assertTrue(!valuesEqual(1, 2), "1 !== 2");
    assertTrue(!valuesEqual("a", "b"), '"a" !== "b"');

    assertTrue(valuesEqual([], []), "empty arrays equal");
    assertTrue(
      valuesEqual(["a", "b", "c"], ["a", "b", "c"]),
      "same arrays equal",
    );
    assertTrue(
      !valuesEqual(["a", "b", "c"], ["a", "c", "b"]),
      "reordered arrays NOT equal (order-sensitive — protects against silent drops)",
    );
    assertTrue(
      !valuesEqual(["a", "b"], ["a", "b", "c"]),
      "different-length arrays not equal",
    );
    assertTrue(
      valuesEqual([1, 2, 3], [1, 2, 3]),
      "numeric arrays equal",
    );
    assertTrue(
      !valuesEqual([1, "2", 3], [1, 2, 3]),
      "type mismatch inside arrays caught (1, '2', 3) vs (1, 2, 3)",
    );
  }

  console.log("\n[27] frontmatterWouldChange — true negatives (skip write)");
  {
    const newData = {
      trakt_title: "The Dark Knight",
      trakt_year: 2008,
      trakt_rating: 8.5,
      trakt_genres: ["Action", "Crime", "Drama"],
      trakt_imdb_id: null, // null in newData = "would delete"
      trakt_synced_at: "2026-05-10T22:12:40.233Z",
    };
    const existingFm = {
      trakt_title: "The Dark Knight",
      trakt_year: 2008,
      trakt_rating: 8.5,
      trakt_genres: ["Action", "Crime", "Drama"],
      // trakt_imdb_id absent (matches newData null → no-op delete)
      trakt_synced_at: "2026-05-09T10:00:00.000Z", // different but ignored
    };
    assertTrue(
      !frontmatterWouldChange(newData, existingFm, ["trakt_synced_at"]),
      "identical content (synced_at ignored) → false",
    );

    // Without the ignoreKeys, synced_at difference would make it true
    assertTrue(
      frontmatterWouldChange(newData, existingFm),
      "without ignoreKeys, synced_at difference triggers true",
    );

    // Existing has extra user-added field that's not in newData → not our
    // concern, should not trigger write
    const fmWithUserField = { ...existingFm, my_personal_rating: 5 };
    assertTrue(
      !frontmatterWouldChange(newData, fmWithUserField, ["trakt_synced_at"]),
      "user-added field (not in newData) ignored → false",
    );

    // newData has null where existingFm has nothing → no-op delete → false
    const newDataWithNulls = { ...newData, trakt_tvdb_id: null };
    assertTrue(
      !frontmatterWouldChange(newDataWithNulls, existingFm, ["trakt_synced_at"]),
      "newData has null for absent existing key → no-op delete → false",
    );
  }

  console.log("\n[28] frontmatterWouldChange — true positives (must write)");
  {
    const baseExisting = {
      trakt_title: "The Dark Knight",
      trakt_year: 2008,
      trakt_rating: 8.5,
      trakt_genres: ["Action", "Crime", "Drama"],
      trakt_synced_at: "2026-05-09T10:00:00.000Z",
    };

    // String value differs
    assertTrue(
      frontmatterWouldChange(
        { trakt_title: "The Dark Knight Rises" },
        baseExisting,
        ["trakt_synced_at"],
      ),
      "title change detected",
    );

    // Numeric value differs
    assertTrue(
      frontmatterWouldChange(
        { trakt_rating: 8.6 },
        baseExisting,
        ["trakt_synced_at"],
      ),
      "rating change detected",
    );

    // newData has key existingFm doesn't (e.g. user added new fields,
    // upgraded plugin adds new fields)
    assertTrue(
      frontmatterWouldChange(
        { trakt_new_field: "value" },
        baseExisting,
        ["trakt_synced_at"],
      ),
      "newly-introduced field detected",
    );

    // newData has null where existingFm has a value → callback would
    // delete → real change
    assertTrue(
      frontmatterWouldChange(
        { trakt_title: null },
        baseExisting,
        ["trakt_synced_at"],
      ),
      "null over existing value = delete = change",
    );

    // Array reordered (silent-loss protection — see valuesEqual rationale)
    assertTrue(
      frontmatterWouldChange(
        { trakt_genres: ["Crime", "Action", "Drama"] },
        baseExisting,
        ["trakt_synced_at"],
      ),
      "reordered array detected (catches Trakt-side genre order changes)",
    );

    // Array length differs (e.g. genre added or removed upstream)
    assertTrue(
      frontmatterWouldChange(
        { trakt_genres: ["Action", "Crime", "Drama", "Thriller"] },
        baseExisting,
        ["trakt_synced_at"],
      ),
      "longer genre array detected",
    );
    assertTrue(
      frontmatterWouldChange(
        { trakt_genres: ["Action", "Crime"] },
        baseExisting,
        ["trakt_synced_at"],
      ),
      "shorter genre array detected",
    );

    // Empty existingFm (note exists but no frontmatter) → must write
    assertTrue(
      frontmatterWouldChange(
        { trakt_title: "X", trakt_year: 2024 },
        {},
        ["trakt_synced_at"],
      ),
      "empty existingFm triggers write",
    );
  }

  console.log("\n[29] frontmatterWouldChange — buildFrontmatterData round trip");
  {
    // The acceptance test: a freshly-built frontmatter from a stable item
    // must diff-equal a previous build of the same item (synced_at aside).
    // If this ever returns true unexpectedly, it means we have a hidden
    // non-determinism somewhere in buildFrontmatterData and the optimization
    // would silently rewrite all 1200 notes every sync — defeating the spec.
    const item = makeMovie();
    const settings = withSettings({});

    const dataA = buildFrontmatterData(item, settings);
    // Simulate "this is what's on disk after a previous sync"
    const onDiskFm: Record<string, unknown> = { ...dataA };
    // Simulate Obsidian writing it then us reading it back later — strip
    // null/undefined keys (toFrontmatter would have skipped them).
    for (const k of Object.keys(onDiskFm)) {
      const v = onDiskFm[k];
      if (v === null || v === undefined || v === "") delete onDiskFm[k];
    }

    // Wait a moment to ensure synced_at differs in dataB
    await new Promise((r) => setTimeout(r, 5));
    const dataB = buildFrontmatterData(item, settings);

    const syncedAtKey = `${settings.propertyPrefix}synced_at`;
    assertTrue(
      dataA[syncedAtKey] !== dataB[syncedAtKey],
      "sanity: two builds produce different synced_at values",
    );
    assertTrue(
      !frontmatterWouldChange(dataB, onDiskFm, [syncedAtKey]),
      "stable item → no diff (synced_at correctly ignored)",
    );

    // Now perturb the item — should detect a change
    const item2 = makeMovie();
    item2.title = "Different Title";
    const dataC = buildFrontmatterData(item2, settings);
    assertTrue(
      frontmatterWouldChange(dataC, onDiskFm, [syncedAtKey]),
      "perturbed item → diff detected",
    );

    // Toggle i18n — many fields change
    const i18nItem = makeI18nMovie();
    const i18nSettings = withSettings({ metadataLanguage: "zh-CN" });
    const dataI18n = buildFrontmatterData(i18nItem, i18nSettings);
    assertTrue(
      frontmatterWouldChange(dataI18n, onDiskFm, [syncedAtKey]),
      "i18n switch → diff detected (translated fields + new original_* fields)",
    );
  }

  console.log("\n[30] body-section diff: identity check on updateManagedBodySections");
  {
    // updateManagedBodySections is the body equivalent of the frontmatter
    // diff. Verified pure & deterministic by spec investigation; this test
    // locks that in — if anyone adds a Date.now() or random in the renderer
    // path, the third assertion will start failing.
    const item: NormalizedItem = {
      ...makeMovie(),
      type: "show",
      ids: { trakt: 99, slug: "breaking-bad", imdb: "tt0903747", tmdb: 1396 },
      title: "Breaking Bad",
      watch_history_episodes: [
        {
          season: 1,
          episode: 1,
          watched_at: ["2024-01-15T21:30:00.000Z"],
        },
      ],
    };
    const settings = withSettings({ syncWatchedDetail: true });

    const initialContent = "# Breaking Bad\n\nSome user notes.\n";
    const renderedOnce = updateManagedBodySections(initialContent, item, settings);
    const renderedTwice = updateManagedBodySections(renderedOnce, item, settings);
    assertEq(
      renderedOnce,
      renderedTwice,
      "idempotent: second call produces identical output (skip-write detection works)",
    );

    // New episode → output should differ
    const itemMore: NormalizedItem = {
      ...item,
      watch_history_episodes: [
        ...item.watch_history_episodes!,
        {
          season: 1,
          episode: 2,
          watched_at: ["2024-01-16T22:00:00.000Z"],
        },
      ],
    };
    const renderedMore = updateManagedBodySections(renderedOnce, itemMore, settings);
    assertTrue(
      renderedOnce !== renderedMore,
      "new episode → different body content (write triggered)",
    );

    // No-op when syncWatchedDetail is off — body returned as-is
    const offSettings = withSettings({ syncWatchedDetail: false });
    const renderedOff = updateManagedBodySections(renderedOnce, item, offSettings);
    assertEq(
      renderedOff,
      renderedOnce,
      "syncWatchedDetail off → returns input unchanged",
    );
  }

  // ── Test 31-33: spec 0.3.1 filename disambiguation ─────────────────────
  // When metadata localization collapses distinct items to the same display
  // title (e.g. "重生" for both "Born Again" and "Reborn"), the default
  // {{title}} ({{year}}) filename collides. Disambiguation must:
  //   - skip the fallback when no collision exists (tier 0)
  //   - inject originalTitle when one is available and distinct (tier 1)
  //   - append [trakt_id] as last-resort (tier 2)
  // Critical: failing to fall back = recurring per-sync error for the user.

  console.log("\n[31] buildFilename — titleOverride substitutes into {{title}} slot");
  {
    const item: NormalizedItem = {
      ...makeMovie(),
      title: "重生",
      originalTitle: "Born Again",
      year: 2020,
    };

    assertEq(
      buildFilename(item, "{{title}} ({{year}})"),
      "重生 (2020)",
      "default rendering uses item.title",
    );
    assertEq(
      buildFilename(item, "{{title}} ({{year}})", "重生 (Born Again)"),
      "重生 (Born Again) (2020)",
      "titleOverride substitutes the {{title}} slot only — year stays at end",
    );
    assertEq(
      buildFilename(item, "{{year}} - {{title}}", "重生 [157810]"),
      "2020 - 重生 [157810]",
      "titleOverride works with non-default templates too",
    );
  }

  console.log("\n[32] disambiguatedFilename — no collision returns tier 0");
  {
    const item: NormalizedItem = {
      ...makeMovie(),
      title: "重生",
      originalTitle: "Born Again",
      year: 2020,
    };
    const result = disambiguatedFilename(
      item,
      "{{title}} ({{year}})",
      () => false, // nothing is taken
    );
    assertEq(result.filename, "重生 (2020)", "tier 0 filename");
    assertEq(result.tier, 0, "tier === 0 when no collision");
  }

  console.log("\n[33] disambiguatedFilename — tier 1 fallback uses originalTitle");
  {
    const item: NormalizedItem = {
      ...makeMovie(),
      title: "重生",
      originalTitle: "Born Again",
      ids: { trakt: 157810, slug: "born-again", imdb: "tt12015636", tmdb: 100857 },
      year: 2020,
    };
    // Pretend "重生 (2020)" already exists (the user's existing note for
    // a different show that also localizes to "重生" in 2020).
    const taken = new Set(["重生 (2020)"]);
    const result = disambiguatedFilename(
      item,
      "{{title}} ({{year}})",
      (fn) => taken.has(fn),
    );
    assertEq(
      result.filename,
      "重生 (Born Again) (2020)",
      "tier 1 inserts originalTitle between localized title and year",
    );
    assertEq(result.tier, 1, "tier === 1 when only base collides");
  }

  console.log("\n[34] disambiguatedFilename — tier 2 appends trakt_id");
  {
    const item: NormalizedItem = {
      ...makeMovie(),
      title: "重生",
      originalTitle: "Born Again",
      ids: { trakt: 157810, slug: "born-again", imdb: "tt12015636", tmdb: 100857 },
      year: 2020,
    };
    // Both tier 0 and tier 1 are taken → fall through to tier 2.
    const taken = new Set([
      "重生 (2020)",
      "重生 (Born Again) (2020)",
    ]);
    const result = disambiguatedFilename(
      item,
      "{{title}} ({{year}})",
      (fn) => taken.has(fn),
    );
    assertEq(
      result.filename,
      "重生 (Born Again) [157810] (2020)",
      "tier 2 inserts originalTitle + trakt_id",
    );
    assertEq(result.tier, 2, "tier === 2 when tier 1 also collides");
  }

  console.log("\n[35] disambiguatedFilename — same-title edge case skips tier 1");
  {
    // When localization is OFF or when the item happens to have the same
    // value for title and originalTitle (e.g. proper nouns like "Heat"),
    // tier 1 would produce the SAME filename as tier 0 — so we skip it.
    const item: NormalizedItem = {
      ...makeMovie(),
      title: "Heat",
      originalTitle: "Heat", // same — tier 1 wouldn't disambiguate
      ids: { trakt: 99999, slug: "heat-1995", imdb: "tt0113277", tmdb: 949 },
      year: 1995,
    };
    const taken = new Set(["Heat (1995)"]);
    const result = disambiguatedFilename(
      item,
      "{{title}} ({{year}})",
      (fn) => taken.has(fn),
    );
    assertEq(
      result.filename,
      "Heat [99999] (1995)",
      "tier 2 without originalTitle: just title + [trakt_id]",
    );
    assertEq(result.tier, 2, "tier === 2 (tier 1 was skipped — would be no-op)");
  }

  console.log("\n[36] disambiguatedFilename — empty originalTitle treated as same");
  {
    // Defensive: items where originalTitle is "" (empty string) should
    // also skip tier 1, since injecting "(  )" would be ugly.
    const item: NormalizedItem = {
      ...makeMovie(),
      title: "重生",
      originalTitle: "", // edge case: missing or empty
      ids: { trakt: 159058, slug: "unknown", imdb: "tt0", tmdb: 0 },
      year: 2020,
    };
    const taken = new Set(["重生 (2020)"]);
    const result = disambiguatedFilename(
      item,
      "{{title}} ({{year}})",
      (fn) => taken.has(fn),
    );
    assertEq(
      result.filename,
      "重生 [159058] (2020)",
      "empty originalTitle skips tier 1, goes straight to tier-2-without-original",
    );
    assertEq(result.tier, 2, "tier === 2");
  }

  // ── Test 37-40: spec 0.3.2 TMDB key verification ──────────────────────
  // The Test button in the settings tab runs verifyTmdbApiKey() against
  // TMDB's /configuration endpoint. Locking in the discriminated-result
  // contract here so the UI can branch on `reason` without re-parsing
  // free-form error strings.

  console.log("\n[37] verifyTmdbApiKey — empty key short-circuits (no network call)");
  {
    const stub = await import("./stub-obsidian");
    stub.resetRequestUrlMock(() => ({ status: 200, json: {}, headers: {} }));
    const before = stub.requestUrlMock.calls.length;

    const result1 = await verifyTmdbApiKey("");
    const result2 = await verifyTmdbApiKey("   ");

    assertEq(stub.requestUrlMock.calls.length, before,
      "empty / whitespace-only input never hits the network");
    assertTrue(!result1.ok && result1.reason === "empty",
      "empty string → reason='empty'");
    assertTrue(!result2.ok && result2.reason === "empty",
      "whitespace → reason='empty'");
  }

  console.log("\n[38] verifyTmdbApiKey — 200 OK returns ok:true");
  {
    const stub = await import("./stub-obsidian");
    stub.resetRequestUrlMock(() => ({
      status: 200,
      json: { images: { base_url: "https://image.tmdb.org/t/p/" } },
      headers: {},
    }));

    const result = await verifyTmdbApiKey("valid-looking-key-12345");

    assertTrue(result.ok, "200 status → ok=true");
    assertEq(stub.requestUrlMock.calls.length, 1, "one network call");
    assertTrue(
      stub.requestUrlMock.calls[0].url.includes("/configuration"),
      "hits /configuration endpoint, not a per-item endpoint",
    );
    assertTrue(
      stub.requestUrlMock.calls[0].url.includes("api_key=valid-looking-key-12345"),
      "passes the supplied key as ?api_key=",
    );
  }

  console.log("\n[39] verifyTmdbApiKey — 401 returns unauthorized with TMDB's status_message");
  {
    const stub = await import("./stub-obsidian");
    stub.resetRequestUrlMock(() => ({
      status: 401,
      json: { status_message: "Invalid API key: You must be granted a valid key." },
      headers: {},
    }));

    const result = await verifyTmdbApiKey("bogus");

    assertTrue(!result.ok && result.reason === "unauthorized",
      "401 → reason='unauthorized'");
    assertTrue(
      !result.ok && result.detail?.includes("Invalid API key") === true,
      "TMDB's status_message surfaced to UI via result.detail",
    );

    // Also accept 403
    stub.resetRequestUrlMock(() => ({
      status: 403,
      json: { status_message: "Suspended key" },
      headers: {},
    }));
    const result403 = await verifyTmdbApiKey("suspended-key");
    assertTrue(!result403.ok && result403.reason === "unauthorized",
      "403 also classifies as unauthorized");
  }

  console.log("\n[40] verifyTmdbApiKey — other statuses & exceptions classify as network");
  {
    const stub = await import("./stub-obsidian");

    // Server-side error
    stub.resetRequestUrlMock(() => ({
      status: 503,
      json: {},
      headers: {},
    }));
    const r503 = await verifyTmdbApiKey("any-key");
    assertTrue(!r503.ok && r503.reason === "network",
      "5xx → reason='network'");
    assertTrue(
      !r503.ok && r503.detail?.includes("503") === true,
      "503 detail mentions the status code",
    );

    // Thrown exception (DNS failure, fetch timeout, etc.)
    stub.resetRequestUrlMock(() => {
      throw new Error("getaddrinfo ENOTFOUND api.themoviedb.org");
    });
    const rEx = await verifyTmdbApiKey("any-key");
    assertTrue(!rEx.ok && rEx.reason === "network",
      "thrown exception → reason='network'");
    assertTrue(
      !rEx.ok && rEx.detail?.includes("ENOTFOUND") === true,
      "exception message surfaced via result.detail",
    );
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Smoke results: ${passes} passed, ${failures} failed`);
  console.log("=".repeat(60));
  if (failures > 0) {
    process.exit(1);
  }
})();
