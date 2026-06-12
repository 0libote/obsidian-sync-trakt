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
  applyCommunityStatsPolicy,
  frontmatterWouldChange,
  mergeFrontmatterIntoContent,
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
  TMDB_CACHE_ENTRY_VERSION,
  type TmdbMovieResponse,
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
import {
  SyncEngine,
  buildFilename,
  dedupeDuplicateNotes,
  disambiguatedFilename,
  findMatchingIdentityFile,
} from "../src/sync-engine";
import {
  localTodayISODate,
  localHHMM,
  addDaysISO,
  daysBetweenISO,
  isMarkerRegionValid,
  isMarkerRegionEmpty,
  replaceMarkerBlock,
  appendMarkerBlock,
  mergeMarkerBlockIncremental,
  renderPreview,
  renderVerb,
  renderEntry,
  renderMarkerBlock,
  aggregateEventsForDate,
  computeDailyNotePath,
  computeThisMonth,
  computeLastMonth,
  processDate,
} from "../src/daily-notes";
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
  LOCAL_ELIGIBLE_KEYS,
  DEFAULT_LOCAL_KEYS,
  DEFAULT_LOCAL_KEYS_ADDED_IN_SCHEMA_2,
  LOCAL_STORAGE_PREFIX,
  LOCAL_KEYS_STORAGE_KEY,
  LOCAL_KEYS_SCHEMA_STORAGE_KEY,
  LOCAL_KEYS_SCHEMA_VERSION,
} from "../src/settings";
import { getTranslator, t } from "../src/i18n";
import type { NormalizedItem } from "../src/types";
import {
  RECENT_UPDATE_HIGHLIGHTS,
  RELEASE_LOG,
  entriesNewerThan,
  isVersionNewer,
} from "../src/release-log";
import {
  buildSlimSyncedHistoryState,
  mergeSyncedHistoryFields,
  RuntimeStore,
  syncedPayloadContainsRuntimeData,
  RUNTIME_STORAGE_SCHEMA_VERSION,
} from "../src/runtime-store";

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
    "Sync Trakt：新增 5，更新 3，未变 12，移除 1。",
    "interpolated zh-CN notice with vars",
  );
  const tEn = getTranslator("en");
  assertEq(
    tEn("notice.syncComplete", { added: 5, updated: 3, unchanged: 12, removed: 1 }),
    "Sync Trakt: 5 new, 3 updated, 12 unchanged, 1 removed.",
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

  // [0.6.0 / spec 0007] 8 new bundled languages — Japanese, Korean, French,
  // German, Italian, Spanish, Portuguese (BR), Russian. Each maps to its
  // own template; only truly-unsupported codes fall back to English.
  assertTrue(
    getDefaultMovieTemplate("ja-JP") !== DEFAULT_MOVIE_TEMPLATE_EN,
    "ja-JP no longer falls back to English (0.6.0 added bundled JA)",
  );
  assertTrue(
    getDefaultMovieTemplate("ko-KR") !== DEFAULT_MOVIE_TEMPLATE_EN,
    "ko-KR no longer falls back to English",
  );
  assertTrue(
    getDefaultMovieTemplate("fr-FR") !== DEFAULT_MOVIE_TEMPLATE_EN,
    "fr-FR no longer falls back to English",
  );
  assertTrue(
    getDefaultMovieTemplate("de-DE") !== DEFAULT_MOVIE_TEMPLATE_EN,
    "de-DE no longer falls back to English",
  );
  assertTrue(
    getDefaultMovieTemplate("it-IT") !== DEFAULT_MOVIE_TEMPLATE_EN,
    "it-IT no longer falls back to English",
  );
  assertTrue(
    getDefaultMovieTemplate("es-ES") !== DEFAULT_MOVIE_TEMPLATE_EN,
    "es-ES no longer falls back to English",
  );
  assertTrue(
    getDefaultMovieTemplate("pt-BR") !== DEFAULT_MOVIE_TEMPLATE_EN,
    "pt-BR no longer falls back to English",
  );
  assertTrue(
    getDefaultMovieTemplate("ru-RU") !== DEFAULT_MOVIE_TEMPLATE_EN,
    "ru-RU no longer falls back to English",
  );

  // Short codes resolve the same as full locales
  assertEq(
    getDefaultMovieTemplate("ja"),
    getDefaultMovieTemplate("ja-JP"),
    "'ja' short code = 'ja-JP' full locale",
  );

  // Truly-unsupported locales fall back to English
  assertEq(
    getDefaultMovieTemplate("tr-TR"),
    DEFAULT_MOVIE_TEMPLATE_EN,
    "tr-TR (unsupported) → EN fallback",
  );

  // Content sanity: each new bundled template has its language's
  // section heading (catches accidental copy-paste from English)
  assertTrue(
    getDefaultMovieTemplate("ja-JP").includes("## あらすじ"),
    "ja-JP movie has 'あらすじ' (synopsis)",
  );
  assertTrue(
    getDefaultMovieTemplate("ko-KR").includes("## 줄거리"),
    "ko-KR movie has '줄거리' (synopsis)",
  );
  assertTrue(
    getDefaultMovieTemplate("fr-FR").includes("## Synopsis"),
    "fr-FR movie has 'Synopsis'",
  );
  assertTrue(
    getDefaultMovieTemplate("de-DE").includes("## Inhalt"),
    "de-DE movie has 'Inhalt'",
  );
  assertTrue(
    getDefaultMovieTemplate("it-IT").includes("## Sinossi"),
    "it-IT movie has 'Sinossi'",
  );
  assertTrue(
    getDefaultMovieTemplate("es-ES").includes("## Sinopsis"),
    "es-ES movie has 'Sinopsis'",
  );
  assertTrue(
    getDefaultMovieTemplate("pt-BR").includes("## Sinopse"),
    "pt-BR movie has 'Sinopse'",
  );
  assertTrue(
    getDefaultMovieTemplate("ru-RU").includes("## Описание"),
    "ru-RU movie has 'Описание'",
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
    DEFAULT_SETTINGS.dailyNotesAutoSyncEnabled,
    false,
    "Daily Notes auto-sync defaults off",
  );
  assertEq(
    DEFAULT_SETTINGS.dailyNotesAutoSyncIntervalMinutes,
    60,
    "Daily Notes auto-sync interval defaults to 60 minutes",
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
  assertEq(
    cacheEntryFreshness(
      {
        cache_version: TMDB_CACHE_ENTRY_VERSION,
        poster_url: "",
        translation: null,
        cached_at: now - 1000,
        expires_at: now + 1000,
      },
      now,
    ),
    "fresh",
    "expires_at in future → fresh",
  );
  assertEq(
    cacheEntryFreshness(
      {
        cache_version: TMDB_CACHE_ENTRY_VERSION,
        poster_url: "",
        translation: null,
        cached_at: now - 10000,
        expires_at: now - 1,
      },
      now,
    ),
    "stale",
    "expires_at in past → stale",
  );
  assertEq(
    cacheEntryFreshness(
      { poster_url: "", translation: null, cached_at: now - 1000, expires_at: now + 1000 },
      now,
    ),
    "missing",
    "cache entries from older picker versions are refetched synchronously",
  );

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
      cache_version: TMDB_CACHE_ENTRY_VERSION,
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

  console.log("\n[29a] applyCommunityStatsPolicy — smart dampens tiny changes");
  {
    const settings = withSettings({
      communityStatsUpdatePolicy: "smart",
      communityStatsRefreshIntervalDays: 7,
      communityRatingChangeThreshold: 0.1,
      communityVotesChangeThresholdPercent: 5,
    });
    const newData = {
      trakt_rating: 8.54,
      trakt_votes: 1030,
      trakt_synced_at: "2026-05-21T12:00:00.000Z",
    };
    const existingFm = {
      trakt_rating: 8.5,
      trakt_votes: 1000,
      trakt_synced_at: "2026-05-20T12:00:00.000Z",
      trakt_community_stats_synced_at: "2026-05-20T12:00:00.000Z",
    };
    const result = applyCommunityStatsPolicy(
      newData,
      existingFm,
      settings,
      "2026-05-21T12:00:00.000Z",
    );
    assertEq(result.data.trakt_rating, 8.5, "small rating change keeps old value");
    assertEq(result.data.trakt_votes, 1000, "small votes change keeps old value");
    assertTrue(result.statsChanged, "statsChanged reports source drift");
    assertTrue(!result.statsWriteAllowed, "smart policy blocks tiny changes before interval");

    const legacyResult = applyCommunityStatsPolicy(
      newData,
      {
        trakt_rating: 8.5,
        trakt_votes: 1000,
        trakt_synced_at: "2026-05-20T12:00:00.000Z",
      },
      settings,
      "2026-05-21T12:00:00.000Z",
    );
    assertEq(
      legacyResult.statsBaselineToPreserve,
      "2026-05-20T12:00:00.000Z",
      "legacy notes expose old synced_at as a baseline to preserve",
    );
    assertTrue(
      !("trakt_community_stats_synced_at" in legacyResult.data),
      "legacy baseline does not force a standalone stats timestamp write",
    );

    const preservedBaselineResult = applyCommunityStatsPolicy(
      {
        trakt_rating: 8.54,
        trakt_votes: 1030,
        trakt_synced_at: "2026-05-27T12:00:00.000Z",
      },
      {
        trakt_rating: 8.5,
        trakt_votes: 1000,
        trakt_synced_at: "2026-05-21T12:00:00.000Z",
        trakt_community_stats_synced_at: "2026-05-20T12:00:00.000Z",
      },
      settings,
      "2026-05-27T12:00:00.000Z",
    );
    assertEq(
      preservedBaselineResult.data.trakt_rating,
      8.54,
      "preserved baseline prevents unrelated synced_at from postponing interval",
    );
  }

  console.log("\n[29b] applyCommunityStatsPolicy — thresholds and interval allow writes");
  {
    const settings = withSettings({
      communityStatsUpdatePolicy: "smart",
      communityStatsRefreshIntervalDays: 7,
      communityRatingChangeThreshold: 0.1,
      communityVotesChangeThresholdPercent: 5,
    });
    const oldFm = {
      trakt_rating: 8.5,
      trakt_votes: 1000,
      trakt_synced_at: "2026-05-20T12:00:00.000Z",
      trakt_community_stats_synced_at: "2026-05-20T12:00:00.000Z",
    };

    const ratingHit = applyCommunityStatsPolicy(
      {
        trakt_rating: 8.6,
        trakt_votes: 1000,
        trakt_synced_at: "2026-05-21T12:00:00.000Z",
      },
      oldFm,
      settings,
      "2026-05-21T12:00:00.000Z",
    );
    assertEq(ratingHit.data.trakt_rating, 8.6, "rating threshold writes new rating");
    assertEq(
      ratingHit.data.trakt_community_stats_synced_at,
      "2026-05-21T12:00:00.000Z",
      "rating threshold stamps community stats timestamp",
    );

    const votesHit = applyCommunityStatsPolicy(
      {
        trakt_rating: 8.5,
        trakt_votes: 950,
        trakt_synced_at: "2026-05-21T12:00:00.000Z",
      },
      oldFm,
      settings,
      "2026-05-21T12:00:00.000Z",
    );
    assertEq(votesHit.data.trakt_votes, 950, "votes percentage threshold uses absolute change");

    const intervalHit = applyCommunityStatsPolicy(
      {
        trakt_rating: 8.54,
        trakt_votes: 1030,
        trakt_synced_at: "2026-05-28T12:00:00.000Z",
      },
      oldFm,
      settings,
      "2026-05-28T12:00:00.000Z",
    );
    assertEq(intervalHit.data.trakt_rating, 8.54, "interval expiry writes small rating drift");
    assertEq(intervalHit.data.trakt_votes, 1030, "interval expiry writes small votes drift");
  }

  console.log("\n[29c] mergeFrontmatterIntoContent — repairs malformed plugin YAML");
  {
    const corrupted = [
      "---",
      "trakt_title: Old Title",
      "user_rating: 5",
      "trakt_rating: 7.220989704132098970413208trakt_votes: 119101",
      "398300170898",
      "trakt_country: us",
      "trakt_country: us",
      "tags:",
      "  - old/plugin",
      "personal_note: keep me",
      "---",
      "# Body",
    ].join("\n");
    const merged = mergeFrontmatterIntoContent(corrupted, {
      trakt_title: "New Title",
      trakt_rating: 8.25,
      trakt_votes: 120000,
      trakt_country: "us",
      tags: ["trakt/movie", "trakt/watched"],
    });

    assertContains(
      merged,
      "trakt_rating: 8.25\ntrakt_votes: 120000\ntrakt_country: us",
      "owned scalar fields are rewritten as separate YAML lines",
    );
    assertContains(
      merged,
      "tags:\n  - trakt/movie\n  - trakt/watched",
      "owned array field is rewritten",
    );
    assertContains(
      merged,
      "user_rating: 5\npersonal_note: keep me",
      "unowned user fields are preserved",
    );
    assertContains(merged, "---\n# Body", "body remains after frontmatter");
    assertNotContains(
      merged,
      "trakt_rating: 7.220989704132098970413208trakt_votes",
      "malformed owned line is removed",
    );
    assertNotContains(
      merged,
      "398300170898",
      "orphaned malformed owned continuation line is removed",
    );
  }

  console.log("\n[29d] mergeFrontmatterIntoContent — adds frontmatter when absent");
  {
    const merged = mergeFrontmatterIntoContent("# Body only", {
      trakt_title: "Only Title",
    });

    assertEq(
      merged,
      "---\ntrakt_title: Only Title\n---\n# Body only",
      "frontmatter block is inserted before body",
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

  // ── Test 41: spec 0004 legacy-folder migration notice ─────────────────
  // Verifies the i18n key the migration logic relies on is present in
  // both languages. The file-reading half of the migration is bound to
  // Obsidian's vault adapter and is tested manually during release
  // verification (covered by the spec 0004 edge-case matrix).

  console.log("\n[41] migration notice i18n key present + sensible in both langs");
  {
    const enMsg = t("notice.migratedFromLegacyFolder", "en");
    const zhMsg = t("notice.migratedFromLegacyFolder", "zh-CN");

    assertTrue(
      enMsg.length > 0 && !enMsg.startsWith("notice."),
      "en: key resolved (didn't fall through to raw key)",
    );
    assertTrue(
      zhMsg.length > 0 && !zhMsg.startsWith("notice."),
      "zh-CN: key resolved",
    );
    assertTrue(
      enMsg.toLowerCase().includes("sync trakt"),
      "en notice mentions Sync Trakt so users know which plugin spoke",
    );
    assertTrue(
      zhMsg.includes("Sync Trakt") || zhMsg.includes("迁移"),
      "zh-CN notice mentions Sync Trakt / migration so users know what happened",
    );
    assertTrue(
      enMsg !== zhMsg,
      "en + zh-CN actually differ (not accidentally the same string)",
    );
  }

  // ── Test 42-44: spec 0003 device-local settings constants ─────────────
  // Most of the SettingsStore logic is bound to Obsidian's app.loadLocalStorage
  // and can't be smoke-tested without a heavier stub. What we CAN lock down:
  // the constants that drive the partition, and the i18n keys the UI depends on.

  console.log("\n[42] LOCAL_ELIGIBLE_KEYS contents are stable + match settings type");
  {
    // Lock the exact list — any change here is a semantic decision that
    // must be paired with a CHANGELOG note + migration consideration.
    const expected = new Set([
      "syncOnStartup",
      "autoSyncEnabled",
      "autoSyncIntervalMinutes",
      "dailyNotesAutoSyncEnabled",
      "dailyNotesAutoSyncIntervalMinutes",
      "uiLanguage",
    ]);
    const actual = new Set<string>(LOCAL_ELIGIBLE_KEYS);
    assertEq(actual.size, expected.size, "list has 6 entries");
    for (const k of expected) {
      assertTrue(actual.has(k), `LOCAL_ELIGIBLE_KEYS includes '${k}'`);
    }
    // Every key must actually be a settable field on TraktrSettings
    const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
    for (const k of LOCAL_ELIGIBLE_KEYS) {
      assertTrue(
        k in defaults,
        `'${k}' is a real key in DEFAULT_SETTINGS (not a typo)`,
      );
    }
  }

  console.log("\n[43] DEFAULT_LOCAL_KEYS is a strict subset; uiLanguage NOT default-local");
  {
    const eligible = new Set<string>(LOCAL_ELIGIBLE_KEYS);
    for (const k of DEFAULT_LOCAL_KEYS) {
      assertTrue(
        eligible.has(k),
        `DEFAULT_LOCAL_KEYS member '${k}' must also be LOCAL_ELIGIBLE`,
      );
    }
    // Specific to spec 0003: uiLanguage is opt-in, NOT default-local.
    // Most users want consistent UI across devices, so syncing is the
    // right default. The cloud icon is still available to toggle.
    const defaultLocal = new Set<string>(DEFAULT_LOCAL_KEYS);
    assertTrue(
      !defaultLocal.has("uiLanguage"),
      "uiLanguage defaults to SYNCED (not default-local) — spec 0003 §Initial scope",
    );
    assertTrue(
      defaultLocal.has("syncOnStartup"),
      "syncOnStartup defaults to LOCAL (per-device choice)",
    );
    assertTrue(
      defaultLocal.has("autoSyncEnabled"),
      "autoSyncEnabled defaults to LOCAL",
    );
    assertTrue(
      defaultLocal.has("autoSyncIntervalMinutes"),
      "autoSyncIntervalMinutes defaults to LOCAL",
    );
    assertTrue(
      defaultLocal.has("dailyNotesAutoSyncEnabled"),
      "dailyNotesAutoSyncEnabled defaults to LOCAL",
    );
    assertTrue(
      defaultLocal.has("dailyNotesAutoSyncIntervalMinutes"),
      "dailyNotesAutoSyncIntervalMinutes defaults to LOCAL",
    );
    assertEq(
      DEFAULT_LOCAL_KEYS_ADDED_IN_SCHEMA_2.length,
      2,
      "schema-2 default-local migration adds the two Daily Notes timer keys",
    );
  }

  console.log("\n[43b] device-local key migration adds new Daily Notes timer keys once");
  {
    const stub = await import("./stub-obsidian");
    const mainModule = await import("../src/main");
    const app = new stub.App();
    const plugin = new mainModule.default() as never;
    const mutable = plugin as {
      app: unknown;
      settings: TraktrSettings;
      migrateLocalKeysSchema: (keys: string[]) => string[];
    };
    mutable.app = app;
    mutable.settings = withSettings({
      dailyNotesAutoSyncEnabled: true,
      dailyNotesAutoSyncIntervalMinutes: 15,
    });

    const oldLocalKeys = [
      "syncOnStartup",
      "autoSyncEnabled",
      "autoSyncIntervalMinutes",
    ];
    const migrated = mutable.migrateLocalKeysSchema(oldLocalKeys);
    assertTrue(
      migrated.includes("dailyNotesAutoSyncEnabled"),
      "existing installs get Daily Notes auto-sync toggle marked LOCAL",
    );
    assertTrue(
      migrated.includes("dailyNotesAutoSyncIntervalMinutes"),
      "existing installs get Daily Notes interval marked LOCAL",
    );
    assertEq(
      app.loadLocalStorage(`${LOCAL_STORAGE_PREFIX}dailyNotesAutoSyncEnabled`),
      true,
      "migration stores current Daily Notes auto-sync value locally",
    );
    assertEq(
      app.loadLocalStorage(`${LOCAL_STORAGE_PREFIX}dailyNotesAutoSyncIntervalMinutes`),
      15,
      "migration stores current Daily Notes interval locally",
    );
    assertEq(
      app.loadLocalStorage(LOCAL_KEYS_SCHEMA_STORAGE_KEY),
      LOCAL_KEYS_SCHEMA_VERSION,
      "migration records the local-key schema version",
    );

    const userSyncedDailyKeys = oldLocalKeys;
    const afterSchemaRecorded = mutable.migrateLocalKeysSchema(userSyncedDailyKeys);
    assertTrue(
      !afterSchemaRecorded.includes("dailyNotesAutoSyncEnabled"),
      "after schema migration, user can switch Daily Notes auto-sync back to synced",
    );
    assertTrue(
      !afterSchemaRecorded.includes("dailyNotesAutoSyncIntervalMinutes"),
      "after schema migration, user can switch Daily Notes interval back to synced",
    );
  }

  console.log("\n[44] localStorage key namespacing is consistent");
  {
    // The actual storage keys: prefix + key name; the _localKeys list
    // is itself stored with the prefix.
    assertTrue(
      LOCAL_KEYS_STORAGE_KEY.startsWith(LOCAL_STORAGE_PREFIX),
      "_localKeys storage key uses the plugin's namespace prefix",
    );
    assertTrue(
      LOCAL_STORAGE_PREFIX.endsWith(":"),
      "prefix ends with ':' for visual separation in localStorage inspector",
    );
    // Sanity-check the cloud-icon tooltips resolve in both languages
    const enSynced = t("settings.cloud.synced.tooltip", "en");
    const enLocal = t("settings.cloud.local.tooltip", "en");
    const zhSynced = t("settings.cloud.synced.tooltip", "zh-CN");
    const zhLocal = t("settings.cloud.local.tooltip", "zh-CN");
    assertTrue(
      !enSynced.startsWith("settings.") &&
        !enLocal.startsWith("settings.") &&
        !zhSynced.startsWith("settings.") &&
        !zhLocal.startsWith("settings."),
      "all 4 cloud-icon tooltip keys resolve in both languages",
    );
    assertTrue(
      enSynced !== enLocal && zhSynced !== zhLocal,
      "synced and local tooltips actually differ in each language",
    );
  }

  console.log("\n[44b] Daily Notes auto-sync i18n keys resolve");
  {
    const keys = [
      "daily.autoSync.heading",
      "daily.autoSync.name",
      "daily.autoSync.desc",
      "daily.autoSync.interval.name",
      "daily.autoSync.interval.desc",
      "status.dailySyncing",
    ];
    for (const key of keys) {
      const enLabel = t(key, "en");
      const zhLabel = t(key, "zh-CN");
      assertTrue(
        enLabel.length > 0 && !enLabel.startsWith("daily.") && !enLabel.startsWith("status."),
        `en: ${key} resolves`,
      );
      assertTrue(
        zhLabel.length > 0 && !zhLabel.startsWith("daily.") && !zhLabel.startsWith("status."),
        `zh-CN: ${key} resolves`,
      );
      assertTrue(enLabel !== zhLabel, `${key}: en and zh-CN differ`);
    }
  }

  // ── Test 45: spec 0005 tab labels ─────────────────────────────────────
  console.log("\n[45] tab labels resolve in both UI languages");
  {
    const tabs = ["tabs.general", "tabs.notes", "tabs.sync", "tabs.daily"];
    for (const key of tabs) {
      const enLabel = t(key, "en");
      const zhLabel = t(key, "zh-CN");
      assertTrue(
        enLabel.length > 0 && !enLabel.startsWith("tabs."),
        `en: ${key} resolves`,
      );
      assertTrue(
        zhLabel.length > 0 && !zhLabel.startsWith("tabs."),
        `zh-CN: ${key} resolves`,
      );
      assertTrue(
        enLabel !== zhLabel,
        `${key}: en and zh-CN labels actually differ`,
      );
    }
  }

  // ── Tests 46-52: spec 0006 Daily Notes integration ────────────────────
  // The file-IO half of daily-notes is bound to Obsidian's vault API
  // and verified manually during release. Pure logic is unit-tested
  // here: date helpers, marker detection, block rendering, event
  // aggregation. Safety contract enforced by tests 50-52.

  console.log("\n[46] daily-notes: date helpers");
  {
    const today = localTodayISODate(new Date("2026-05-11T15:00:00"));
    assertEq(today, "2026-05-11", "localTodayISODate returns YYYY-MM-DD");

    assertEq(localHHMM("2026-05-11T15:00:00Z"), localHHMM("2026-05-11T15:00:00Z"),
      "localHHMM is deterministic");
    const hhmm = localHHMM("2026-05-11T15:30:00");
    assertTrue(/^\d{2}:\d{2}$/.test(hhmm), `localHHMM produces HH:MM (got "${hhmm}")`);

    assertEq(addDaysISO("2026-05-11", 1), "2026-05-12", "add 1 day");
    assertEq(addDaysISO("2026-05-11", -1), "2026-05-10", "subtract 1 day");
    assertEq(addDaysISO("2026-12-31", 1), "2027-01-01", "year rollover");
    assertEq(addDaysISO("2026-02-28", 1), "2026-03-01", "non-leap Feb rollover");

    assertEq(daysBetweenISO("2026-05-11", "2026-05-12"), 1, "diff = 1");
    assertEq(daysBetweenISO("2026-05-11", "2026-05-11"), 0, "diff = 0 (same day)");
    assertEq(daysBetweenISO("2026-05-11", "2026-06-11"), 31, "diff = 31 days");
  }

  console.log("\n[47] daily-notes: marker region detection");
  {
    const start = "%% trakt:daily:start %%";
    const end = "%% trakt:daily:end %%";
    assertTrue(
      isMarkerRegionValid(`${start}\nfoo\n${end}`, start, end),
      "valid pair returns true",
    );
    assertTrue(
      !isMarkerRegionValid("no markers here", start, end),
      "missing both → false",
    );
    assertTrue(
      !isMarkerRegionValid(`only ${start} no end`, start, end),
      "missing end → false",
    );
    assertTrue(
      !isMarkerRegionValid(`only ${end} no start`, start, end),
      "missing start → false",
    );
    assertTrue(
      !isMarkerRegionValid(`${end}\nfoo\n${start}`, start, end),
      "end before start → false",
    );
  }

  console.log("\n[48] daily-notes: block render with markers");
  {
    const start = "%% trakt:daily:start %%";
    const end = "%% trakt:daily:end %%";

    const empty = renderMarkerBlock([], start, end, "en");
    assertEq(empty, `${start}\n${end}`, "empty events → bare markers");

    const oneEvent = renderMarkerBlock(
      [
        {
          timestamp: "2026-05-11T21:30:00Z",
          localTime: "21:30",
          action: "watched",
          display: "The Dark Knight (2008)",
        },
      ],
      start,
      end,
      "en",
    );
    assertTrue(
      oneEvent.includes("21:30 — watched The Dark Knight (2008)"),
      "single event line rendered",
    );
    assertTrue(oneEvent.startsWith(start), "block starts with start marker");
    assertTrue(oneEvent.endsWith(end), "block ends with end marker");
  }

  console.log("\n[49] daily-notes: verb localization (11 languages)");
  {
    assertEq(renderVerb("watched", "en"), "watched", "en watched");
    assertEq(renderVerb("watched", "zh-CN"), "看了", "zh-CN watched");
    assertEq(renderVerb("watched", "ja-JP"), "視聴", "ja-JP watched");
    assertEq(renderVerb("watched", "ko-KR"), "시청", "ko-KR watched");
    assertEq(renderVerb("watched", "fr-FR"), "a regardé", "fr-FR watched");
    assertEq(renderVerb("watched", "de-DE"), "hat angeschaut", "de-DE watched");
    assertEq(renderVerb("watched", "it-IT"), "ha visto", "it-IT watched");
    assertEq(renderVerb("watched", "es-ES"), "vio", "es-ES watched");
    assertEq(renderVerb("watched", "pt-BR"), "assistiu", "pt-BR watched");
    assertEq(renderVerb("watched", "ru-RU"), "посмотрел", "ru-RU watched");

    // Short codes alias to full locale
    assertEq(renderVerb("watched", "ja"), renderVerb("watched", "ja-JP"),
      "'ja' alias = 'ja-JP'");

    // Unsupported falls back to English
    assertEq(renderVerb("watched", "tr-TR"), "watched", "tr-TR fallback to EN");

    // Rated includes the rating value
    assertTrue(
      renderVerb("rated", "en", 9).endsWith("9/10"),
      `en rated 9 → ends with "9/10" (got: "${renderVerb("rated", "en", 9)}")`,
    );
    assertTrue(
      renderVerb("rated", "zh-CN", 8).endsWith("8/10"),
      "zh-CN rated 8 → ends with 8/10",
    );
  }

  console.log("\n[50] daily-notes: safety — replaceMarkerBlock preserves outside content");
  {
    const start = "%% trakt:daily:start %%";
    const end = "%% trakt:daily:end %%";
    const original =
      "# My day\n\n" +
      "Some thoughts about today.\n\n" +
      `${start}\n` +
      "old content\n" +
      `${end}\n\n` +
      "More thoughts after the block.\n";

    const replaced = replaceMarkerBlock(
      original,
      start,
      end,
      `${start}\nnew content\n${end}`,
    );

    assertTrue(replaced.includes("# My day"), "H1 preserved");
    assertTrue(
      replaced.includes("Some thoughts about today."),
      "content before block preserved",
    );
    assertTrue(
      replaced.includes("More thoughts after the block."),
      "content after block preserved",
    );
    assertTrue(replaced.includes("new content"), "block content updated");
    assertTrue(
      !replaced.includes("old content"),
      "old block content gone",
    );
  }

  console.log("\n[51] daily-notes: safety — appendMarkerBlock preserves existing content");
  {
    const start = "%% trakt:daily:start %%";
    const end = "%% trakt:daily:end %%";
    const original = "# My day\n\nSome thoughts.\n\n- a list item\n";
    const block = `${start}\n21:30 — watched X\n${end}`;

    const result = appendMarkerBlock(original, block);

    assertTrue(
      result.startsWith("# My day"),
      "original content preserved at start",
    );
    assertTrue(
      result.includes("Some thoughts."),
      "original body preserved",
    );
    assertTrue(
      result.includes("- a list item"),
      "original list preserved",
    );
    assertTrue(result.includes(block), "block appended");

    // Empty input → just the block
    const empty = appendMarkerBlock("", block);
    assertEq(empty, `${block}\n`, "empty input → just block");
  }

  console.log("\n[52] daily-notes: event aggregation by date + source flag gating");
  {
    const day = "2026-05-11";

    const item: NormalizedItem = {
      type: "show",
      title: "Breaking Bad",
      year: 2008,
      ids: { trakt: 100, slug: "breaking-bad", imdb: "tt0903747", tmdb: 1396 },
      overview: "",
      genres: [],
      runtime: 47,
      rating: 9.5,
      votes: 12000,
      certification: "TV-MA",
      country: "us",
      language: "en",
      status: "ended",
      originalTitle: "Breaking Bad",
      originalOverview: "",
      originalGenres: [],
      // detailed history — 2 episodes at same timestamp (batch scrobble)
      watch_history_episodes: [
        {
          season: 1,
          episode: 1,
          watched_at: ["2026-05-11T21:00:00Z"],
        },
        {
          season: 1,
          episode: 2,
          watched_at: ["2026-05-11T21:00:00Z"],
        },
      ],
      // also has watchlist + favorite + rating events on same day
      watchlist_added_at: "2026-05-11T10:00:00Z",
      favorited_at: "2026-05-11T11:00:00Z",
      rated_at: "2026-05-11T22:00:00Z",
      my_rating: 10,
    };

    const items = [item];

    // All sources on
    const allOn = aggregateEventsForDate(day, items, withSettings({
      syncWatchedDetail: true,
      syncWatchlist: true,
      syncFavorites: true,
      syncRatings: true,
    }));
    assertEq(allOn.length, 4, "with all sources: watch + watchlist + favorite + rated = 4 events");

    // Watch event should comma-merge S1E1 + S1E2 because same timestamp
    const watchEvent = allOn.find((e) => e.action === "watched");
    assertTrue(
      watchEvent !== undefined && watchEvent.display.includes("S1E1, S1E2"),
      "same-timestamp episodes comma-merged",
    );

    // Only watched detail on
    const onlyWatched = aggregateEventsForDate(day, items, withSettings({
      syncWatchedDetail: true,
      syncWatchlist: false,
      syncFavorites: false,
      syncRatings: false,
    }));
    assertEq(onlyWatched.length, 1, "with only watch: just the watch event");
    assertEq(onlyWatched[0].action, "watched", "it's the watched event");

    // Only watchlist on
    const onlyWatchlist = aggregateEventsForDate(day, items, withSettings({
      syncWatchedDetail: false,
      syncWatchlist: true,
      syncFavorites: false,
      syncRatings: false,
    }));
    assertEq(onlyWatchlist.length, 1, "with only watchlist: just the watchlist event");
    assertEq(onlyWatchlist[0].action, "added_to_watchlist", "it's the watchlist add");

    // All sources off
    const allOff = aggregateEventsForDate(day, items, withSettings({
      syncWatchedDetail: false,
      syncWatchlist: false,
      syncFavorites: false,
      syncRatings: false,
    }));
    assertEq(allOff.length, 0, "all sources off → no events");

    // Different date → no events for this day
    const otherDay = aggregateEventsForDate("2026-01-01", items, withSettings({
      syncWatchedDetail: true,
      syncWatchlist: true,
      syncFavorites: true,
      syncRatings: true,
    }));
    assertEq(otherDay.length, 0, "different date → no events");

    // Events sorted by timestamp ascending
    if (allOn.length === 4) {
      const timestamps = allOn.map((e) => e.timestamp);
      const sortedCopy = [...timestamps].sort();
      assertTrue(
        timestamps.every((t, i) => t === sortedCopy[i]),
        "events sorted by timestamp ascending",
      );
    }
  }

  // ── Tests 53-55: [0.7.1] post-PR-review hardening ────────────────────
  // After PR #12757 review, an audit surfaced three classes of issue:
  // (1) isMarkerRegionValid would accept identical start/end strings,
  //     enabling a content-mangling vulnerability if a user set both
  //     markers to e.g. "%%";
  // (2) computeDailyNotePath was untested despite being the file-system
  //     lookup primitive — regressions there could break sync silently;
  // (3) edge cases in aggregation / verbs / safety contract that warrant
  //     explicit coverage.

  console.log("\n[53] isMarkerRegionValid — reject empty / identical / inverted markers");
  {
    // Empty markers → invalid (a bug user could trigger by clearing field)
    assertTrue(
      !isMarkerRegionValid("some content", "", "%% end %%"),
      "empty start marker → invalid",
    );
    assertTrue(
      !isMarkerRegionValid("some content", "%% start %%", ""),
      "empty end marker → invalid",
    );
    assertTrue(
      !isMarkerRegionValid("some content", "", ""),
      "both empty → invalid",
    );

    // Identical strings → invalid (the content-mangling vulnerability)
    assertTrue(
      !isMarkerRegionValid("%% foo %%\nbar\n%% foo %%", "%% foo %%", "%% foo %%"),
      "identical start/end strings → invalid (prevents content-mangling)",
    );
    assertTrue(
      !isMarkerRegionValid("%%\nbar\n%%", "%%", "%%"),
      "identical short markers → invalid",
    );

    // Still passes with distinct markers
    assertTrue(
      isMarkerRegionValid(
        "%% trakt:daily:start %%\nfoo\n%% trakt:daily:end %%",
        "%% trakt:daily:start %%",
        "%% trakt:daily:end %%",
      ),
      "distinct markers still accepted",
    );
  }

  console.log("\n[54] computeDailyNotePath — folder + format combinations");
  {
    // Mock minimal moment: returns object with format(out) using simple template
    // expansion. We don't need full moment; just enough to drive the tests.
    const mockMoment = (input: string, _fmt: string) => {
      // input is "YYYY-MM-DD" from the caller; parse manually
      const [y, m, d] = input.split("-");
      return {
        format(out: string): string {
          return out
            .replace(/YYYY/g, y)
            .replace(/MM/g, m)
            .replace(/DD/g, d);
        },
      };
    };

    assertEq(
      computeDailyNotePath("2026-05-11", "Daily", "YYYY-MM-DD", mockMoment),
      "Daily/2026-05-11.md",
      "simple folder + format",
    );
    assertEq(
      computeDailyNotePath(
        "2026-05-11",
        "01 Daily",
        "YYYY/YYYY.MM.DD",
        mockMoment,
      ),
      "01 Daily/2026/2026.05.11.md",
      "nested folder format",
    );
    assertEq(
      computeDailyNotePath("2026-05-11", "", "YYYY-MM-DD", mockMoment),
      "2026-05-11.md",
      "empty folder → root of vault",
    );
    assertEq(
      computeDailyNotePath("2026-05-11", "/Daily/", "YYYY-MM-DD", mockMoment),
      "Daily/2026-05-11.md",
      "leading/trailing slashes stripped",
    );
    assertEq(
      computeDailyNotePath(
        "2026-12-31",
        "journal",
        "YYYY-MM-DD",
        mockMoment,
      ),
      "journal/2026-12-31.md",
      "end-of-year date",
    );
  }

  console.log("\n[55] daily-notes: regression tests for audit findings");
  {
    // Audit concern: replaceMarkerBlock with marker string that appears
    // INSIDE the new block content. The block we pass in already includes
    // markers — replaceMarkerBlock just splices in the whole thing.
    const start = "%% trakt:daily:start %%";
    const end = "%% trakt:daily:end %%";

    const original = `${start}\nold\n${end}`;
    const newBlock = `${start}\nnew content with ${start} inside (weird but valid)\n${end}`;
    const result = replaceMarkerBlock(original, start, end, newBlock);
    assertEq(
      result,
      newBlock,
      "replaceMarkerBlock splices new content verbatim — markers inside content are user's problem, not ours",
    );

    // Audit concern: aggregateEventsForDate with undefined watch_history_*
    // (could be undefined for new items or items with no detail history).
    const itemNoHistory: NormalizedItem = {
      type: "show",
      title: "X",
      year: 2024,
      ids: { trakt: 1, slug: "x", imdb: "tt1", tmdb: 1 },
      overview: "",
      genres: [],
      runtime: 0,
      rating: 0,
      votes: 0,
      certification: "",
      country: "",
      language: "",
      status: "",
      originalTitle: "X",
      originalOverview: "",
      originalGenres: [],
      // No watch_history_episodes / watch_history_movie
    };
    const events = aggregateEventsForDate(
      "2026-05-11",
      [itemNoHistory],
      withSettings({
        syncWatchedDetail: true,
        syncWatchlist: true,
        syncFavorites: true,
        syncRatings: true,
      }),
    );
    assertEq(events.length, 0, "item with no history fields → 0 events (no crash)");

    // Audit concern: verb resolution case-sensitivity
    assertEq(
      renderVerb("watched", "JA-JP"),
      renderVerb("watched", "ja-JP"),
      "upper-case locale resolves same as lower-case (case-insensitive)",
    );
  }

  // ── Test 56b: [0.7.3] all Notice strings carry "Sync Trakt:" prefix ──
  // Locks in the unified-prefix invariant. Each Notice the user sees as a
  // popup must identify the plugin — without it, the user can't tell which
  // plugin spoke (Obsidian doesn't badge the Notice with the plugin name).
  // Skip a few entries that are intentionally not popup Notices (inline
  // status labels, embedded error reasons, translated suffixes).

  console.log("\n[56b] every popup Notice string starts with 'Sync Trakt:'");
  {
    const noticeKeys = [
      "notice.notConnected",
      "notice.needCredentials",
      "notice.alreadySyncing",
      "notice.migratedFromLegacyFolder",
      "notice.syncComplete",
      "notice.syncFailed",
      "auth.connection.disconnectedNotice",
      "auth.connection.needCredentialsNotice",
      "authModal.codeCopied",
      "authModal.success",
      "tmdb.cache.clear.notice",
      "history.state.clear.notice",
      "syncMaintenance.dedupe.done",
      "reset.notice",
      "daily.backfill.done",
      "daily.catchUpDone.todayOnly",
      "daily.catchUpDone.withPast",
      "daily.catchUpDone.pastOnly",
      "daily.today.updated",
      "daily.today.noFile",
      "daily.today.unchanged",
      "daily.disabled",
    ] as const;
    for (const k of noticeKeys) {
      const enMsg = t(k, "en");
      const zhMsg = t(k, "zh-CN");
      assertTrue(
        enMsg.startsWith("Sync Trakt:"),
        `en '${k}' starts with 'Sync Trakt:' (got: ${enMsg.slice(0, 30)}…)`,
      );
      assertTrue(
        zhMsg.startsWith("Sync Trakt"),
        `zh-CN '${k}' starts with 'Sync Trakt' (got: ${zhMsg.slice(0, 30)}…)`,
      );
    }
  }

  console.log("\n[56c] destructive-action confirmation strings — EN + zh-CN");
  {
    const confirmKeys = [
      "confirm.cancel",
      "confirm.disconnect.title",
      "confirm.disconnect.body",
      "confirm.disconnect.confirm",
      "confirm.clearTmdb.title",
      "confirm.clearTmdb.body",
      "confirm.clearTmdb.confirm",
      "confirm.clearHistory.title",
      "confirm.clearHistory.body",
      "confirm.clearHistory.confirm",
      "confirm.dedupe.title",
      "confirm.dedupe.body",
      "confirm.dedupe.confirm",
      "confirm.reset.title",
      "confirm.reset.body",
      "confirm.reset.confirm",
    ] as const;
    for (const k of confirmKeys) {
      const enMsg = t(k, "en");
      const zhMsg = t(k, "zh-CN");
      assertTrue(
        enMsg.length > 0 && !enMsg.startsWith("confirm."),
        `en '${k}' resolves`,
      );
      assertTrue(
        zhMsg.length > 0 && !zhMsg.startsWith("confirm."),
        `zh-CN '${k}' resolves`,
      );
      assertTrue(enMsg !== zhMsg, `'${k}': en and zh-CN actually differ`);
    }
  }

  // ── Test 56: [0.7.2] empty marker pair detection ────────────────────
  // Bug: a Daily Note template that pre-injects `%% start %%\n%% end %%`
  // into freshly created past-day notes would short-circuit past-day
  // backfill — the "hasMarkers" guard treated the empty pair as already
  // filled. isMarkerRegionEmpty lets the past branch distinguish the
  // empty-template case (fill) from real user content (preserve).

  console.log("\n[56] isMarkerRegionEmpty — distinguish empty from filled regions");
  {
    const start = "%% trakt:daily:start %%";
    const end = "%% trakt:daily:end %%";

    // True: empty inner region (just whitespace/newlines)
    assertTrue(
      isMarkerRegionEmpty(`${start}\n${end}`, start, end),
      "newline-only between markers → empty",
    );
    assertTrue(
      isMarkerRegionEmpty(`${start}${end}`, start, end),
      "no characters between markers → empty",
    );
    assertTrue(
      isMarkerRegionEmpty(`${start}\n  \n\t\n${end}`, start, end),
      "whitespace-only between markers → empty",
    );
    assertTrue(
      isMarkerRegionEmpty(
        `# Heading\n\n${start}\n${end}\n\nMore content`,
        start,
        end,
      ),
      "empty pair surrounded by other content → still empty",
    );

    // False: real content between markers
    assertTrue(
      !isMarkerRegionEmpty(`${start}\nfoo\n${end}`, start, end),
      "non-whitespace content → not empty",
    );
    assertTrue(
      !isMarkerRegionEmpty(`${start}\n10:00 — watched X\n${end}`, start, end),
      "real event line → not empty",
    );

    // False: missing markers (caller can't fill what doesn't exist)
    assertTrue(
      !isMarkerRegionEmpty("no markers here", start, end),
      "no markers → not empty (signals 'nothing to fill in place')",
    );
    assertTrue(
      !isMarkerRegionEmpty(`only ${start} no end`, start, end),
      "missing end marker → not empty (treat as no region)",
    );
  }

  // ── Test 57: [0.8.0] incremental merge algorithm ─────────────────────
  // Locks in the seven scenarios documented in the settings-tab table.
  // The new function MUST preserve user content byte-for-byte while
  // appending newly-arrived events.

  console.log("\n[57] mergeMarkerBlockIncremental — append-only semantics");
  {
    const start = "%% trakt:daily:start %%";
    const end = "%% trakt:daily:end %%";

    // Scenario 1: no user edits, new event appears
    {
      const existing = `before\n${start}\n10:00 — watched X S1E1\n${end}\nafter`;
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "10:00 — watched X S1E1",
        "14:00 — watched X S1E2",
      ]);
      assertEq(
        result,
        `before\n${start}\n10:00 — watched X S1E1\n14:00 — watched X S1E2\n${end}\nafter`,
        "appends only new line; existing event preserved exactly once",
      );
    }

    // Scenario 2: user appended thoughts to a rendered line (prefix match)
    {
      const existing = `${start}\n10:00 — watched X S1E1 ← great episode!\n${end}`;
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "10:00 — watched X S1E1",
        "14:00 — watched X S1E2",
      ]);
      assertEq(
        result,
        `${start}\n10:00 — watched X S1E1 ← great episode!\n14:00 — watched X S1E2\n${end}`,
        "user-appended text preserved; new event added below",
      );
    }

    // Scenario 3: user inserted a custom line in the middle
    {
      const existing = `${start}\n10:00 — watched X S1E1\nMY OWN NOTE\n14:00 — watched X S1E2\n${end}`;
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "10:00 — watched X S1E1",
        "14:00 — watched X S1E2",
        "21:30 — rated 9/10 Y",
      ]);
      assertEq(
        result,
        `${start}\n10:00 — watched X S1E1\nMY OWN NOTE\n14:00 — watched X S1E2\n21:30 — rated 9/10 Y\n${end}`,
        "custom mid-block line preserved; new event appended at end",
      );
    }

    // Scenario 4: nothing new to add → content byte-identical (critical
    // for diff-based write layer to not touch the file)
    {
      const existing = `${start}\n10:00 — watched X S1E1\n${end}`;
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "10:00 — watched X S1E1",
      ]);
      assertEq(
        result,
        existing,
        "no new lines → returned content is byte-identical to input",
      );
    }

    // Scenario 5: empty marker region (e.g. injected by Daily Note
    // template) gets filled correctly
    {
      const existing = `before\n${start}\n${end}\nafter`;
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "10:00 — watched X S1E1",
      ]);
      assertEq(
        result,
        `before\n${start}\n10:00 — watched X S1E1\n${end}\nafter`,
        "empty marker region filled with new event",
      );
    }

    // Scenario 6: language switch — old language stays, new line added
    {
      const existing = `${start}\n10:00 — 看了 X S1E1\n${end}`;
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "10:00 — watched X S1E1",
      ]);
      assertEq(
        result,
        `${start}\n10:00 — 看了 X S1E1\n10:00 — watched X S1E1\n${end}`,
        "language switch: old zh-CN line stays, new en line appended",
      );
    }

    // Scenario 7: rating change on Trakt — both versions coexist
    {
      const existing = `${start}\n21:30 — rated 8/10 X\n${end}`;
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "21:30 — rated 10/10 X",
      ]);
      assertEq(
        result,
        `${start}\n21:30 — rated 8/10 X\n21:30 — rated 10/10 X\n${end}`,
        "rating change: both old + new ratings present (documented trade-off)",
      );
    }

    // Scenario 8: user deleted a previously rendered line — it gets
    // re-added at the END (not at original position)
    {
      // User had S1E1 + S1E2, deleted S1E1
      const existing = `${start}\n14:00 — watched X S1E2\n${end}`;
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "10:00 — watched X S1E1",
        "14:00 — watched X S1E2",
      ]);
      assertEq(
        result,
        `${start}\n14:00 — watched X S1E2\n10:00 — watched X S1E1\n${end}`,
        "user-deleted line re-appears at end on next sync (documented limit)",
      );
    }

    // Scenario 9: defensive — no markers at all → returned unchanged
    {
      const existing = "no markers here at all";
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "10:00 — watched X S1E1",
      ]);
      assertEq(
        result,
        existing,
        "missing markers → content returned unchanged (defensive)",
      );
    }

    // Scenario 10: identical start/end markers → rejected by validity
    // check, returned unchanged. Reuses the same safety net as
    // replaceMarkerBlock.
    {
      const sameMarker = "%%";
      const existing = `${sameMarker}\nfoo\n${sameMarker}`;
      const result = mergeMarkerBlockIncremental(
        existing,
        sameMarker,
        sameMarker,
        ["new line"],
      );
      assertEq(
        result,
        existing,
        "identical start/end → content returned unchanged",
      );
    }

    // Scenario 11: content OUTSIDE the marker region must be byte-for-byte
    // preserved (the spec 0006 safety contract).
    {
      const before = "# My Day\n\nLots of stuff I wrote\n\n";
      const after = "\n\n## Tomorrow\n- buy milk";
      const existing = `${before}${start}\n${end}${after}`;
      const result = mergeMarkerBlockIncremental(existing, start, end, [
        "10:00 — watched X",
      ]);
      assertTrue(
        result.startsWith(before),
        "content before marker region preserved verbatim",
      );
      assertTrue(
        result.endsWith(after),
        "content after marker region preserved verbatim",
      );
    }
  }

  console.log("\n[57b] processDate — unchanged today does not rewrite file");
  {
    const stub = await import("./stub-obsidian");
    const mockMoment = (input: string, _fmt: string) => {
      const [y, m, d] = input.split("-");
      return {
        format(out: string): string {
          return out
            .replace(/YYYY/g, y)
            .replace(/MM/g, m)
            .replace(/DD/g, d);
        },
      };
    };
    (globalThis as unknown as { window: unknown }).window = { moment: mockMoment };

    const date = "2026-05-11";
    const item: NormalizedItem = {
      type: "movie",
      title: "Inception",
      year: 2010,
      ids: { trakt: 1, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 },
      overview: "",
      genres: [],
      runtime: 148,
      rating: 8.8,
      votes: 1000,
      certification: "PG-13",
      country: "us",
      language: "en",
      status: "released",
      originalTitle: "Inception",
      originalOverview: "",
      originalGenres: [],
      watch_history_movie: ["2026-05-11T21:00:00Z"],
    };
    const settings = withSettings({
      dailyNotesFolder: "",
      dailyNotesFilenameFormat: "YYYY-MM-DD",
      dailyNotesSyncMode: "default",
      templateLanguage: "en",
      syncWatchedDetail: true,
      syncWatchlist: false,
      syncFavorites: false,
      syncRatings: false,
    });
    let content = renderMarkerBlock(
      aggregateEventsForDate(date, [item], settings),
      settings.dailyNotesMarkerStart,
      settings.dailyNotesMarkerEnd,
      "en",
    );
    let processCalls = 0;
    const file = new stub.TFile();
    file.path = "2026-05-11.md";
    const app = new stub.App() as unknown as {
      vault: {
        getAbstractFileByPath: (path: string) => unknown;
        read: () => Promise<string>;
        process: (_file: unknown, cb: (old: string) => string) => Promise<void>;
      };
    };
    app.vault = {
      getAbstractFileByPath: (path: string) => (path === file.path ? file : null),
      read: async () => content,
      process: async (_file, cb) => {
        processCalls++;
        content = cb(content);
      },
    };

    const result = await processDate(
      {
        app: app as never,
        settings,
        saveSettings: async () => undefined,
        getMergedItems: () => [item],
      },
      date,
      "today",
    );
    assertEq(result.status, "unchanged", "identical today block reports unchanged");
    assertEq(processCalls, 0, "unchanged today block does not call vault.process");
  }

  // ── Test 58: [0.9.0 / spec 0008] strict primary + fallback ───────────
  // The previous test [5] covers the legacy loose-match path. This block
  // locks in the new strict semantics: setting a fallback language flips
  // pickTraktTranslation into strict-on-both mode, where zh-CN must be
  // exactly zh-CN (zh-TW won't substitute) and unfindable entries
  // advance through the fallback chain to English original (= null).

  console.log("\n[58] pickTraktTranslation — strict primary + fallback");
  {
    const translations: TraktTranslation[] = [
      { language: "zh", country: "tw", title: "黑暗騎士", overview: "" },
      { language: "zh", country: "cn", title: "黑暗骑士", overview: "..." },
      { language: "en", country: "us", title: "The Dark Knight", overview: "..." },
      { language: "ja", country: "jp", title: "ダークナイト", overview: "..." },
    ];

    // Strict zh-CN with en fallback — both available, primary wins
    assertEq(
      pickTraktTranslation(translations, "zh-CN", "en")?.title,
      "黑暗骑士",
      "strict zh-CN matches exactly when present",
    );

    // Strict zh-CN, no zh-CN entry — falls back to en (NOT zh-TW)
    const onlyTwAndEn: TraktTranslation[] = [
      { language: "zh", country: "tw", title: "黑暗騎士", overview: "" },
      { language: "en", country: "us", title: "The Dark Knight", overview: "..." },
    ];
    assertEq(
      pickTraktTranslation(onlyTwAndEn, "zh-CN", "en")?.title,
      "The Dark Knight",
      "strict zh-CN misses → falls back to en (does NOT substitute zh-TW)",
    );

    // Strict zh-CN with en fallback, neither present — returns null
    const onlyJa: TraktTranslation[] = [
      { language: "ja", country: "jp", title: "ダークナイト", overview: "..." },
    ];
    assertEq(
      pickTraktTranslation(onlyJa, "zh-CN", "en"),
      null,
      "both primary and fallback miss → null (caller keeps English original)",
    );

    // Strict primary same as fallback — degenerate but safe (no double-walk)
    assertEq(
      pickTraktTranslation(translations, "en", "en")?.title,
      "The Dark Knight",
      "primary=fallback=en still resolves",
    );

    // Backward compat: no fallback param → loose match preserved
    assertEq(
      pickTraktTranslation(onlyTwAndEn, "zh-CN")?.title,
      "黑暗騎士",
      "without fallback param: loose match (zh-CN finds zh-TW) — pre-0.9.0 behaviour",
    );

    // Language-only primary code (no country part) — strict still works
    assertEq(
      pickTraktTranslation(translations, "ja", "en")?.title,
      "ダークナイト",
      "strict language-only code matches any country tagged that language",
    );

    // Strict mode handles empty translations array gracefully
    assertEq(
      pickTraktTranslation([], "zh-CN", "en"),
      null,
      "empty input still returns null in strict mode",
    );
  }

  // ── Test 59: [0.9.0 / spec 0008] tmdbCacheKey backward compat ────────
  // Critical for upgraders: when fallback is "" (the default), cache keys
  // must match the pre-0.9.0 format byte-for-byte so existing entries
  // remain valid. When fallback is set, keys are scoped separately so the
  // strict-mode picker's different output doesn't pollute loose-mode hits.

  console.log("\n[59] tmdbCacheKey — fallback-aware key partitioning");
  {
    // Pre-0.9.0 callers used the 3-arg form; verify the default 4th arg
    // produces the same string.
    assertEq(
      tmdbCacheKey("movie", 155, "zh-CN"),
      "movie:155:zh-CN",
      "no fallback → pre-0.9.0 key format preserved",
    );
    assertEq(
      tmdbCacheKey("movie", 155, "zh-CN", ""),
      "movie:155:zh-CN",
      "explicit empty fallback → same key as omitted",
    );
    // Setting fallback yields a different namespace
    assertEq(
      tmdbCacheKey("movie", 155, "zh-CN", "en"),
      "movie:155:zh-CN:fb=en",
      "fallback set → distinct cache namespace",
    );
    // Different fallback values produce different keys (independence)
    assertTrue(
      tmdbCacheKey("movie", 155, "zh-CN", "en") !==
        tmdbCacheKey("movie", 155, "zh-CN", "ja"),
      "different fallbacks → different keys",
    );
    // Empty primary still works (localization disabled)
    assertEq(
      tmdbCacheKey("movie", 155, ""),
      "movie:155:default",
      "empty primary collapses to 'default' (pre-0.9.0)",
    );
  }

  // ── Test 60: [0.9.0 / spec 0008] pickBestTranslation strict TMDB ─────
  // Mirrors test 58 but for the TMDB path's translation array. Confirms
  // the strict picker:
  //   1. requires lang+country exact when the request has a country
  //   2. falls back to fallbackLanguage on primary miss
  //   3. returns null when both miss (caller keeps the original)

  console.log("\n[60] pickBestTranslation — strict TMDB mode");
  {
    const data: TmdbMovieResponse = {
      title: "The Dark Knight",
      original_title: "The Dark Knight",
      overview: "An English overview",
      tagline: "Why so serious?",
      genres: [{ id: 1, name: "Action" }, { id: 2, name: "Drama" }],
      translations: {
        translations: [
          {
            iso_639_1: "zh",
            iso_3166_1: "TW",
            data: { title: "黑暗騎士", overview: "繁體版簡介", tagline: "" },
          },
          {
            iso_639_1: "zh",
            iso_3166_1: "CN",
            data: { title: "黑暗骑士", overview: "简体版简介", tagline: "" },
          },
          {
            iso_639_1: "en",
            iso_3166_1: "US",
            data: { title: "The Dark Knight", overview: "An English overview", tagline: "Why so serious?" },
          },
        ],
      },
    };

    // Strict zh-CN with en fallback — primary present
    const cnStrict = pickBestTranslation(data, "zh-CN", "movie", "en");
    assertEq(cnStrict?.title, "黑暗骑士", "TMDB strict zh-CN: exact match");
    assertEq(cnStrict?.overview, "简体版简介", "TMDB strict zh-CN: overview from CN entry");
    // Genres pass through from the top-level (TMDB returns them in the
    // requested locale at the data root, not per-translation).
    assertEq(cnStrict?.genres.length, 2, "TMDB strict: genres carry through");

    // Strict zh-CN where ONLY zh-TW exists — falls back to en, NOT zh-TW
    const dataNoCN: TmdbMovieResponse = {
      ...data,
      translations: {
        translations: data.translations!.translations.filter(
          (t) => !(t.iso_639_1 === "zh" && t.iso_3166_1 === "CN"),
        ),
      },
    };
    const fbResult = pickBestTranslation(dataNoCN, "zh-CN", "movie", "en");
    assertEq(
      fbResult?.title,
      "The Dark Knight",
      "TMDB strict zh-CN miss → en fallback (NOT zh-TW)",
    );

    const dataNoCNTopLevelTw: TmdbMovieResponse = {
      ...dataNoCN,
      title: "黑暗騎士",
    };
    const topLevelTwFallback = pickBestTranslation(
      dataNoCNTopLevelTw,
      "zh-CN",
      "movie",
      "en",
    );
    assertEq(
      topLevelTwFallback?.title,
      "The Dark Knight",
      "TMDB strict zh-CN miss ignores TMDB top-level zh-TW fallback",
    );

    // Both primary and fallback miss → null
    const dataOnlyTw: TmdbMovieResponse = {
      ...data,
      translations: {
        translations: data.translations!.translations.filter(
          (t) => t.iso_639_1 === "zh" && t.iso_3166_1 === "TW",
        ),
      },
    };
    assertEq(
      pickBestTranslation(dataOnlyTw, "zh-CN", "movie", "en"),
      null,
      "TMDB strict: both primary and fallback absent → null",
    );

    // Backward compat: no fallback param → loose match preserved (test [7]
    // covers the loose case in depth; this just confirms we don't break it)
    const cnLoose = pickBestTranslation(dataNoCN, "zh-CN", "movie");
    assertTrue(
      cnLoose?.title === "黑暗騎士" || cnLoose?.title === "The Dark Knight",
      "TMDB loose mode: still picks a non-null variant (zh-TW via family fallback)",
    );
  }

  // ── Test 60b: strict TMDB keeps original-language title when title blank ─
  console.log(
    "\n[60b] pickBestTranslation — strict TMDB keeps original-language TV titles",
  );
  {
    const makeOriginalLanguageTv = (
      title: string,
      originalLanguage: string,
      exactCountry: string,
      overview: string,
    ): TmdbMovieResponse => ({
      poster_path: "/localized.jpg",
      original_name: title,
      name: title,
      original_language: originalLanguage,
      overview,
      genres: [{ id: 18, name: "Drama" }],
      translations: {
        translations: [
          {
            iso_639_1: originalLanguage,
            iso_3166_1: exactCountry,
            data: {
              name: "",
              overview,
              tagline: "",
            },
          },
          {
            iso_639_1: "en",
            iso_3166_1: "US",
            data: {
              name: "English Fallback Title",
              overview: "An English overview",
              tagline: "",
            },
          },
        ],
      },
    });

    const cnStrict = pickBestTranslation(
      makeOriginalLanguageTv(
        "钢铁森林",
        "zh",
        "CN",
        "海州市通河岸边，五年前“8·17”大案的全新线索浮出水面。",
      ),
      "zh-CN",
      "tv",
      "en",
    );
    assertEq(
      cnStrict?.title,
      "钢铁森林",
      "strict zh-CN uses top-level original-language title when exact title is blank",
    );
    assertEq(
      cnStrict?.overview,
      "海州市通河岸边，五年前“8·17”大案的全新线索浮出水面。",
      "strict zh-CN keeps exact CN overview",
    );

    const twStrict = pickBestTranslation(
      makeOriginalLanguageTv(
        "鋼鐵森林",
        "zh",
        "TW",
        "故事以海州市通河岸邊的一起無名女屍案開篇。",
      ),
      "zh-TW",
      "tv",
      "en",
    );
    assertEq(
      twStrict?.title,
      "鋼鐵森林",
      "strict zh-TW uses top-level original-language title when exact title is blank",
    );

    const twRejectsSimplifiedOriginal = pickBestTranslation(
      makeOriginalLanguageTv(
        "钢铁森林",
        "zh",
        "TW",
        "故事以海州市通河岸邊的一起無名女屍案開篇。",
      ),
      "zh-TW",
      "tv",
      "en",
    );
    assertEq(
      twRejectsSimplifiedOriginal?.title,
      "",
      "strict zh-TW does not treat a Simplified Chinese original title as Traditional Chinese",
    );

    const cnRejectsTraditionalOriginal = pickBestTranslation(
      makeOriginalLanguageTv(
        "鋼鐵森林",
        "zh",
        "CN",
        "海州市通河岸边，五年前“8·17”大案的全新线索浮出水面。",
      ),
      "zh-CN",
      "tv",
      "en",
    );
    assertEq(
      cnRejectsTraditionalOriginal?.title,
      "",
      "strict zh-CN does not treat a Traditional Chinese original title as Simplified Chinese",
    );

    const jaStrict = pickBestTranslation(
      makeOriginalLanguageTv(
        "孤独のグルメ",
        "ja",
        "JP",
        "井之頭五郎が食事処を巡る。",
      ),
      "ja-JP",
      "tv",
      "en",
    );
    assertEq(
      jaStrict?.title,
      "孤独のグルメ",
      "strict ja-JP uses top-level original-language title when exact title is blank",
    );

    const koTopLevelOnly = pickBestTranslation(
      {
        poster_path: "/ko.jpg",
        original_name: "오징어 게임",
        name: "오징어 게임",
        original_language: "ko",
        overview: "456명의 참가자가 생존 게임에 도전한다.",
        translations: {
          translations: [
            {
              iso_639_1: "en",
              iso_3166_1: "US",
              data: {
                name: "Squid Game",
                overview: "An English overview",
                tagline: "",
              },
            },
          ],
        },
      },
      "ko-KR",
      "tv",
      "en",
    );
    assertEq(
      koTopLevelOnly?.title,
      "오징어 게임",
      "strict ko-KR uses top-level original-language title even without a matching translation row",
    );

    const missingPrimary = pickBestTranslation(
      {
        poster_path: "/some.jpg",
        original_name: "Some English Show",
        name: "Some English Show",
        original_language: "en",
        translations: {
          translations: [
            {
              iso_639_1: "en",
              iso_3166_1: "US",
              data: { name: "Some English Show", overview: "", tagline: "" },
            },
          ],
        },
      },
      "zh-CN",
      "tv",
      "en",
    );
    assertEq(
      missingPrimary?.title,
      "Some English Show",
      "strict zh-CN still falls back to configured fallback when requested language is unavailable",
    );

    const missingPrimaryWithNonRequestedTopLevel = pickBestTranslation(
      {
        poster_path: "/ko.jpg",
        original_name: "오징어 게임",
        name: "Squid Game",
        original_language: "ko",
        translations: {
          translations: [
            {
              iso_639_1: "ja",
              iso_3166_1: "JP",
              data: {
                name: "イカゲーム",
                overview: "日本語の概要",
                tagline: "",
              },
            },
          ],
        },
      },
      "zh-CN",
      "tv",
      "ja-JP",
    );
    assertEq(
      missingPrimaryWithNonRequestedTopLevel?.title,
      "イカゲーム",
      "strict mode ignores non-requested top-level title before trying fallback",
    );
  }

  // ── Test 61: [1.0.0 / spec 0009] disambiguatedFilename self-exclusion ─
  // The rename-time closure passed to disambiguatedFilename must treat the
  // file being renamed as NOT-a-collision (otherwise the disambiguator
  // would tier up against itself, turning every rename into a tier-1 or
  // tier-2 mangled filename even when the natural name is already free).
  //
  // We can't call maybeRenameExistingFile() directly here (needs App +
  // vault). But the helper's correctness hinges entirely on the closure's
  // behaviour, which we CAN test by passing a closure that mirrors what
  // maybeRenameExistingFile builds.

  console.log("\n[61] disambiguatedFilename — self-exclusion closure");
  {
    const item: NormalizedItem = {
      ...makeMovie(),
      title: "重生",
      originalTitle: "Born Again",
      ids: { trakt: 157810, slug: "born-again", imdb: "tt12015636", tmdb: 100857 },
      year: 2020,
    };

    // The file being renamed currently lives at "重生 (2020).md". When we
    // recompute the desired name, the tier-0 candidate is also "重生
    // (2020)". Without self-exclusion the closure would say "taken!" and
    // we'd uselessly bump to tier 1. With self-exclusion the closure
    // returns false for that path → tier 0 wins → no rename happens.
    const currentPath = "Trakt/重生 (2020).md";
    const isTakenWithSelfExclusion = (candidate: string): boolean => {
      const candidatePath = `Trakt/${candidate}.md`;
      if (candidatePath === currentPath) return false; // self-exclusion
      return false; // no other files
    };
    const result = disambiguatedFilename(
      item,
      "{{title}} ({{year}})",
      isTakenWithSelfExclusion,
    );
    assertEq(
      result.filename,
      "重生 (2020)",
      "self-exclusion: natural tier-0 name wins when the only 'collision' is the file itself",
    );
    assertEq(result.tier, 0, "self-exclusion: tier === 0 (no false bump)");

    // Real collision case: the file being renamed currently lives under
    // a different name (e.g. it was previously a tier-1 disambiguated
    // name), and the desired tier-0 name is occupied by ANOTHER file.
    // Self-exclusion should NOT shield against this — disambiguator must
    // tier up.
    const currentPathTier1 = "Trakt/重生 (Born Again) (2020).md";
    const isTakenWithRealCollision = (candidate: string): boolean => {
      const candidatePath = `Trakt/${candidate}.md`;
      if (candidatePath === currentPathTier1) return false; // self-exclusion
      // Some OTHER file occupies the tier-0 name
      return candidate === "重生 (2020)";
    };
    const result2 = disambiguatedFilename(
      item,
      "{{title}} ({{year}})",
      isTakenWithRealCollision,
    );
    assertEq(
      result2.filename,
      "重生 (Born Again) (2020)",
      "self-exclusion still respects real collisions: tier-1 fallback",
    );
    assertEq(result2.tier, 1, "self-exclusion: tier === 1 when other file genuinely collides");
  }

  // ── Test 61b: collision identity lookup prevents same-ID duplicates ─
  // The sync engine keeps one folder index, but on a second device Obsidian
  // Sync can still download an existing note after that snapshot. If the
  // create path sees a filename collision, it must inspect the collided
  // file's frontmatter before creating, otherwise it creates
  // "Title [trakt_id] (year).md" beside the original.

  console.log("\n[61b] findMatchingIdentityFile — checks collided files only");
  {
    const stub = await import("./stub-obsidian");
    const plain = new stub.TFile() as InstanceType<typeof stub.TFile> & {
      basename: string;
    };
    plain.path = "Trakt/Shrinking (2023).md";
    plain.name = "Shrinking (2023).md";
    plain.basename = "Shrinking (2023)";
    plain.extension = "md";

    const bracketed = new stub.TFile() as InstanceType<typeof stub.TFile> & {
      basename: string;
    };
    bracketed.path = "Trakt/Shrinking [189764] (2023).md";
    bracketed.name = "Shrinking [189764] (2023).md";
    bracketed.basename = "Shrinking [189764] (2023)";
    bracketed.extension = "md";

    const reads: string[] = [];
    const app = new stub.App() as unknown as {
      vault: {
        cachedRead: (file: InstanceType<typeof stub.TFile>) => Promise<string>;
      };
    };
    app.vault = {
      cachedRead: async (file) => {
        reads.push(file.path);
        return "---\ntrakt_type: show\ntrakt_id: 189764\n---\n";
      },
    };

    const found = await findMatchingIdentityFile(
      app as never,
      "trakt_",
      "show",
      189764,
      [bracketed, plain],
    );

    assertEq(
      found?.path,
      plain.path,
      "collision identity lookup picks the original path over the bracketed duplicate",
    );
    assertEq(
      reads.sort(),
      [bracketed.path, plain.path].sort(),
      "collision identity lookup reads only the collided candidate files",
    );
  }

  // ── Test 61c: dedupeDuplicateNotes respects identity + current template ─
  // Dedupe is a local maintenance action. It must group by trakt_type +
  // trakt_id, not by title, and it must choose the kept file according to the
  // user's CURRENT filename template instead of hardcoding the default
  // "{{title}} ({{year}})" convention.

  console.log("\n[61c] dedupeDuplicateNotes — identity groups + dynamic template");
  {
    const stub = await import("./stub-obsidian");

    const makeFile = (filePath: string) => {
      const file = new stub.TFile() as InstanceType<typeof stub.TFile> & {
        basename: string;
      };
      file.path = filePath;
      file.name = filePath.split("/").pop() ?? filePath;
      file.basename = file.name.replace(/\.md$/, "");
      file.extension = "md";
      return file;
    };

    const makeApp = (
      files: Array<InstanceType<typeof stub.TFile>>,
      contents: Record<string, string>,
    ) => {
      const folder = new stub.TFolder();
      folder.path = "Trakt";
      folder.children = [...files];
      const byPath = new Map<string, unknown>(
        files.map((file) => [file.path, file]),
      );
      const trashed: string[] = [];
      const renamed: string[] = [];
      const app = new stub.App() as unknown as {
        vault: {
          getAbstractFileByPath: (path: string) => unknown;
          cachedRead: (file: InstanceType<typeof stub.TFile>) => Promise<string>;
        };
        fileManager: {
          trashFile: (file: InstanceType<typeof stub.TFile>) => Promise<void>;
          renameFile: (
            file: InstanceType<typeof stub.TFile>,
            newPath: string,
          ) => Promise<void>;
        };
      };
      app.vault = {
        getAbstractFileByPath: (lookupPath) =>
          lookupPath === "Trakt" ? folder : byPath.get(lookupPath) ?? null,
        cachedRead: async (file) => contents[file.path] ?? "",
      };
      app.fileManager = {
        trashFile: async (file) => {
          trashed.push(file.path);
          byPath.delete(file.path);
          folder.children = folder.children.filter((child) => child !== file);
        },
        renameFile: async (file, newPath) => {
          renamed.push(`${file.path} -> ${newPath}`);
          byPath.delete(file.path);
          file.path = newPath;
          file.name = newPath.split("/").pop() ?? newPath;
          (file as typeof file & { basename: string }).basename =
            file.name.replace(/\.md$/, "");
          byPath.set(file.path, file);
        },
      };
      return { app, trashed, renamed };
    };

    const fm = (
      type: "movie" | "show",
      id: number,
      title: string,
      year: number,
      syncedAt: string,
    ) =>
      `---\ntrakt_type: ${type}\ntrakt_id: ${id}\ntrakt_title: ${title}\ntrakt_original_title: ${title}\ntrakt_year: ${year}\ntrakt_synced_at: "${syncedAt}"\n---\n`;

    const plain = makeFile("Trakt/Shrinking (2023).md");
    const bracketed = makeFile("Trakt/Shrinking [189764] (2023).md");
    const otherId = makeFile("Trakt/Shrinking [999] (2023).md");
    const defaultApp = makeApp([plain, bracketed, otherId], {
      [plain.path]: fm("show", 189764, "Shrinking", 2023, "2026-05-15T00:00:00Z"),
      [bracketed.path]: fm("show", 189764, "Shrinking", 2023, "2026-05-16T00:00:00Z"),
      [otherId.path]: fm("show", 999, "Shrinking", 2023, "2026-05-16T00:00:00Z"),
    });
    const defaultResult = await dedupeDuplicateNotes(
      defaultApp.app as never,
      "Trakt",
      "{{title}} ({{year}})",
      "trakt_",
    );
    assertEq(defaultResult.duplicateGroups, 1, "default template: one duplicate identity group");
    assertEq(defaultResult.movedToTrash, 1, "default template: one duplicate copy trashed");
    assertEq(
      defaultApp.trashed,
      [bracketed.path],
      "default template keeps natural filename and does not remove different-id collision",
    );
    assertEq(defaultApp.renamed, [], "default template: kept file already has desired name");

    const customPlain = makeFile("Trakt/Shrinking (2023).md");
    const customBracketed = makeFile("Trakt/Shrinking [189764] (2023).md");
    const customApp = makeApp([customPlain, customBracketed], {
      [customPlain.path]: fm("show", 189764, "Shrinking", 2023, "2026-05-15T00:00:00Z"),
      [customBracketed.path]: fm("show", 189764, "Shrinking", 2023, "2026-05-16T00:00:00Z"),
    });
    const customResult = await dedupeDuplicateNotes(
      customApp.app as never,
      "Trakt",
      "{{title}} [{{trakt_id}}] ({{year}})",
      "trakt_",
    );
    assertEq(customResult.duplicateGroups, 1, "custom template: one duplicate identity group");
    assertEq(
      customApp.trashed,
      [customPlain.path],
      "custom template keeps the filename that matches the current template",
    );
  }

  // ── Test 62: [1.0.0] WhatsNewModal i18n keys present in EN + zh-CN ──
  // The modal renders five chrome strings (title, "Bug fix" tag, footer,
  // two buttons) — all MUST exist in both locales so an upgraded user
  // in either language sees a coherent dialog. Per-version content
  // (the actual log lines) is verified separately in test [63].

  console.log("\n[62] What's-new modal chrome i18n keys — EN + zh-CN");
  {
    const keys = [
    "whatsNew.title",
    "whatsNew.current",
    "whatsNew.recent",
    "whatsNew.bugfix",
    "whatsNew.footer",
    "whatsNew.github",
      "whatsNew.dismiss",
    ] as const;
    for (const k of keys) {
      const enMsg = t(k, "en");
      const zhMsg = t(k, "zh-CN");
      assertTrue(
        enMsg.length > 0 && !enMsg.startsWith("whatsNew."),
        `en '${k}' resolves`,
      );
      assertTrue(
        zhMsg.length > 0 && !zhMsg.startsWith("whatsNew."),
        `zh-CN '${k}' resolves`,
      );
      assertTrue(
        enMsg !== zhMsg,
        `'${k}': en and zh-CN actually differ`,
      );
    }
  }

  // ── Test 63: [1.0.0] release-log shape + comparator ─────────────────
  // The release log feeds the What's-new modal. Catches two failure
  // modes that would silently break the modal:
  //   - missing en/zh field on an entry (TS would catch shape; this
  //     also rejects empty strings)
  //   - isVersionNewer breaking on edge cases (empty string, equal
  //     versions, double-digit patch, ordering)

  console.log("\n[63] release-log entries well-formed in both langs");
  {
    assertTrue(RELEASE_LOG.length > 0, "release log non-empty");
    for (const entry of RELEASE_LOG) {
      assertTrue(
        /^\d+\.\d+\.\d+$/.test(entry.version),
        `'${entry.version}': matches x.y.z`,
      );
      assertTrue(
        entry.en.length > 0,
        `'${entry.version}': en non-empty`,
      );
      assertTrue(
        entry.zh.length > 0,
        `'${entry.version}': zh non-empty`,
      );
      assertTrue(
        entry.en !== entry.zh,
        `'${entry.version}': en and zh actually differ`,
      );
    }

    // Log must be in reverse-chronological order — main.ts relies on
    // filtering preserving display order (newest first in the modal).
    for (let i = 1; i < RELEASE_LOG.length; i++) {
      assertTrue(
        isVersionNewer(RELEASE_LOG[i - 1].version, RELEASE_LOG[i].version),
        `entry ${i - 1} ('${RELEASE_LOG[i - 1].version}') strictly newer than entry ${i} ('${RELEASE_LOG[i].version}')`,
      );
    }
  }

  console.log("\n[63b] recent update highlights are versionless");
  {
    assertTrue(
      RECENT_UPDATE_HIGHLIGHTS.length >= 3,
      "recent highlights include several memorable feature bullets",
    );
    for (const h of RECENT_UPDATE_HIGHLIGHTS) {
      assertTrue(
        !/\b\d+\.\d+\.\d+\b/.test(h.en),
        `en highlight has no version number: ${h.en}`,
      );
      assertTrue(
        !/\b\d+\.\d+\.\d+\b/.test(h.zh),
        `zh highlight has no version number: ${h.zh}`,
      );
    }
  }

  console.log("\n[64] isVersionNewer — strict semver-ish comparator");
  {
    assertTrue(isVersionNewer("1.0.0", "0.9.0"), "1.0.0 > 0.9.0");
    assertTrue(isVersionNewer("0.9.0", "0.8.1"), "0.9.0 > 0.8.1");
    assertTrue(isVersionNewer("0.7.10", "0.7.9"), "numeric, not lexicographic: 0.7.10 > 0.7.9");
    assertTrue(!isVersionNewer("1.0.0", "1.0.0"), "strict: 1.0.0 NOT > 1.0.0");
    assertTrue(!isVersionNewer("0.9.0", "1.0.0"), "0.9.0 NOT > 1.0.0");
    assertTrue(isVersionNewer("1.0.0", ""), "empty 'never-seen' is lower than any version");
    assertTrue(!isVersionNewer("", "1.0.0"), "empty NOT > any version");
    assertTrue(!isVersionNewer("", ""), "empty NOT > empty");
  }

  // ── Test 65a: [1.0.0] renderPreview follows template language + fallback ─
  // Locks the fix from "fix(1.0.0): Daily Notes preview now follows template
  // language" — preview must reflect what real Daily Notes will look like
  // (templateLanguage), and unsupported / custom codes must fall back to
  // English instead of crashing or rendering with empty verbs.

  console.log("\n[65a] renderPreview — templateLanguage drives output, en fallback works");
  {
    // Supported template language → preview in that language
    const zhCn = renderPreview(withSettings({ templateLanguage: "zh-CN" }));
    assertTrue(
      zhCn.includes("看了"),
      "templateLanguage=zh-CN → preview uses zh-CN verbs (看了)",
    );
    assertTrue(
      !zhCn.includes("watched"),
      "templateLanguage=zh-CN → preview does NOT mix in English",
    );

    const ja = renderPreview(withSettings({ templateLanguage: "ja-JP" }));
    assertTrue(ja.includes("視聴"), "templateLanguage=ja-JP → 視聴");

    // Alias falls through to its mapped target
    const zhHk = renderPreview(withSettings({ templateLanguage: "zh-HK" }));
    assertTrue(
      zhHk.includes("看了"),
      "templateLanguage=zh-HK → alias to zh-TW → 看了",
    );

    // Unsupported / custom code → English fallback
    const tr = renderPreview(
      withSettings({
        templateLanguage: "custom",
        customTemplateLanguage: "tr-TR",
      }),
    );
    assertTrue(
      tr.includes("watched") && tr.includes("added to watchlist") && tr.includes("rated"),
      "custom unsupported code (tr-TR) → English verbs",
    );

    // Empty template language → English fallback
    const empty = renderPreview(withSettings({ templateLanguage: "" }));
    assertTrue(
      empty.includes("watched") && empty.includes("rated"),
      "empty templateLanguage → English verbs",
    );

    // templateLanguage is independent of uiLanguage — setting uiLanguage
    // alone does NOT change preview language
    const uiEnTemplateZh = renderPreview(
      withSettings({ uiLanguage: "en", templateLanguage: "zh-CN" }),
    );
    assertTrue(
      uiEnTemplateZh.includes("看了"),
      "uiLanguage=en + templateLanguage=zh-CN → preview still in zh-CN (template wins)",
    );
  }

  console.log("\n[65] entriesNewerThan — filter to unseen versions");
  {
    // Empty sinceVersion → returns the entire log
    const all = entriesNewerThan("");
    assertEq(all.length, RELEASE_LOG.length, "empty since-version → full log");

    // Equal to newest → empty
    const newest = RELEASE_LOG[0].version;
    const empty = entriesNewerThan(newest);
    assertEq(empty.length, 0, "since=newest → no entries to show");

    // Equal to some middle version → only strictly-newer ones
    if (RELEASE_LOG.length >= 3) {
      const middle = RELEASE_LOG[2].version;
      const newer = entriesNewerThan(middle);
      // Should be everything strictly above middle; middle itself excluded
      assertEq(
        newer.length,
        2,
        `since=middle (${middle}) → 2 newer entries`,
      );
      assertTrue(
        !newer.some((e) => e.version === middle),
        "filtered list does not include the since-version itself",
      );
    }
  }

  // ── Test 66: [1.0.0] computeThisMonth / computeLastMonth ─────────────
  // Backfill modal's "This month" / "Last month" presets depend on these.
  // Bug-prone area (month rollover, year rollover, leap years), so
  // we cover the four interesting edge cases.

  console.log("\n[66] computeThisMonth / computeLastMonth — calendar math edge cases");
  {
    // Mid-month — straightforward
    {
      const tm = computeThisMonth("2026-05-13");
      assertEq(tm.start, "2026-05-01", "thisMonth(May 13) start = May 1");
      assertEq(tm.end, "2026-05-13", "thisMonth(May 13) end = today (clamped)");
      const lm = computeLastMonth("2026-05-13");
      assertEq(lm.start, "2026-04-01", "lastMonth(May 13) start = Apr 1");
      assertEq(lm.end, "2026-04-30", "lastMonth(May 13) end = Apr 30");
    }
    // First day of month — same-day this-month, last month is fully filled
    {
      const tm = computeThisMonth("2026-05-01");
      assertEq(tm.start, "2026-05-01", "thisMonth(May 1) start");
      assertEq(tm.end, "2026-05-01", "thisMonth(May 1) end == today");
      const lm = computeLastMonth("2026-05-01");
      assertEq(lm.end, "2026-04-30", "lastMonth(May 1) end = Apr 30");
    }
    // Year rollover — January
    {
      const tm = computeThisMonth("2026-01-15");
      assertEq(tm.start, "2026-01-01", "thisMonth(Jan 15) start");
      const lm = computeLastMonth("2026-01-15");
      assertEq(lm.start, "2025-12-01", "lastMonth(Jan 15) start = prev year Dec 1");
      assertEq(lm.end, "2025-12-31", "lastMonth(Jan 15) end = prev year Dec 31");
    }
    // February-after-March — leap year + non-leap year
    {
      // 2024 is a leap year, so Feb has 29 days
      const lm2024 = computeLastMonth("2024-03-10");
      assertEq(lm2024.end, "2024-02-29", "lastMonth(Mar 10, 2024 leap) end = Feb 29");
      // 2025 is not leap, Feb has 28 days
      const lm2025 = computeLastMonth("2025-03-10");
      assertEq(lm2025.end, "2025-02-28", "lastMonth(Mar 10, 2025) end = Feb 28");
    }
  }

  console.log("\n[67] local runtime cache storage — slim synced payload helpers");
  {
    const runtimeHistory: HistoryState = {
      ...EMPTY_HISTORY_STATE,
      byMovie: { 1: ["2026-05-01T01:00:00.000Z"] },
      byShow: {
        2: [
          {
            season: 1,
            episode: 3,
            title: "Pilot",
            watched_at: ["2026-05-02T01:00:00.000Z"],
          },
        ],
      },
      knownEventIds: [10, 11],
      lastIncrementalSyncAt: "2026-05-02T01:00:00.000Z",
      lastFullRefreshAt: "2026-05-10T01:00:00.000Z",
      lastDailyNoteSyncedAt: "2026-05-12",
      lastAuthoritativeFullRefreshAt: "2026-05-10T01:00:00.000Z",
      lastReleaseNoticeVersion: "1.0.0",
    };

    const slim = buildSlimSyncedHistoryState(runtimeHistory);
    assertEq(slim.byMovie, {}, "slim history removes movie aggregate");
    assertEq(slim.byShow, {}, "slim history removes show aggregate");
    assertEq(slim.knownEventIds, [], "slim history removes event id set");
    assertEq(slim.lastIncrementalSyncAt, "", "slim history removes local incremental cursor");
    assertEq(slim.lastFullRefreshAt, "", "slim history removes local full-refresh cursor");
    assertEq(
      slim.lastDailyNoteSyncedAt,
      "2026-05-12",
      "slim history preserves Daily Notes cursor",
    );
    assertEq(
      slim.lastAuthoritativeFullRefreshAt,
      "2026-05-10T01:00:00.000Z",
      "slim history preserves authoritative full-refresh coordinator",
    );
    assertEq(
      slim.lastReleaseNoticeVersion,
      "1.0.0",
      "slim history preserves release notice dismissal",
    );

    assertTrue(
      syncedPayloadContainsRuntimeData({
        tmdbCache: {
          "movie:1:default": {
            poster_url: "poster",
            translation: null,
            cached_at: 1,
            expires_at: 2,
          },
        },
      }),
      "runtime-data detector catches non-empty TMDB cache",
    );
    assertTrue(
      syncedPayloadContainsRuntimeData({ historyState: runtimeHistory }),
      "runtime-data detector catches populated history aggregates",
    );
    assertTrue(
      !syncedPayloadContainsRuntimeData({ tmdbCache: {}, historyState: slim }),
      "runtime-data detector ignores slim synced placeholders",
    );

    const merged = mergeSyncedHistoryFields(runtimeHistory, {
      lastDailyNoteSyncedAt: "2026-05-16",
      lastAuthoritativeFullRefreshAt: "2026-05-15T01:00:00.000Z",
      lastReleaseNoticeVersion: "1.1.1",
    });
    assertEq(
      merged.byMovie,
      runtimeHistory.byMovie,
      "merge keeps local movie aggregate",
    );
    assertEq(
      merged.lastDailyNoteSyncedAt,
      "2026-05-16",
      "merge overlays synced Daily Notes cursor",
    );
    assertEq(
      merged.lastAuthoritativeFullRefreshAt,
      "2026-05-15T01:00:00.000Z",
      "merge overlays synced authoritative refresh timestamp",
    );
    assertEq(
      merged.lastReleaseNoticeVersion,
      "1.1.1",
      "merge overlays synced release notice dismissal",
    );
  }

  console.log("\n[68] RuntimeStore — localStorage fallback round trip");
  {
    const stub = await import("./stub-obsidian");
    const app = new stub.App();
    const store = new RuntimeStore(app as never, "test-runtime-key");
    const payload = {
      schemaVersion: RUNTIME_STORAGE_SCHEMA_VERSION,
      tmdbCache: {
        "movie:155:zh-CN": {
          poster_url: "https://image.tmdb.org/t/p/w342/demo.jpg",
          translation: {
            title: "黑暗骑士",
            overview: "overview",
            tagline: "tagline",
            genres: ["动作"],
          },
          cached_at: 1,
          expires_at: 2,
        },
      },
      historyState: {
        ...EMPTY_HISTORY_STATE,
        byMovie: { 155: ["2026-05-01T01:00:00.000Z"] },
        knownEventIds: [123],
        lastIncrementalSyncAt: "2026-05-01T01:00:00.000Z",
      },
    };

    await store.save(payload);
    assertEq(store.backend, "localStorage", "RuntimeStore falls back to localStorage in Node");
    assertEq(await store.load(), payload, "RuntimeStore loads saved fallback payload");
    await store.clear();
    assertEq(await store.load(), null, "RuntimeStore clear removes fallback payload");
  }

  console.log("\n[69] saveSettings — skips unchanged slim data.json payload");
  {
    const stub = await import("./stub-obsidian");
    const mainModule = await import("../src/main");
    const app = new stub.App();
    const plugin = new mainModule.default() as never;
    const mutable = plugin as {
      app: unknown;
      settings: TraktrSettings;
      localKeys: Set<string>;
      runtimeStore: RuntimeStore;
      lastSavedSyncedSettingsJson: string;
      buildSyncedSettingsPayload: () => Partial<TraktrSettings>;
      saveData: (data: unknown) => Promise<void>;
      saveSettings: () => Promise<void>;
    };
    mutable.app = app;
    mutable.settings = withSettings({
      tmdbCache: {
        "movie:1:default": {
          poster_url: "poster",
          translation: null,
          cached_at: 1,
          expires_at: 2,
        },
      },
      historyState: {
        ...EMPTY_HISTORY_STATE,
        byMovie: { 1: ["2026-05-01T01:00:00.000Z"] },
        knownEventIds: [1],
        lastIncrementalSyncAt: "2026-05-01T01:00:00.000Z",
        lastDailyNoteSyncedAt: "2026-05-02",
      },
    });
    mutable.localKeys = new Set();
    mutable.runtimeStore = new RuntimeStore(app as never, "test-save-settings");
    mutable.lastSavedSyncedSettingsJson = JSON.stringify(
      mutable.buildSyncedSettingsPayload(),
    );
    let saveDataCalls = 0;
    let savedPayload: Partial<TraktrSettings> | null = null;
    mutable.saveData = async (data: unknown) => {
      saveDataCalls++;
      savedPayload = data as Partial<TraktrSettings>;
    };

    await mutable.saveSettings();
    assertEq(saveDataCalls, 0, "unchanged slim payload skips saveData");

    mutable.settings.folder = "Trakt Notes";
    await mutable.saveSettings();
    assertEq(saveDataCalls, 1, "changed synced setting writes data.json once");
    assertEq(savedPayload?.tmdbCache, {}, "saved data.json has empty tmdbCache placeholder");
    assertEq(
      savedPayload?.historyState?.knownEventIds,
      [],
      "saved data.json omits local history event ids",
    );
    assertEq(
      savedPayload?.historyState?.lastDailyNoteSyncedAt,
      "2026-05-02",
      "saved data.json preserves small synced history field",
    );
  }

  console.log("\n[70] syncDailyNotesData — lightweight path and shared lock");
  {
    const stub = await import("./stub-obsidian");
    stub.resetRequestUrlMock(() => ({ status: 200, json: [], headers: {} }));
    const settings = withSettings({
      clientId: "client",
      accessToken: "access",
      refreshToken: "refresh",
      tokenExpiresAt: Date.now() + 86_400_000,
      syncMovies: false,
      syncShows: false,
      syncWatched: true,
      syncWatchedDetail: true,
    });
    let saveCalls = 0;
    const engine = new SyncEngine(
      new stub.App() as never,
      settings,
      async () => {
        saveCalls++;
      },
    );

    const result = await engine.syncDailyNotesData();
    assertEq(result.status, "updated", "Daily-only data sync completes");
    assertEq(result.items.length, 0, "no enabled media types → no merged items");
    assertEq(
      stub.requestUrlMock.calls.length,
      0,
      "no enabled media types avoids Trakt source calls",
    );
    assertEq(saveCalls, 1, "Daily-only data sync persists runtime state once");

    (engine as unknown as { syncing: boolean }).syncing = true;
    const locked = await engine.syncDailyNotesData();
    assertEq(
      locked.status,
      "already_running",
      "Daily-only data sync uses the shared SyncEngine lock",
    );
    assertEq(locked.items.length, 0, "locked Daily-only sync returns no items");
  }

  console.log("\n[71] syncDailyNotesData — refreshes enabled watchlist source");
  {
    const stub = await import("./stub-obsidian");
    const movie = {
      title: "Watchlist Movie",
      year: 2026,
      ids: { trakt: 4321, slug: "watchlist-movie-2026", imdb: "tt0432100", tmdb: 765 },
      overview: "Watchlist overview",
      runtime: 90,
      country: "us",
      genres: ["thriller"],
      rating: 7.2,
      votes: 50,
      certification: "PG-13",
      language: "en",
      status: "released",
    };
    stub.resetRequestUrlMock((req) => {
      if (req.url.includes("/sync/watchlist/movies")) {
        return {
          status: 200,
          json: [
            {
              rank: 1,
              id: 10001,
              listed_at: "2026-05-11T10:00:00.000Z",
              notes: null,
              type: "movie",
              movie,
            },
          ],
          headers: {},
        };
      }
      return { status: 200, json: [], headers: {} };
    });

    const settings = withSettings({
      clientId: "client",
      accessToken: "access",
      refreshToken: "refresh",
      tokenExpiresAt: Date.now() + 86_400_000,
      syncMovies: true,
      syncShows: false,
      syncWatchlist: true,
      syncWatched: false,
      syncWatchedDetail: false,
      syncFavorites: false,
      syncRatings: false,
    });
    const engine = new SyncEngine(
      new stub.App() as never,
      settings,
      async () => undefined,
    );

    const result = await engine.syncDailyNotesData();
    const events = aggregateEventsForDate(
      "2026-05-11",
      result.items,
      settings,
    );
    assertEq(result.status, "updated", "Daily-only data sync completes");
    assertEq(result.items.length, 1, "watchlist item is included in Daily snapshot");
    assertEq(
      result.items[0].watchlist_added_at,
      "2026-05-11T10:00:00.000Z",
      "watchlist listed_at is preserved for Daily backfill",
    );
    assertEq(
      events[0]?.action,
      "added_to_watchlist",
      "refreshed watchlist snapshot renders a Daily Note watchlist event",
    );
  }

  console.log("\n[72] syncDailyNotesData — respects multi-device history coordinator");
  {
    const stub = await import("./stub-obsidian");
    const movie = {
      title: "Example Movie",
      year: 2026,
      ids: { trakt: 321, slug: "example-movie-2026", imdb: "tt0321000", tmdb: 654 },
      overview: "Example overview",
      runtime: 100,
      country: "us",
      genres: ["drama"],
      rating: 7.5,
      votes: 100,
      certification: "PG",
      language: "en",
      status: "released",
    };
    stub.resetRequestUrlMock((req) => {
      if (req.url.includes("/sync/watched/movies")) {
        return {
          status: 200,
          json: [
            {
              plays: 1,
              last_watched_at: "2026-05-16T12:00:00.000Z",
              last_updated_at: "2026-05-16T12:00:00.000Z",
              movie,
            },
          ],
          headers: {},
        };
      }
      if (req.url.includes("/sync/history/movies")) {
        return {
          status: 200,
          json: [
            {
              id: 9001,
              watched_at: "2026-05-16T12:00:00.000Z",
              action: "watch",
              type: "movie",
              movie,
            },
          ],
          headers: {},
        };
      }
      return { status: 200, json: [], headers: {} };
    });

    const settings = withSettings({
      clientId: "client",
      accessToken: "access",
      refreshToken: "refresh",
      tokenExpiresAt: Date.now() + 86_400_000,
      syncMovies: true,
      syncShows: false,
      syncWatchlist: false,
      syncWatched: true,
      syncWatchedDetail: true,
      syncFavorites: false,
      syncRatings: false,
      historyFullRefreshIntervalDays: 999,
      historyState: {
        ...EMPTY_HISTORY_STATE,
        lastIncrementalSyncAt: "2026-05-12T00:00:00.000Z",
        lastFullRefreshAt: "2026-05-10T00:00:00.000Z",
        lastAuthoritativeFullRefreshAt: "2026-05-15T00:00:00.000Z",
      },
    });
    const engine = new SyncEngine(
      new stub.App() as never,
      settings,
      async () => undefined,
    );

    const result = await engine.syncDailyNotesData();
    const historyUrl =
      stub.requestUrlMock.calls.find((call) =>
        call.url.includes("/sync/history/movies"),
      )?.url || "";
    assertEq(result.status, "updated", "Daily-only data sync completes");
    assertEq(result.items.length, 1, "Daily-only data sync returns watched item");
    assertTrue(
      historyUrl.length > 0 && !historyUrl.includes("start_at="),
      "authoritative coordinator forces a full history refresh",
    );
    assertEq(
      result.items[0].watch_history_movie,
      ["2026-05-16T12:00:00.000Z"],
      "Daily-only result includes refreshed detailed history",
    );
    assertEq(
      settings.historyState.knownEventIds,
      [9001],
      "Daily-only sync rebuilds local runtime event ids",
    );
    assertEq(
      settings.historyState.lastAuthoritativeFullRefreshAt,
      settings.historyState.lastFullRefreshAt,
      "full Daily-only refresh updates the synced authoritative coordinator",
    );
  }

  console.log("\n[73] history-only episode events seed watched show items");
  {
    const stub = await import("./stub-obsidian");
    const show = {
      title: "Busy Treasure Hunting",
      year: 2026,
      ids: { trakt: 555001, slug: "busy-treasure-hunting-2026", tmdb: 999001 },
      overview: "Special-only watched show.",
      runtime: 45,
      country: "cn",
      genres: ["reality"],
      rating: 7.1,
      votes: 10,
      certification: "",
      language: "zh",
      status: "returning series",
    };
    stub.resetRequestUrlMock((req) => {
      if (req.url.includes("/sync/watched/shows")) {
        return { status: 200, json: [], headers: {} };
      }
      if (req.url.includes("/sync/history/episodes")) {
        return {
          status: 200,
          json: [
            {
              id: 990001,
              watched_at: "2026-05-20T06:47:00.000Z",
              action: "watch",
              type: "episode",
              show,
              episode: {
                season: 0,
                number: 1,
                title: "Special 1",
                ids: { trakt: 880001, tmdb: 770001 },
              },
            },
          ],
          headers: {},
        };
      }
      return { status: 200, json: [], headers: {} };
    });

    const settings = withSettings({
      clientId: "client",
      accessToken: "access",
      refreshToken: "refresh",
      tokenExpiresAt: Date.now() + 86_400_000,
      syncMovies: false,
      syncShows: true,
      syncWatchlist: false,
      syncWatched: true,
      syncWatchedDetail: true,
      syncFavorites: false,
      syncRatings: false,
    });
    const engine = new SyncEngine(
      new stub.App() as never,
      settings,
      async () => undefined,
    );

    const result = await engine.syncDailyNotesData();
    assertEq(result.status, "updated", "Daily-only data sync completes");
    assertEq(
      result.items.length,
      1,
      "history-only watched show is included in merged items",
    );
    assertEq(result.items[0].watched, true, "history-only show is marked watched");
    assertEq(
      result.items[0].episodes_watched,
      1,
      "history-only show counts the watched special",
    );
    assertEq(
      result.items[0].watch_history_episodes?.[0]?.season,
      0,
      "S00 history is preserved on the hydrated item",
    );
    assertEq(
      result.items[0].watch_history_episodes?.[0]?.episode,
      1,
      "special episode number is preserved on the hydrated item",
    );
  }

  console.log("\n[74] orphaned local history state triggers repair full refresh");
  {
    const stub = await import("./stub-obsidian");
    const show = {
      title: "State Orphan Show",
      year: 2026,
      ids: { trakt: 555002, slug: "state-orphan-show-2026", tmdb: 999002 },
      overview: "Already in local history state.",
      runtime: 45,
      country: "cn",
      genres: ["reality"],
      rating: 7.1,
      votes: 10,
      certification: "",
      language: "zh",
      status: "returning series",
    };
    stub.resetRequestUrlMock((req) => {
      if (req.url.includes("/sync/watched/shows")) {
        return { status: 200, json: [], headers: {} };
      }
      if (
        req.url.includes("/sync/history/episodes") &&
        req.url.includes("start_at=")
      ) {
        return { status: 200, json: [], headers: {} };
      }
      if (req.url.includes("/sync/history/episodes")) {
        return {
          status: 200,
          json: [
            {
              id: 990002,
              watched_at: "2026-05-20T06:47:00.000Z",
              action: "watch",
              type: "episode",
              show,
              episode: {
                season: 0,
                number: 1,
                title: "Special 1",
                ids: { trakt: 880002, tmdb: 770002 },
              },
            },
          ],
          headers: {},
        };
      }
      return { status: 200, json: [], headers: {} };
    });

    const settings = withSettings({
      clientId: "client",
      accessToken: "access",
      refreshToken: "refresh",
      tokenExpiresAt: Date.now() + 86_400_000,
      syncMovies: false,
      syncShows: true,
      syncWatchlist: false,
      syncWatched: true,
      syncWatchedDetail: true,
      syncFavorites: false,
      syncRatings: false,
      historyFullRefreshIntervalDays: 999,
      historyState: {
        ...EMPTY_HISTORY_STATE,
        byShow: {
          555002: [
            {
              season: 0,
              episode: 1,
              title: "Special 1",
              watched_at: ["2026-05-20T06:47:00.000Z"],
            },
          ],
        },
        knownEventIds: [990002],
        lastIncrementalSyncAt: "2026-05-20T06:47:00.000Z",
        lastFullRefreshAt: "2026-05-20T06:40:00.000Z",
      },
    });
    const engine = new SyncEngine(
      new stub.App() as never,
      settings,
      async () => undefined,
    );

    const result = await engine.syncDailyNotesData();
    const historyCalls = stub.requestUrlMock.calls.filter((call) =>
      call.url.includes("/sync/history/episodes"),
    );
    assertEq(result.status, "updated", "Daily-only data sync completes");
    assertEq(
      historyCalls.length,
      2,
      "orphaned local state triggers incremental then repair full refresh",
    );
    assertTrue(
      historyCalls[0].url.includes("start_at="),
      "first history call is incremental",
    );
    assertTrue(
      !historyCalls[1].url.includes("start_at="),
      "repair history call is a full refresh",
    );
    assertEq(
      result.items.length,
      1,
      "repair full refresh seeds the missing history-only show",
    );
    assertEq(
      result.items[0].watch_history_episodes?.[0]?.season,
      0,
      "repaired item keeps the S00 history",
    );
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Smoke results: ${passes} passed, ${failures} failed`);
  console.log("=".repeat(60));
  if (failures > 0) {
    process.exit(1);
  }
})();
