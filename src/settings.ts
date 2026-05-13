import { App, Modal, PluginSettingTab, Setting, Notice } from "obsidian";
import type TraktrPlugin from "./main";
import { getTranslator, type UiLanguage } from "./i18n";
import {
  EMPTY_HISTORY_STATE,
  type HistoryState,
  type TmdbCache,
} from "./types";
import { clearTmdbCache, tmdbCacheStats, verifyTmdbApiKey } from "./tmdb-api";
import { clearHistoryState, historyStateStats } from "./history-state";
import { manualBackfill, renderPreview, type DailyNotesHost } from "./daily-notes";

export const POSTER_SIZES = [
  "w92",
  "w154",
  "w185",
  "w342",
  "w500",
  "w780",
  "original",
] as const;

export type PosterSize = (typeof POSTER_SIZES)[number];

/**
 * [0.5.0] Settings that can be marked as "device-local" per spec 0003.
 *
 * These are the settings whose semantics make per-device divergence
 * legitimate — auto-sync timing varies by device, UI language can vary
 * by user-of-device, etc. Everything else (auth tokens, sync content
 * toggles, metadata language, templates, etc.) always lives in data.json
 * and follows vault sync.
 *
 * Each device independently records WHICH of these keys are local on it
 * (the `_localKeys` array in localStorage). This means Mac can have
 * `uiLanguage` local while iPhone keeps it synced — the metadata about
 * who's local is itself device-local, not synced.
 */
export const LOCAL_ELIGIBLE_KEYS = [
  "syncOnStartup",
  "autoSyncEnabled",
  "autoSyncIntervalMinutes",
  "uiLanguage",
] as const;
export type LocalEligibleKey = (typeof LOCAL_ELIGIBLE_KEYS)[number];

/**
 * [0.5.0] On first 0.5.0 launch (no `_localKeys` in localStorage yet),
 * these keys default to local on that device. The auto-sync trio fits
 * here because cross-device sync of these settings causes redundant
 * syncs / Trakt API traffic for zero user benefit (each device should
 * pick its own cadence). `uiLanguage` defaults to SYNCED — most users
 * want the same UI language everywhere — but it remains togglable via
 * the cloud icon.
 */
export const DEFAULT_LOCAL_KEYS: ReadonlyArray<LocalEligibleKey> = [
  "syncOnStartup",
  "autoSyncEnabled",
  "autoSyncIntervalMinutes",
];

/**
 * Namespace prefix for all localStorage keys this plugin owns. Obsidian's
 * `app.loadLocalStorage` / `saveLocalStorage` are vault-scoped, but the
 * prefix lets us coexist with other plugins (and our own future keys)
 * within the same vault's local storage.
 */
export const LOCAL_STORAGE_PREFIX = "sync-trakt:";

/** Key under which the list of currently-local setting keys is stored. */
export const LOCAL_KEYS_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}_localKeys`;

/** Preset language options shown in the Localization (metadata) dropdown.
 * The Note template language dropdown reuses this same list for symmetry,
 * even though the plugin only ships translated default templates for English
 * and Simplified/Traditional Chinese (other codes resolve to the English
 * default — users can still customize manually). */
export const METADATA_LANGUAGE_PRESETS: ReadonlyArray<readonly [string, string]> = [
  ["", "Default (English / Trakt original)"],
  ["zh-CN", "Chinese (Simplified, China)"],
  ["zh-TW", "Chinese (Traditional, Taiwan)"],
  ["zh-HK", "Chinese (Traditional, Hong Kong)"],
  ["ja-JP", "Japanese"],
  ["ko-KR", "Korean"],
  ["en-US", "English (United States)"],
  ["en-GB", "English (United Kingdom)"],
  ["fr-FR", "French"],
  ["de-DE", "German"],
  ["es-ES", "Spanish (Spain)"],
  ["es-MX", "Spanish (Mexico)"],
  ["pt-BR", "Portuguese (Brazil)"],
  ["it-IT", "Italian"],
  ["ru-RU", "Russian"],
];

const PRESET_LANGUAGE_VALUES: ReadonlySet<string> = new Set(
  METADATA_LANGUAGE_PRESETS.map(([v]) => v),
);

/**
 * [0.6.0 / spec 0007] Languages that have bundled body templates AND
 * Daily Notes verb translations. Different from METADATA_LANGUAGE_PRESETS
 * because TMDB supports ~100 metadata locales while we only ship hand-
 * curated templates for these 11. The template-language dropdown lists
 * these (no "custom" option there — it would silently fall back to
 * English which was the bug being fixed).
 */
export const BUNDLED_TEMPLATE_LANGUAGES: ReadonlyArray<readonly [string, string]> = [
  ["", "Default (English)"],
  ["zh-CN", "Chinese (Simplified, China)"],
  ["zh-TW", "Chinese (Traditional, Taiwan)"],
  ["ja-JP", "Japanese"],
  ["ko-KR", "Korean"],
  ["fr-FR", "French"],
  ["de-DE", "German"],
  ["it-IT", "Italian"],
  ["es-ES", "Spanish"],
  ["pt-BR", "Portuguese (Brazil)"],
  ["ru-RU", "Russian"],
];

const BUNDLED_TEMPLATE_LANGUAGE_VALUES: ReadonlySet<string> = new Set(
  BUNDLED_TEMPLATE_LANGUAGES.map(([v]) => v),
);

/**
 * Resolve the effective language code to use for translation requests.
 * Returns "" when localization is disabled (no preset selected, or "custom"
 * with no code typed).
 */
export function getEffectiveMetadataLanguage(settings: TraktrSettings): string {
  const dropdown = (settings.metadataLanguage || "").trim();
  if (dropdown === "custom") {
    return (settings.customMetadataLanguage || "").trim();
  }
  return dropdown;
}

/** True when the saved metadata-language dropdown value is "custom". */
function isCustomLanguageMode(settings: TraktrSettings): boolean {
  return (settings.metadataLanguage || "").trim() === "custom";
}

/**
 * Resolve the effective language code for picking a default note template.
 * Mirrors getEffectiveMetadataLanguage but for the templateLanguage field.
 */
export function getEffectiveTemplateLanguage(
  settings: TraktrSettings,
): string {
  const dropdown = (settings.templateLanguage || "").trim();
  if (dropdown === "custom") {
    return (settings.customTemplateLanguage || "").trim();
  }
  return dropdown;
}

export interface TraktrSettings {
  // Authentication
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;

  // TMDB
  tmdbApiKey: string;
  posterSize: PosterSize;

  // Localization (i18n)
  // metadataLanguage: dropdown value — "" (disabled), one of the presets, or
  //   the literal string "custom".
  // customMetadataLanguage: user-typed code, only consulted when
  //   metadataLanguage === "custom".
  // uiLanguage: language of the plugin's settings tab, command names, and
  //   notice popups. Independent from metadataLanguage. Limited to en/zh-CN.
  // templateLanguage: language used by the bundled default Movie / Show note
  //   templates. Same dropdown shape as metadataLanguage (preset codes +
  //   "custom"). The "Reset to default" button on each template applies this.
  // customTemplateLanguage: user-typed code, only consulted when
  //   templateLanguage === "custom".
  metadataLanguage: string;
  customMetadataLanguage: string;
  uiLanguage: UiLanguage;
  templateLanguage: string;
  customTemplateLanguage: string;

  // Property namespace
  propertyPrefix: string;

  // Folders & file naming
  folder: string;
  filenameTemplate: string;

  // Note templates
  movieNoteTemplate: string;
  showNoteTemplate: string;

  // Tags
  addTags: boolean;
  tagPrefix: string;

  // Tag notes
  addTagNotes: boolean;
  createTagNotes: boolean;
  tagNotesFolder: string;

  // Sync sources
  // syncWatched: pulls /sync/watched/* — provides plays count + last
  //   watched timestamp per item.
  // syncWatchedDetail: layered on top, additionally pulls /sync/history to
  //   render per-watch timestamps in the note body via {{watch_history}}.
  //   This endpoint can be very large; off by default.
  syncWatchlist: boolean;
  syncFavorites: boolean;
  syncWatched: boolean;
  syncWatchedDetail: boolean;
  syncRatings: boolean;

  // Sync behavior
  syncMovies: boolean;
  syncShows: boolean;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  syncOnStartup: boolean;
  overwriteExisting: boolean;
  deleteRemovedItems: boolean;

  // ── [0.2.0] TMDB cache ──
  // Persistent across syncs and across devices (lives in data.json which
  // follows the user's vault sync layer). Keyed by
  // `${type}:${tmdbId}:${language || 'default'}` so each (item, language)
  // combination has its own slot.
  tmdbCache: TmdbCache;
  // 0 = never expire. Otherwise the configured days, ±5 days jitter per
  // entry to avoid 1000+ entries all expiring on the same day.
  tmdbCacheTtlDays: number;

  // ── [0.2.0] History state for incremental Trakt history sync ──
  // Only meaningful when syncWatchedDetail is on. Stores aggregated
  // watch events plus the set of every event id we've already seen,
  // letting subsequent syncs do `?start_at=lastIncrementalSyncAt`
  // instead of pulling the full history every time.
  historyState: HistoryState;
  // Periodic full refresh to catch deletions on Trakt's side that an
  // incremental fetch can't see. Default 7 days.
  historyFullRefreshIntervalDays: number;

  // ── [0.7.0] Daily Notes integration ──
  // Auto-inject per-event lines into the user's Daily Note for each
  // sync. Safety contract: never modify content outside the marker
  // region. See spec 0006 for full design + 26-row edge case matrix.
  dailyNotesEnabled: boolean;
  dailyNotesFolder: string;             // e.g. "Daily" or "01 Daily"
  dailyNotesFilenameFormat: string;     // Moment.js, e.g. "YYYY-MM-DD"
  dailyNotesMarkerStart: string;        // default: "%% trakt:daily:start %%"
  dailyNotesMarkerEnd: string;          // default: "%% trakt:daily:end %%"
  dailyNotesBackfillDays: number;       // 1..30 for manual button
  // [0.8.0] Today-mode write strategy. "default" = full re-render every
  // sync (legacy behaviour, always reflects current Trakt state).
  // "incremental" = preserve existing lines, append-only (protects user
  // edits, doesn't propagate Trakt-side mutations). See spec docs +
  // settings-tab comparison table.
  dailyNotesSyncMode: DailyNotesSyncMode;
}

export type DailyNotesSyncMode = "default" | "incremental";

export const DEFAULT_MOVIE_TEMPLATE_EN = `![poster]({{poster_url}})

> {{tagline}}

## Overview
{{overview}}

## Details
- **Runtime**: {{runtime}} min
- **Genres**: {{genres}}
- **Rating**: {{trakt_rating}}/10 ({{trakt_votes}} votes)
- **Certification**: {{certification}}
- **Released**: {{released}}

## Trakt Status
- **Watchlist**: {{watchlist}}
- **Watched**: {{watched}} ({{plays}} plays, last: {{last_watched_at}})
- **Favorite**: {{favorite}}
- **My Rating**: {{my_rating}}/10

{{watch_history}}

## Links
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## My Notes

`;

export const DEFAULT_SHOW_TEMPLATE_EN = `![poster]({{poster_url}})

## Overview
{{overview}}

## Details
- **Network**: {{network}}
- **Runtime**: {{runtime}} min per episode
- **Episodes**: {{aired_episodes}} aired
- **Genres**: {{genres}}
- **Rating**: {{trakt_rating}}/10 ({{trakt_votes}} votes)
- **Certification**: {{certification}}
- **Status**: {{status}}
- **First Aired**: {{first_aired}}

## Trakt Status
- **Watchlist**: {{watchlist}}
- **Watched**: {{watched}} ({{plays}} plays, last: {{last_watched_at}})
- **Favorite**: {{favorite}}
- **My Rating**: {{my_rating}}/10

{{watch_history}}

## Links
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## My Notes

`;

export const DEFAULT_MOVIE_TEMPLATE_ZH_CN = `![poster]({{poster_url}})

> {{tagline}}

## 剧情简介
{{overview}}

## 详情
- **片长**：{{runtime}} 分钟
- **类型**：{{genres}}
- **评分**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **分级**：{{certification}}
- **上映**：{{released}}

## Trakt 状态
- **想看**：{{watchlist}}
- **看过**：{{watched}}（共 {{plays}} 次，最近：{{last_watched_at}}）
- **收藏**：{{favorite}}
- **我的评分**：{{my_rating}}/10

{{watch_history}}

## 链接
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 我的笔记

`;

export const DEFAULT_SHOW_TEMPLATE_ZH_CN = `![poster]({{poster_url}})

## 剧情简介
{{overview}}

## 详情
- **平台**：{{network}}
- **片长**：每集 {{runtime}} 分钟
- **集数**：{{aired_episodes}} 集已播出
- **类型**：{{genres}}
- **评分**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **分级**：{{certification}}
- **状态**：{{status}}
- **首播**：{{first_aired}}

## Trakt 状态
- **想看**：{{watchlist}}
- **看过**：{{watched}}（共 {{plays}} 次，最近：{{last_watched_at}}）
- **收藏**：{{favorite}}
- **我的评分**：{{my_rating}}/10

{{watch_history}}

## 链接
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 我的笔记

`;

export const DEFAULT_MOVIE_TEMPLATE_ZH_TW = `![poster]({{poster_url}})

> {{tagline}}

## 劇情簡介
{{overview}}

## 詳情
- **片長**：{{runtime}} 分鐘
- **類型**：{{genres}}
- **評分**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **分級**：{{certification}}
- **上映**：{{released}}

## Trakt 狀態
- **想看**：{{watchlist}}
- **看過**：{{watched}}（共 {{plays}} 次，最近：{{last_watched_at}}）
- **收藏**：{{favorite}}
- **我的評分**：{{my_rating}}/10

{{watch_history}}

## 連結
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 我的筆記

`;

export const DEFAULT_SHOW_TEMPLATE_ZH_TW = `![poster]({{poster_url}})

## 劇情簡介
{{overview}}

## 詳情
- **平台**：{{network}}
- **片長**：每集 {{runtime}} 分鐘
- **集數**：{{aired_episodes}} 集已播出
- **類型**：{{genres}}
- **評分**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **分級**：{{certification}}
- **狀態**：{{status}}
- **首播**：{{first_aired}}

## Trakt 狀態
- **想看**：{{watchlist}}
- **看過**：{{watched}}（共 {{plays}} 次，最近：{{last_watched_at}}）
- **收藏**：{{favorite}}
- **我的評分**：{{my_rating}}/10

{{watch_history}}

## 連結
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 我的筆記

`;

// ── [0.6.0] Japanese (ja-JP) ──
export const DEFAULT_MOVIE_TEMPLATE_JA = `![poster]({{poster_url}})

> {{tagline}}

## あらすじ
{{overview}}

## 詳細
- **上映時間**：{{runtime}} 分
- **ジャンル**：{{genres}}
- **評価**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **視聴年齢**：{{certification}}
- **公開**：{{released}}

## Trakt の状態
- **観たい**：{{watchlist}}
- **視聴済み**：{{watched}}（{{plays}} 回視聴、最終：{{last_watched_at}}）
- **お気に入り**：{{favorite}}
- **自分の評価**：{{my_rating}}/10

{{watch_history}}

## リンク
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## メモ

`;

export const DEFAULT_SHOW_TEMPLATE_JA = `![poster]({{poster_url}})

## あらすじ
{{overview}}

## 詳細
- **配信元**：{{network}}
- **上映時間**：1 話あたり {{runtime}} 分
- **エピソード数**：{{aired_episodes}} 話配信済み
- **ジャンル**：{{genres}}
- **評価**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **視聴年齢**：{{certification}}
- **ステータス**：{{status}}
- **配信開始**：{{first_aired}}

## Trakt の状態
- **観たい**：{{watchlist}}
- **視聴済み**：{{watched}}（{{plays}} 回視聴、最終：{{last_watched_at}}）
- **お気に入り**：{{favorite}}
- **自分の評価**：{{my_rating}}/10

{{watch_history}}

## リンク
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## メモ

`;

// ── [0.6.0] Korean (ko-KR) ──
export const DEFAULT_MOVIE_TEMPLATE_KO = `![poster]({{poster_url}})

> {{tagline}}

## 줄거리
{{overview}}

## 상세 정보
- **상영 시간**: {{runtime}} 분
- **장르**: {{genres}}
- **평점**: {{trakt_rating}}/10 ({{trakt_votes}} 표)
- **시청 등급**: {{certification}}
- **개봉**: {{released}}

## Trakt 상태
- **보고 싶음**: {{watchlist}}
- **시청함**: {{watched}} ({{plays}} 회, 최근: {{last_watched_at}})
- **즐겨찾기**: {{favorite}}
- **내 평점**: {{my_rating}}/10

{{watch_history}}

## 링크
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 내 메모

`;

export const DEFAULT_SHOW_TEMPLATE_KO = `![poster]({{poster_url}})

## 줄거리
{{overview}}

## 상세 정보
- **채널**: {{network}}
- **상영 시간**: 회당 {{runtime}} 분
- **회차**: {{aired_episodes}} 회 방영
- **장르**: {{genres}}
- **평점**: {{trakt_rating}}/10 ({{trakt_votes}} 표)
- **시청 등급**: {{certification}}
- **상태**: {{status}}
- **첫 방영**: {{first_aired}}

## Trakt 상태
- **보고 싶음**: {{watchlist}}
- **시청함**: {{watched}} ({{plays}} 회, 최근: {{last_watched_at}})
- **즐겨찾기**: {{favorite}}
- **내 평점**: {{my_rating}}/10

{{watch_history}}

## 링크
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 내 메모

`;

// ── [0.6.0] French (fr-FR) ──
export const DEFAULT_MOVIE_TEMPLATE_FR = `![poster]({{poster_url}})

> {{tagline}}

## Synopsis
{{overview}}

## Détails
- **Durée** : {{runtime}} min
- **Genres** : {{genres}}
- **Note** : {{trakt_rating}}/10 ({{trakt_votes}} votes)
- **Classification** : {{certification}}
- **Sortie** : {{released}}

## Statut Trakt
- **À voir** : {{watchlist}}
- **Vu** : {{watched}} ({{plays}} fois, dernière : {{last_watched_at}})
- **Favori** : {{favorite}}
- **Ma note** : {{my_rating}}/10

{{watch_history}}

## Liens
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Mes notes

`;

export const DEFAULT_SHOW_TEMPLATE_FR = `![poster]({{poster_url}})

## Synopsis
{{overview}}

## Détails
- **Chaîne** : {{network}}
- **Durée** : {{runtime}} min par épisode
- **Épisodes diffusés** : {{aired_episodes}}
- **Genres** : {{genres}}
- **Note** : {{trakt_rating}}/10 ({{trakt_votes}} votes)
- **Classification** : {{certification}}
- **Statut** : {{status}}
- **Première** : {{first_aired}}

## Statut Trakt
- **À voir** : {{watchlist}}
- **Vu** : {{watched}} ({{plays}} fois, dernière : {{last_watched_at}})
- **Favori** : {{favorite}}
- **Ma note** : {{my_rating}}/10

{{watch_history}}

## Liens
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Mes notes

`;

// ── [0.6.0] German (de-DE) ──
export const DEFAULT_MOVIE_TEMPLATE_DE = `![poster]({{poster_url}})

> {{tagline}}

## Inhalt
{{overview}}

## Details
- **Laufzeit**: {{runtime}} Min.
- **Genres**: {{genres}}
- **Bewertung**: {{trakt_rating}}/10 ({{trakt_votes}} Stimmen)
- **Altersfreigabe**: {{certification}}
- **Veröffentlicht**: {{released}}

## Trakt-Status
- **Möchte sehen**: {{watchlist}}
- **Gesehen**: {{watched}} ({{plays}} mal, zuletzt: {{last_watched_at}})
- **Favorit**: {{favorite}}
- **Meine Bewertung**: {{my_rating}}/10

{{watch_history}}

## Links
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Meine Notizen

`;

export const DEFAULT_SHOW_TEMPLATE_DE = `![poster]({{poster_url}})

## Inhalt
{{overview}}

## Details
- **Sender**: {{network}}
- **Laufzeit**: {{runtime}} Min. pro Folge
- **Folgen**: {{aired_episodes}} ausgestrahlt
- **Genres**: {{genres}}
- **Bewertung**: {{trakt_rating}}/10 ({{trakt_votes}} Stimmen)
- **Altersfreigabe**: {{certification}}
- **Status**: {{status}}
- **Erstausstrahlung**: {{first_aired}}

## Trakt-Status
- **Möchte sehen**: {{watchlist}}
- **Gesehen**: {{watched}} ({{plays}} mal, zuletzt: {{last_watched_at}})
- **Favorit**: {{favorite}}
- **Meine Bewertung**: {{my_rating}}/10

{{watch_history}}

## Links
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Meine Notizen

`;

// ── [0.6.0] Italian (it-IT) ──
export const DEFAULT_MOVIE_TEMPLATE_IT = `![poster]({{poster_url}})

> {{tagline}}

## Sinossi
{{overview}}

## Dettagli
- **Durata**: {{runtime}} min
- **Generi**: {{genres}}
- **Voto**: {{trakt_rating}}/10 ({{trakt_votes}} voti)
- **Classificazione**: {{certification}}
- **Uscita**: {{released}}

## Stato Trakt
- **Da vedere**: {{watchlist}}
- **Visto**: {{watched}} ({{plays}} volte, ultima: {{last_watched_at}})
- **Preferito**: {{favorite}}
- **Il mio voto**: {{my_rating}}/10

{{watch_history}}

## Link
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Note personali

`;

export const DEFAULT_SHOW_TEMPLATE_IT = `![poster]({{poster_url}})

## Sinossi
{{overview}}

## Dettagli
- **Rete**: {{network}}
- **Durata**: {{runtime}} min per episodio
- **Episodi**: {{aired_episodes}} trasmessi
- **Generi**: {{genres}}
- **Voto**: {{trakt_rating}}/10 ({{trakt_votes}} voti)
- **Classificazione**: {{certification}}
- **Stato**: {{status}}
- **Prima messa in onda**: {{first_aired}}

## Stato Trakt
- **Da vedere**: {{watchlist}}
- **Visto**: {{watched}} ({{plays}} volte, ultima: {{last_watched_at}})
- **Preferito**: {{favorite}}
- **Il mio voto**: {{my_rating}}/10

{{watch_history}}

## Link
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Note personali

`;

// ── [0.6.0] Spanish (es-ES) ──
export const DEFAULT_MOVIE_TEMPLATE_ES = `![poster]({{poster_url}})

> {{tagline}}

## Sinopsis
{{overview}}

## Detalles
- **Duración**: {{runtime}} min
- **Géneros**: {{genres}}
- **Calificación**: {{trakt_rating}}/10 ({{trakt_votes}} votos)
- **Clasificación**: {{certification}}
- **Estreno**: {{released}}

## Estado de Trakt
- **Quiero ver**: {{watchlist}}
- **Visto**: {{watched}} ({{plays}} veces, última: {{last_watched_at}})
- **Favorito**: {{favorite}}
- **Mi calificación**: {{my_rating}}/10

{{watch_history}}

## Enlaces
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Mis notas

`;

export const DEFAULT_SHOW_TEMPLATE_ES = `![poster]({{poster_url}})

## Sinopsis
{{overview}}

## Detalles
- **Cadena**: {{network}}
- **Duración**: {{runtime}} min por episodio
- **Episodios**: {{aired_episodes}} emitidos
- **Géneros**: {{genres}}
- **Calificación**: {{trakt_rating}}/10 ({{trakt_votes}} votos)
- **Clasificación**: {{certification}}
- **Estado**: {{status}}
- **Estreno**: {{first_aired}}

## Estado de Trakt
- **Quiero ver**: {{watchlist}}
- **Visto**: {{watched}} ({{plays}} veces, última: {{last_watched_at}})
- **Favorito**: {{favorite}}
- **Mi calificación**: {{my_rating}}/10

{{watch_history}}

## Enlaces
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Mis notas

`;

// ── [0.6.0] Portuguese — Brazil (pt-BR) ──
export const DEFAULT_MOVIE_TEMPLATE_PT = `![poster]({{poster_url}})

> {{tagline}}

## Sinopse
{{overview}}

## Detalhes
- **Duração**: {{runtime}} min
- **Gêneros**: {{genres}}
- **Avaliação**: {{trakt_rating}}/10 ({{trakt_votes}} votos)
- **Classificação**: {{certification}}
- **Lançamento**: {{released}}

## Status Trakt
- **Quero ver**: {{watchlist}}
- **Visto**: {{watched}} ({{plays}} vezes, última: {{last_watched_at}})
- **Favorito**: {{favorite}}
- **Minha avaliação**: {{my_rating}}/10

{{watch_history}}

## Links
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Minhas notas

`;

export const DEFAULT_SHOW_TEMPLATE_PT = `![poster]({{poster_url}})

## Sinopse
{{overview}}

## Detalhes
- **Rede**: {{network}}
- **Duração**: {{runtime}} min por episódio
- **Episódios**: {{aired_episodes}} exibidos
- **Gêneros**: {{genres}}
- **Avaliação**: {{trakt_rating}}/10 ({{trakt_votes}} votos)
- **Classificação**: {{certification}}
- **Status**: {{status}}
- **Estreia**: {{first_aired}}

## Status Trakt
- **Quero ver**: {{watchlist}}
- **Visto**: {{watched}} ({{plays}} vezes, última: {{last_watched_at}})
- **Favorito**: {{favorite}}
- **Minha avaliação**: {{my_rating}}/10

{{watch_history}}

## Links
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Minhas notas

`;

// ── [0.6.0] Russian (ru-RU) ──
export const DEFAULT_MOVIE_TEMPLATE_RU = `![poster]({{poster_url}})

> {{tagline}}

## Описание
{{overview}}

## Подробности
- **Длительность**: {{runtime}} мин
- **Жанры**: {{genres}}
- **Рейтинг**: {{trakt_rating}}/10 ({{trakt_votes}} голосов)
- **Возрастной рейтинг**: {{certification}}
- **Релиз**: {{released}}

## Статус Trakt
- **Хочу посмотреть**: {{watchlist}}
- **Просмотрено**: {{watched}} ({{plays}} раз, последний: {{last_watched_at}})
- **Избранное**: {{favorite}}
- **Моя оценка**: {{my_rating}}/10

{{watch_history}}

## Ссылки
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Мои заметки

`;

export const DEFAULT_SHOW_TEMPLATE_RU = `![poster]({{poster_url}})

## Описание
{{overview}}

## Подробности
- **Канал**: {{network}}
- **Длительность**: {{runtime}} мин на серию
- **Эпизодов**: {{aired_episodes}} вышло
- **Жанры**: {{genres}}
- **Рейтинг**: {{trakt_rating}}/10 ({{trakt_votes}} голосов)
- **Возрастной рейтинг**: {{certification}}
- **Статус**: {{status}}
- **Премьера**: {{first_aired}}

## Статус Trakt
- **Хочу посмотреть**: {{watchlist}}
- **Просмотрено**: {{watched}} ({{plays}} раз, последний: {{last_watched_at}})
- **Избранное**: {{favorite}}
- **Моя оценка**: {{my_rating}}/10

{{watch_history}}

## Ссылки
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## Мои заметки

`;

/**
 * Pick the bundled default movie template for a language code. Languages
 * without a bundled translation fall back to English — the user can still
 * customize the template by hand or pick a different `templateLanguage`.
 *
 * [0.6.0 / spec 0007] Bundled coverage expanded from 3 → 11 languages.
 * Accepts both BCP-47 locale codes (ja-JP, ko-KR, …) and bare language
 * codes (ja, ko, …) so users coming in via custom mode still resolve.
 */
export function getDefaultMovieTemplate(lang: string): string {
  switch ((lang || "").trim().toLowerCase()) {
    case "zh-cn": return DEFAULT_MOVIE_TEMPLATE_ZH_CN;
    case "zh-tw":
    case "zh-hk": return DEFAULT_MOVIE_TEMPLATE_ZH_TW;
    case "ja-jp":
    case "ja":    return DEFAULT_MOVIE_TEMPLATE_JA;
    case "ko-kr":
    case "ko":    return DEFAULT_MOVIE_TEMPLATE_KO;
    case "fr-fr":
    case "fr":    return DEFAULT_MOVIE_TEMPLATE_FR;
    case "de-de":
    case "de":    return DEFAULT_MOVIE_TEMPLATE_DE;
    case "it-it":
    case "it":    return DEFAULT_MOVIE_TEMPLATE_IT;
    case "es-es":
    case "es-mx":
    case "es":    return DEFAULT_MOVIE_TEMPLATE_ES;
    case "pt-br":
    case "pt":    return DEFAULT_MOVIE_TEMPLATE_PT;
    case "ru-ru":
    case "ru":    return DEFAULT_MOVIE_TEMPLATE_RU;
    default:      return DEFAULT_MOVIE_TEMPLATE_EN;
  }
}

export function getDefaultShowTemplate(lang: string): string {
  switch ((lang || "").trim().toLowerCase()) {
    case "zh-cn": return DEFAULT_SHOW_TEMPLATE_ZH_CN;
    case "zh-tw":
    case "zh-hk": return DEFAULT_SHOW_TEMPLATE_ZH_TW;
    case "ja-jp":
    case "ja":    return DEFAULT_SHOW_TEMPLATE_JA;
    case "ko-kr":
    case "ko":    return DEFAULT_SHOW_TEMPLATE_KO;
    case "fr-fr":
    case "fr":    return DEFAULT_SHOW_TEMPLATE_FR;
    case "de-de":
    case "de":    return DEFAULT_SHOW_TEMPLATE_DE;
    case "it-it":
    case "it":    return DEFAULT_SHOW_TEMPLATE_IT;
    case "es-es":
    case "es-mx":
    case "es":    return DEFAULT_SHOW_TEMPLATE_ES;
    case "pt-br":
    case "pt":    return DEFAULT_SHOW_TEMPLATE_PT;
    case "ru-ru":
    case "ru":    return DEFAULT_SHOW_TEMPLATE_RU;
    default:      return DEFAULT_SHOW_TEMPLATE_EN;
  }
}

/** Backward-compat aliases — anything that imported the old constant names
 * still sees the English defaults. */
export const DEFAULT_MOVIE_TEMPLATE = DEFAULT_MOVIE_TEMPLATE_EN;
export const DEFAULT_SHOW_TEMPLATE = DEFAULT_SHOW_TEMPLATE_EN;

/** All known default templates across (lang × type). Used to detect whether a
 * user's saved template still equals one of the defaults — if so, switching
 * templateLanguage rewrites it; if not (= user-customized), we leave it
 * alone. */
const ALL_DEFAULT_TEMPLATES: ReadonlyArray<string> = [
  DEFAULT_MOVIE_TEMPLATE_EN,    DEFAULT_SHOW_TEMPLATE_EN,
  DEFAULT_MOVIE_TEMPLATE_ZH_CN, DEFAULT_SHOW_TEMPLATE_ZH_CN,
  DEFAULT_MOVIE_TEMPLATE_ZH_TW, DEFAULT_SHOW_TEMPLATE_ZH_TW,
  DEFAULT_MOVIE_TEMPLATE_JA,    DEFAULT_SHOW_TEMPLATE_JA,
  DEFAULT_MOVIE_TEMPLATE_KO,    DEFAULT_SHOW_TEMPLATE_KO,
  DEFAULT_MOVIE_TEMPLATE_FR,    DEFAULT_SHOW_TEMPLATE_FR,
  DEFAULT_MOVIE_TEMPLATE_DE,    DEFAULT_SHOW_TEMPLATE_DE,
  DEFAULT_MOVIE_TEMPLATE_IT,    DEFAULT_SHOW_TEMPLATE_IT,
  DEFAULT_MOVIE_TEMPLATE_ES,    DEFAULT_SHOW_TEMPLATE_ES,
  DEFAULT_MOVIE_TEMPLATE_PT,    DEFAULT_SHOW_TEMPLATE_PT,
  DEFAULT_MOVIE_TEMPLATE_RU,    DEFAULT_SHOW_TEMPLATE_RU,
];

function isDefaultTemplate(value: string): boolean {
  return ALL_DEFAULT_TEMPLATES.includes(value);
}

export const DEFAULT_SETTINGS: TraktrSettings = {
  clientId: "",
  clientSecret: "",
  accessToken: "",
  refreshToken: "",
  tokenExpiresAt: 0,

  tmdbApiKey: "",
  posterSize: "w500",

  metadataLanguage: "",
  customMetadataLanguage: "",
  uiLanguage: "en",
  templateLanguage: "",
  customTemplateLanguage: "",

  propertyPrefix: "trakt_",

  folder: "trakt",
  filenameTemplate: "{{title}} ({{year}})",

  movieNoteTemplate: DEFAULT_MOVIE_TEMPLATE_EN,
  showNoteTemplate: DEFAULT_SHOW_TEMPLATE_EN,

  addTags: true,
  tagPrefix: "trakt",

  addTagNotes: false,
  createTagNotes: false,
  tagNotesFolder: "trakt",

  syncWatchlist: true,
  syncFavorites: true,
  syncWatched: false,
  syncWatchedDetail: false,
  syncRatings: false,

  syncMovies: true,
  syncShows: true,
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: 60,
  syncOnStartup: false,
  overwriteExisting: false,
  deleteRemovedItems: false,

  // [0.2.0] TMDB cache + history state defaults
  tmdbCache: {},
  tmdbCacheTtlDays: 90,
  historyState: { ...EMPTY_HISTORY_STATE },
  historyFullRefreshIntervalDays: 7,

  // [0.7.0] Daily Notes — disabled by default; user opts in via the
  // Daily Notes tab. See spec 0006 §"Defaults".
  dailyNotesEnabled: false,
  dailyNotesFolder: "Daily",
  dailyNotesFilenameFormat: "YYYY-MM-DD",
  dailyNotesMarkerStart: "%% trakt:daily:start %%",
  dailyNotesMarkerEnd: "%% trakt:daily:end %%",
  dailyNotesBackfillDays: 7,
  dailyNotesSyncMode: "default",
};

/**
 * [0.6.0] Settings page tab ids — see spec 0005. Persisted per-device
 * in localStorage so each Mac/iPhone remembers its own last-viewed tab.
 */
export type SettingsTabId = "general" | "notes" | "sync" | "daily";
const SETTINGS_TABS: ReadonlyArray<SettingsTabId> = [
  "general",
  "notes",
  "sync",
  "daily",
];
const ACTIVE_TAB_STORAGE_KEY = "sync-trakt:_activeSettingsTab";

export class TraktrSettingTab extends PluginSettingTab {
  plugin: TraktrPlugin;
  private activeTab: SettingsTabId = "general";

  constructor(app: App, plugin: TraktrPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * [0.6.0] Render the top tab bar. Clicking switches `activeTab`,
   * persists it to localStorage, and re-renders the whole settings UI.
   * See spec 0005 §"Implementation skeleton".
   */
  private renderTabBar(parent: HTMLElement): void {
    const t = getTranslator(this.plugin.settings.uiLanguage);
    const bar = parent.createDiv({ cls: "trakt-tab-bar" });
    for (const tabId of SETTINGS_TABS) {
      const btn = bar.createEl("button", {
        cls:
          "trakt-tab" + (tabId === this.activeTab ? " is-active" : ""),
        text: t(`tabs.${tabId}`),
      });
      btn.onclick = () => {
        this.activeTab = tabId;
        this.plugin.app.saveLocalStorage(ACTIVE_TAB_STORAGE_KEY, tabId);
        this.display();
      };
    }
  }

  /** Load the active tab from localStorage, falling back to "general". */
  private loadActiveTab(): SettingsTabId {
    const raw: unknown = this.plugin.app.loadLocalStorage(ACTIVE_TAB_STORAGE_KEY);
    if (typeof raw === "string" && (SETTINGS_TABS as readonly string[]).includes(raw)) {
      return raw as SettingsTabId;
    }
    return "general";
  }

  /**
   * [0.5.0] Attach the per-setting cloud icon to a Setting row. The icon
   * shows whether this key is currently synced (cloud) or device-local
   * (cloud-off). Clicking toggles the state and re-renders the tab so
   * any dependent UI updates accordingly. See spec 0003.
   */
  private addLocalToggle(setting: Setting, key: LocalEligibleKey): Setting {
    const t = getTranslator(this.plugin.settings.uiLanguage);
    return setting.addExtraButton((btn) => {
      const isLocal = this.plugin.localKeys.has(key);
      btn
        .setIcon(isLocal ? "cloud-off" : "cloud")
        .setTooltip(
          isLocal
            ? t("settings.cloud.local.tooltip")
            : t("settings.cloud.synced.tooltip"),
        )
        .onClick(async () => {
          await this.plugin.setKeyIsLocal(key, !isLocal);
          this.display();
        });
    });
  }

  /**
   * [0.7.0] Render the Daily Notes tab (spec 0006). Contains:
   *   - Enable toggle
   *   - Folder + filename format
   *   - Marker start / end strings
   *   - Live preview of 3 sample events
   *   - Source events reference table
   *   - Manual backfill slider + button (with confirmation modal)
   */
  private renderDailyNotesTab(
    containerEl: HTMLElement,
    t: ReturnType<typeof getTranslator>,
  ): void {
    new Setting(containerEl).setName(t("daily.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("daily.enabled.name"))
      .setDesc(t("daily.enabled.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.dailyNotesEnabled)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesEnabled = value;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (!this.plugin.settings.dailyNotesEnabled) return;

    new Setting(containerEl)
      .setName(t("daily.folder.name"))
      .setDesc(t("daily.folder.desc"))
      .addText((text) =>
        text
          .setPlaceholder("Daily")
          .setValue(this.plugin.settings.dailyNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("daily.format.name"))
      .setDesc(t("daily.format.desc"))
      .addText((text) =>
        // [0.8.1] No placeholder — the description already shows
        // YYYY-MM-DD as the canonical example, and the field is
        // pre-filled with the default format, so the placeholder
        // rarely surfaces. Avoids tripping the sentence-case lint
        // rule (which we're not allowed to disable per Obsidian's
        // directory submission rules).
        text
          .setValue(this.plugin.settings.dailyNotesFilenameFormat)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesFilenameFormat = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("daily.markerStart.name"))
      .setDesc(t("daily.marker.desc"))
      .addText((text) =>
        text
          .setPlaceholder("%% trakt:daily:start %%")
          .setValue(this.plugin.settings.dailyNotesMarkerStart)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesMarkerStart = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("daily.markerEnd.name"))
      .addText((text) =>
        text
          .setPlaceholder("%% trakt:daily:end %%")
          .setValue(this.plugin.settings.dailyNotesMarkerEnd)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesMarkerEnd = value;
            await this.plugin.saveSettings();
          }),
      );

    // Warning about not editing inside markers — stays in settings, never
    // injected into Daily Note itself (per user feedback during spec review).
    const warningEl = containerEl.createDiv({ cls: "trakt-daily-warning" });
    warningEl.setText(t("daily.warning"));

    // Live preview
    new Setting(containerEl)
      .setName(t("daily.preview.name"))
      .setDesc(t("daily.preview.desc"));
    const previewEl = containerEl.createDiv({ cls: "trakt-daily-preview" });
    previewEl.setText(renderPreview(this.plugin.settings));

    // Source events reference (static help text)
    new Setting(containerEl).setName(t("daily.sources.heading")).setHeading();
    new Setting(containerEl).setDesc(t("daily.sources.desc"));
    const sourcesEl = containerEl.createDiv({ cls: "trakt-daily-sources" });
    const sources = [
      "daily.sources.watched",
      "daily.sources.watchlist",
      "daily.sources.favorites",
      "daily.sources.ratings",
    ] as const;
    for (const key of sources) {
      const line = sourcesEl.createEl("div");
      line.setText("• " + t(key));
    }

    // Manual backfill — slider + button + modal
    new Setting(containerEl).setName(t("daily.backfill.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("daily.backfill.days.name"))
      .setDesc(t("daily.backfill.days.desc"))
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.dailyNotesBackfillDays)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesBackfillDays = value;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    new Setting(containerEl).addButton((btn) =>
      btn
        .setButtonText(
          t("daily.backfill.button", {
            days: this.plugin.settings.dailyNotesBackfillDays,
          }),
        )
        .onClick(() => {
          new BackfillConfirmModal(
            this.plugin.app,
            this.plugin.settings.dailyNotesBackfillDays,
            t,
            async () => {
              const host: DailyNotesHost = {
                app: this.plugin.app,
                settings: this.plugin.settings,
                saveSettings: () => this.plugin.saveSettings(),
                // Backfill uses the in-memory state from the last sync run.
                // Items collected when sync engine ran most recently.
                getMergedItems: () => this.plugin.lastMergedItems ?? [],
              };
              const { wrote, skipped } = await manualBackfill(
                host,
                this.plugin.settings.dailyNotesBackfillDays,
              );
              new Notice(t("daily.backfill.done", { wrote, skipped }), 8000);
            },
          ).open();
        }),
    );

    // [0.8.0] Sync mode selector + comparison table. Lives at the bottom
    // of the Daily Notes tab so users have all other config decided
    // before they pick the write strategy.
    new Setting(containerEl).setName(t("daily.syncMode.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("daily.syncMode.name"))
      .setDesc(t("daily.syncMode.desc"))
      .addDropdown((dd) =>
        dd
          .addOption("default", t("daily.syncMode.default"))
          .addOption("incremental", t("daily.syncMode.incremental"))
          .setValue(this.plugin.settings.dailyNotesSyncMode)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesSyncMode =
              value === "incremental" ? "incremental" : "default";
            await this.plugin.saveSettings();
          }),
      );

    // Comparison table — built with DOM API so cell text goes through
    // i18n. The row keys mirror the table in the design discussion.
    const tableRows: ReadonlyArray<{
      scenario: string;
      defaultCell: string;
      incrementalCell: string;
    }> = [
      {
        scenario: t("daily.syncMode.table.row.append.scenario"),
        defaultCell: t("daily.syncMode.table.row.append.default"),
        incrementalCell: t("daily.syncMode.table.row.append.incremental"),
      },
      {
        scenario: t("daily.syncMode.table.row.insert.scenario"),
        defaultCell: t("daily.syncMode.table.row.insert.default"),
        incrementalCell: t("daily.syncMode.table.row.insert.incremental"),
      },
      {
        scenario: t("daily.syncMode.table.row.delete.scenario"),
        defaultCell: t("daily.syncMode.table.row.delete.default"),
        incrementalCell: t("daily.syncMode.table.row.delete.incremental"),
      },
      {
        scenario: t("daily.syncMode.table.row.edit.scenario"),
        defaultCell: t("daily.syncMode.table.row.edit.default"),
        incrementalCell: t("daily.syncMode.table.row.edit.incremental"),
      },
      {
        scenario: t("daily.syncMode.table.row.lang.scenario"),
        defaultCell: t("daily.syncMode.table.row.lang.default"),
        incrementalCell: t("daily.syncMode.table.row.lang.incremental"),
      },
      {
        scenario: t("daily.syncMode.table.row.rating.scenario"),
        defaultCell: t("daily.syncMode.table.row.rating.default"),
        incrementalCell: t("daily.syncMode.table.row.rating.incremental"),
      },
      {
        scenario: t("daily.syncMode.table.row.removed.scenario"),
        defaultCell: t("daily.syncMode.table.row.removed.default"),
        incrementalCell: t("daily.syncMode.table.row.removed.incremental"),
      },
    ];

    const table = containerEl.createEl("table", {
      cls: "trakt-sync-mode-table",
    });
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: t("daily.syncMode.table.col.scenario") });
    headerRow.createEl("th", { text: t("daily.syncMode.table.col.default") });
    headerRow.createEl("th", {
      text: t("daily.syncMode.table.col.incremental"),
    });
    const tbody = table.createEl("tbody");
    for (const row of tableRows) {
      const tr = tbody.createEl("tr");
      tr.createEl("td", { text: row.scenario });
      tr.createEl("td", { text: row.defaultCell });
      tr.createEl("td", { text: row.incrementalCell });
    }
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const t = getTranslator(this.plugin.settings.uiLanguage);

    // [0.6.0] Tab navigation at the top — see spec 0005. The body
    // sections below are each gated by `this.activeTab` so only the
    // selected tab's content renders. Reset section (at the bottom of
    // the file) is also gated by "general" — it's logically part of the
    // General tab even though it lives at the end of display() for
    // historical reasons.
    this.activeTab = this.loadActiveTab();
    this.renderTabBar(containerEl);

    if (this.activeTab === "daily") {
      this.renderDailyNotesTab(containerEl, t);
      return;
    }

    if (this.activeTab === "general") {
    // [0.7.4] Version row at the top — read from manifest at render
    // time so we never have to remember to bump it here on release.
    new Setting(containerEl)
      .setName(t("plugin.version.name"))
      .setDesc(this.plugin.manifest.version);

    // ── Authentication ──
    new Setting(containerEl).setName(t("auth.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("auth.clientId.name"))
      .setDesc(t("auth.clientId.desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("auth.clientId.name"))
          .setValue(this.plugin.settings.clientId)
          .onChange(async (value) => {
            this.plugin.settings.clientId = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("auth.clientSecret.name"))
      .setDesc(t("auth.clientSecret.desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("auth.clientSecret.name"))
          .setValue(this.plugin.settings.clientSecret)
          .onChange(async (value) => {
            this.plugin.settings.clientSecret = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    const connectionSetting = new Setting(containerEl).setName(
      t("auth.connection.name"),
    );

    if (this.plugin.settings.accessToken) {
      connectionSetting.setDesc(t("auth.connection.connected"));
      connectionSetting.addButton((btn) =>
        btn
          .setButtonText(t("auth.connection.disconnect"))
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.accessToken = "";
            this.plugin.settings.refreshToken = "";
            this.plugin.settings.tokenExpiresAt = 0;
            await this.plugin.saveSettings();
            new Notice(t("auth.connection.disconnectedNotice"));
            this.display();
          }),
      );
    } else {
      connectionSetting.setDesc(t("auth.connection.notConnected"));
      connectionSetting.addButton((btn) =>
        btn
          .setButtonText(t("auth.connection.connect"))
          .setCta()
          .onClick(() => {
            if (
              !this.plugin.settings.clientId ||
              !this.plugin.settings.clientSecret
            ) {
              new Notice(t("auth.connection.needCredentialsNotice"));
              return;
            }
            this.plugin.startAuth();
            this.display();
          }),
      );
    }

    // Cross-device sync info — purely informational. The plugin doesn't
    // implement any sync itself; it relies on whatever vault-sync layer the
    // user already has (Obsidian Sync, Syncthing, iCloud, etc.). Surfacing
    // this here saves users the question "do I need to log in on every
    // device separately?".
    new Setting(containerEl)
      .setName(t("auth.sync.name"))
      .setDesc(t("auth.sync.desc"));

    // ── TMDB (poster images) ──
    new Setting(containerEl).setName(t("tmdb.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("tmdb.apiKey.name"))
      .setDesc(t("tmdb.apiKey.desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("tmdb.apiKey.placeholder"))
          .setValue(this.plugin.settings.tmdbApiKey)
          .onChange(async (value) => {
            this.plugin.settings.tmdbApiKey = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    // [0.3.2] Test button — verify the key works before relying on it
    // in a real sync. Result line lives directly under the button and is
    // re-rendered on each click. Empty input short-circuits without a
    // network call (verifyTmdbApiKey handles that case explicitly).
    const testSetting = new Setting(containerEl)
      .setName(t("tmdb.apiKey.test.name"))
      .setDesc(t("tmdb.apiKey.test.desc"));
    const testResultEl = testSetting.descEl.createDiv({
      cls: "trakt-test-result",
    });
    testSetting.addButton((btn) =>
      btn.setButtonText(t("tmdb.apiKey.test.button")).onClick(async () => {
        btn.setButtonText(t("tmdb.apiKey.test.testing")).setDisabled(true);
        testResultEl.empty();
        // Reset color modifier classes from any previous click
        testResultEl.classList.remove("is-ok", "is-error", "is-muted");
        try {
          const result = await verifyTmdbApiKey(this.plugin.settings.tmdbApiKey);
          if (result.ok) {
            testResultEl.classList.add("is-ok");
            testResultEl.setText(t("tmdb.apiKey.test.ok"));
          } else {
            testResultEl.classList.add(
              result.reason === "empty" ? "is-muted" : "is-error",
            );
            const key =
              result.reason === "empty"
                ? "tmdb.apiKey.test.empty"
                : result.reason === "unauthorized"
                  ? "tmdb.apiKey.test.unauthorized"
                  : "tmdb.apiKey.test.network";
            const base = t(key);
            testResultEl.setText(
              result.detail ? `${base} (${result.detail})` : base,
            );
          }
        } finally {
          btn.setButtonText(t("tmdb.apiKey.test.button")).setDisabled(false);
        }
      }),
    );

    new Setting(containerEl)
      .setName(t("tmdb.posterSize.name"))
      .setDesc(t("tmdb.posterSize.desc"))
      .addDropdown((dd) => {
        for (const size of POSTER_SIZES) {
          dd.addOption(size, size);
        }
        dd.setValue(this.plugin.settings.posterSize);
        dd.onChange(async (value) => {
          this.plugin.settings.posterSize = value as PosterSize;
          await this.plugin.saveSettings();
        });
      });

    // [0.2.0] TMDB cache controls — TTL dropdown + manual clear button.
    // Implemented to address the "every sync re-fetches all 1000+ items"
    // bottleneck reported by users. See spec 0001 §A for design.
    const cacheStats = tmdbCacheStats(this.plugin.settings.tmdbCache);
    const cacheStatsLabel = t("tmdb.cache.entries", {
      count: cacheStats.entries,
    });

    new Setting(containerEl)
      .setName(t("tmdb.cache.ttl.name"))
      .setDesc(t("tmdb.cache.ttl.desc"))
      .addDropdown((dd) => {
        dd.addOption("0", t("tmdb.cache.ttl.never"));
        dd.addOption("7", t("tmdb.cache.ttl.7"));
        dd.addOption("30", t("tmdb.cache.ttl.30"));
        dd.addOption("90", t("tmdb.cache.ttl.90"));
        dd.addOption("365", t("tmdb.cache.ttl.365"));
        dd.setValue(String(this.plugin.settings.tmdbCacheTtlDays));
        dd.onChange(async (value) => {
          this.plugin.settings.tmdbCacheTtlDays = parseInt(value, 10) || 0;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t("tmdb.cache.clear.name"))
      .setDesc(`${cacheStatsLabel}\n\n${t("tmdb.cache.clear.desc")}`)
      .addButton((btn) =>
        btn
          .setButtonText(t("tmdb.cache.clear.button"))
          .setWarning()
          .onClick(async () => {
            clearTmdbCache(this.plugin.settings.tmdbCache);
            await this.plugin.saveSettings();
            new Notice(t("tmdb.cache.clear.notice"));
            this.display();
          }),
      );

    }  // end of "general" tab — first half (Auth + TMDB)

    if (this.activeTab === "notes") {
    // ── Localization ──
    new Setting(containerEl).setName(t("loc.heading")).setHeading();

    const dropdownValue = isCustomLanguageMode(this.plugin.settings)
      ? "custom"
      : PRESET_LANGUAGE_VALUES.has(this.plugin.settings.metadataLanguage)
        ? this.plugin.settings.metadataLanguage
        : this.plugin.settings.metadataLanguage === ""
          ? ""
          : "custom";

    new Setting(containerEl)
      .setName(t("loc.metadataLanguage.name"))
      .setDesc(t("loc.metadataLanguage.desc"))
      .addDropdown((dd) => {
        for (const [value, label] of METADATA_LANGUAGE_PRESETS) {
          // The "" preset's label is localized via t(); other preset labels
          // stay in English (they ARE language names in their own language by
          // convention — "Chinese (Simplified)" reads fine on a Chinese UI).
          const localizedLabel =
            value === "" ? t("loc.metadataLanguage.default") : label;
          dd.addOption(value, localizedLabel);
        }
        dd.addOption("custom", t("loc.metadataLanguage.custom"));
        dd.setValue(dropdownValue);
        dd.onChange(async (value) => {
          if (value === "custom") {
            const previous = this.plugin.settings.metadataLanguage;
            if (
              previous &&
              previous !== "custom" &&
              !PRESET_LANGUAGE_VALUES.has(previous)
            ) {
              this.plugin.settings.customMetadataLanguage = previous;
            }
            this.plugin.settings.metadataLanguage = "custom";
          } else {
            this.plugin.settings.metadataLanguage = value;
          }
          await this.plugin.saveSettings();
          this.display();
        });
      });

    // [0.3.2] Inline warning when metadataLanguage is set but TMDB key is
    // missing. Surfaces what the user is actually getting from the Trakt
    // fallback (partial translation) vs what TMDB would unlock (full
    // translation + posters). Non-blocking — just informational.
    const langActive =
      this.plugin.settings.metadataLanguage !== "" &&
      this.plugin.settings.metadataLanguage !== undefined;
    const tmdbMissing = !this.plugin.settings.tmdbApiKey.trim();
    if (langActive && tmdbMissing) {
      const warningEl = containerEl.createDiv({ cls: "trakt-tmdb-warning" });
      warningEl.setText(t("loc.noTmdbWarning"));
    }

    if (dropdownValue === "custom") {
      new Setting(containerEl)
        .setName(t("loc.customLanguage.name"))
        .setDesc(t("loc.customLanguage.desc"))
        .addText((text) =>
          text
            .setPlaceholder(t("loc.customLanguage.placeholder"))
            .setValue(this.plugin.settings.customMetadataLanguage)
            .onChange(async (value) => {
              this.plugin.settings.customMetadataLanguage = value.trim();
              await this.plugin.saveSettings();
            }),
        );
    }

    // Plugin UI language
    this.addLocalToggle(
      new Setting(containerEl)
        .setName(t("loc.uiLanguage.name"))
        .setDesc(t("loc.uiLanguage.desc"))
        .addDropdown((dd) => {
          dd.addOption("en", "English");
          dd.addOption("zh-CN", "简体中文");
          dd.setValue(this.plugin.settings.uiLanguage);
          dd.onChange(async (value) => {
            this.plugin.settings.uiLanguage = value as UiLanguage;
            await this.plugin.saveSettings();
            this.display();
          });
        }),
      "uiLanguage",
    );

    // [0.6.0 / spec 0007] Note template language — only shows bundled
    // languages (11). Previously reused METADATA_LANGUAGE_PRESETS (15
    // entries) + a "custom" mode, which let users pick languages we'd
    // silently fall back to English on. Confusing. Now: the dropdown
    // shows exactly what's actually supported; if a user wants a
    // language not on this list, they Reset the template to default
    // (English) and customize manually.
    //
    // For 0.5.x users whose templateLanguage value isn't in the new
    // 11-set, the dropdown shows them at "default" (empty value) on
    // first 0.6.0 launch; their saved templateLanguage is preserved
    // in data.json until they pick something from the new dropdown.
    const tplDropdownValue = BUNDLED_TEMPLATE_LANGUAGE_VALUES.has(
      this.plugin.settings.templateLanguage,
    )
      ? this.plugin.settings.templateLanguage
      : "";

    const applyTemplateLanguageChange = (newLang: string): void => {
      // Only rewrite a saved template when it still matches one of the
      // bundled defaults — i.e. the user hasn't customized it.
      const movieDefault = getDefaultMovieTemplate(newLang);
      const showDefault = getDefaultShowTemplate(newLang);
      if (isDefaultTemplate(this.plugin.settings.movieNoteTemplate)) {
        this.plugin.settings.movieNoteTemplate = movieDefault;
      }
      if (isDefaultTemplate(this.plugin.settings.showNoteTemplate)) {
        this.plugin.settings.showNoteTemplate = showDefault;
      }
    };

    new Setting(containerEl)
      .setName(t("loc.templateLanguage.name"))
      .setDesc(t("loc.templateLanguage.desc"))
      .addDropdown((dd) => {
        for (const [value, label] of BUNDLED_TEMPLATE_LANGUAGES) {
          const localizedLabel =
            value === "" ? t("loc.metadataLanguage.default") : label;
          dd.addOption(value, localizedLabel);
        }
        dd.setValue(tplDropdownValue);
        dd.onChange(async (value) => {
          this.plugin.settings.templateLanguage = value;
          applyTemplateLanguageChange(value);
          await this.plugin.saveSettings();
          this.display();
        });
      });

    // ── Notes ──
    new Setting(containerEl).setName(t("notes.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("notes.folder.name"))
      .setDesc(t("notes.folder.desc"))
      .addText((text) =>
        text
          .setPlaceholder("Trakt")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("notes.filename.name"))
      .setDesc(t("notes.filename.desc"))
      .addText((text) =>
        text
          .setPlaceholder("{{title}} ({{year}})")
          .setValue(this.plugin.settings.filenameTemplate)
          .onChange(async (value) => {
            this.plugin.settings.filenameTemplate = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("notes.prefix.name"))
      .setDesc(t("notes.prefix.desc"))
      .addText((text) =>
        text
          .setPlaceholder("Trakt_")
          .setValue(this.plugin.settings.propertyPrefix)
          .onChange(async (value) => {
            this.plugin.settings.propertyPrefix = value;
            await this.plugin.saveSettings();
          }),
      );

    // ── Note templates ──
    new Setting(containerEl).setName(t("templates.heading")).setHeading();

    const movieTemplateSetting = new Setting(containerEl)
      .setName(t("templates.movie.name"))
      .setDesc(t("templates.movie.desc"));
    movieTemplateSetting.addTextArea((ta) => {
      ta.inputEl.rows = 12;
      ta.inputEl.cols = 60;
      ta.setValue(this.plugin.settings.movieNoteTemplate).onChange(
        async (value) => {
          this.plugin.settings.movieNoteTemplate = value;
          await this.plugin.saveSettings();
        },
      );
    });
    movieTemplateSetting.addButton((btn) =>
      btn.setButtonText(t("templates.reset")).onClick(async () => {
        this.plugin.settings.movieNoteTemplate = getDefaultMovieTemplate(
          this.plugin.settings.templateLanguage,
        );
        await this.plugin.saveSettings();
        this.display();
      }),
    );

    const showTemplateSetting = new Setting(containerEl)
      .setName(t("templates.show.name"))
      .setDesc(t("templates.show.desc"));
    showTemplateSetting.addTextArea((ta) => {
      ta.inputEl.rows = 12;
      ta.inputEl.cols = 60;
      ta.setValue(this.plugin.settings.showNoteTemplate).onChange(
        async (value) => {
          this.plugin.settings.showNoteTemplate = value;
          await this.plugin.saveSettings();
        },
      );
    });
    showTemplateSetting.addButton((btn) =>
      btn.setButtonText(t("templates.reset")).onClick(async () => {
        this.plugin.settings.showNoteTemplate = getDefaultShowTemplate(
          this.plugin.settings.templateLanguage,
        );
        await this.plugin.saveSettings();
        this.display();
      }),
    );

    // ── Tags ──
    new Setting(containerEl).setName(t("tags.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("tags.add.name"))
      .setDesc(t("tags.add.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.addTags)
          .onChange(async (value) => {
            this.plugin.settings.addTags = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("tags.prefix.name"))
      .setDesc(t("tags.prefix.desc"))
      .addText((text) =>
        text
          .setPlaceholder("Trakt")
          .setValue(this.plugin.settings.tagPrefix)
          .onChange(async (value) => {
            this.plugin.settings.tagPrefix = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    // ── Tag notes ──
    new Setting(containerEl)
      .setName(t("tagNotes.heading"))
      .setDesc(t("tagNotes.heading.desc"))
      .setHeading();

    new Setting(containerEl)
      .setName(t("tagNotes.add.name"))
      .setDesc(t("tagNotes.add.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.addTagNotes)
          .onChange(async (value) => {
            this.plugin.settings.addTagNotes = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("tagNotes.create.name"))
      .setDesc(t("tagNotes.create.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.createTagNotes)
          .onChange(async (value) => {
            this.plugin.settings.createTagNotes = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("tagNotes.folder.name"))
      .setDesc(t("tagNotes.folder.desc"))
      .addText((text) =>
        text
          .setPlaceholder("Trakt")
          .setValue(this.plugin.settings.tagNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.tagNotesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    }  // end of "notes" tab

    if (this.activeTab === "sync") {
    // ── Sync sources ──
    new Setting(containerEl).setName(t("syncSources.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("syncSources.watchlist.name"))
      .setDesc(t("syncSources.watchlist.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncWatchlist)
          .onChange(async (value) => {
            this.plugin.settings.syncWatchlist = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("syncSources.favorites.name"))
      .setDesc(t("syncSources.favorites.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncFavorites)
          .onChange(async (value) => {
            this.plugin.settings.syncFavorites = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("syncSources.watched.name"))
      .setDesc(t("syncSources.watched.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncWatched)
          .onChange(async (value) => {
            this.plugin.settings.syncWatched = value;
            // syncWatchedDetail is meaningless without syncWatched, so clear
            // it when the parent flips off — keeps settings consistent and
            // avoids surprise behavior next time syncWatched is re-enabled.
            if (!value) this.plugin.settings.syncWatchedDetail = false;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.syncWatched) {
      new Setting(containerEl)
        .setName(t("syncSources.watchedDetail.name"))
        .setDesc(t("syncSources.watchedDetail.desc"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.syncWatchedDetail)
            .onChange(async (value) => {
              this.plugin.settings.syncWatchedDetail = value;
              await this.plugin.saveSettings();
              this.display();
            }),
        );

      // [0.2.0] Detailed-history controls — only meaningful when detail
      // sync is on. Lets the user tune how often the plugin re-pulls the
      // full history (to detect deletions on Trakt's side that an
      // incremental fetch can't see), and shows current state stats +
      // a manual clear button.
      if (this.plugin.settings.syncWatchedDetail) {
        const historyStats = historyStateStats(
          this.plugin.settings.historyState,
        );
        const historyStatsLabel = t("history.state.stats", {
          movies: historyStats.movies,
          shows: historyStats.shows,
          events: historyStats.events,
        });

        new Setting(containerEl)
          .setName(t("history.fullRefreshInterval.name"))
          .setDesc(t("history.fullRefreshInterval.desc"))
          .addSlider((slider) =>
            slider
              .setLimits(1, 30, 1)
              .setValue(this.plugin.settings.historyFullRefreshIntervalDays)
              .setDynamicTooltip()
              .onChange(async (value) => {
                this.plugin.settings.historyFullRefreshIntervalDays = value;
                await this.plugin.saveSettings();
              }),
          );

        new Setting(containerEl)
          .setName(t("history.state.clear.name"))
          .setDesc(`${historyStatsLabel}\n\n${t("history.state.clear.desc")}`)
          .addButton((btn) =>
            btn
              .setButtonText(t("history.state.clear.button"))
              .setWarning()
              .onClick(async () => {
                clearHistoryState(this.plugin.settings.historyState);
                await this.plugin.saveSettings();
                new Notice(t("history.state.clear.notice"));
                this.display();
              }),
          );
      }
    }

    new Setting(containerEl)
      .setName(t("syncSources.ratings.name"))
      .setDesc(t("syncSources.ratings.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncRatings)
          .onChange(async (value) => {
            this.plugin.settings.syncRatings = value;
            await this.plugin.saveSettings();
          }),
      );

    // ── Sync behavior ──
    new Setting(containerEl).setName(t("syncBehavior.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("syncBehavior.movies.name"))
      .setDesc(t("syncBehavior.movies.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncMovies)
          .onChange(async (value) => {
            this.plugin.settings.syncMovies = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("syncBehavior.shows.name"))
      .setDesc(t("syncBehavior.shows.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncShows)
          .onChange(async (value) => {
            this.plugin.settings.syncShows = value;
            await this.plugin.saveSettings();
          }),
      );

    this.addLocalToggle(
      new Setting(containerEl)
        .setName(t("syncBehavior.startup.name"))
        .setDesc(t("syncBehavior.startup.desc"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.syncOnStartup)
            .onChange(async (value) => {
              this.plugin.settings.syncOnStartup = value;
              await this.plugin.saveSettings();
            }),
        ),
      "syncOnStartup",
    );

    this.addLocalToggle(
      new Setting(containerEl)
        .setName(t("syncBehavior.autoSync.name"))
        .setDesc(t("syncBehavior.autoSync.desc"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.autoSyncEnabled)
            .onChange(async (value) => {
              this.plugin.settings.autoSyncEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.configureAutoSync();
              this.display();
            }),
        ),
      "autoSyncEnabled",
    );

    if (this.plugin.settings.autoSyncEnabled) {
      this.addLocalToggle(
        new Setting(containerEl)
          .setName(t("syncBehavior.interval.name"))
          .setDesc(t("syncBehavior.interval.desc"))
          .addSlider((slider) =>
            slider
              .setLimits(5, 360, 5)
              .setValue(this.plugin.settings.autoSyncIntervalMinutes)
              .setDynamicTooltip()
              .onChange(async (value) => {
                this.plugin.settings.autoSyncIntervalMinutes = value;
                await this.plugin.saveSettings();
                this.plugin.configureAutoSync();
              }),
          ),
        "autoSyncIntervalMinutes",
      );
    }

    new Setting(containerEl)
      .setName(t("syncBehavior.overwrite.name"))
      .setDesc(t("syncBehavior.overwrite.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.overwriteExisting)
          .onChange(async (value) => {
            this.plugin.settings.overwriteExisting = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("syncBehavior.delete.name"))
      .setDesc(t("syncBehavior.delete.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.deleteRemovedItems)
          .onChange(async (value) => {
            this.plugin.settings.deleteRemovedItems = value;
            await this.plugin.saveSettings();
          }),
      );

    }  // end of "sync" tab

    if (this.activeTab === "general") {
    // ── Reset ──
    new Setting(containerEl).setName(t("reset.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("reset.button.name"))
      .setDesc(t("reset.button.desc"))
      .addButton((btn) =>
        btn
          .setButtonText(t("reset.button.name"))
          .setWarning()
          .onClick(async () => {
            const {
              accessToken,
              refreshToken,
              clientId,
              clientSecret,
              tokenExpiresAt,
              tmdbApiKey,
              uiLanguage,
            } = this.plugin.settings;
            // Preserve auth + UI language across reset; everything else
            // goes back to its default.
            Object.assign(this.plugin.settings, DEFAULT_SETTINGS, {
              accessToken,
              refreshToken,
              clientId,
              clientSecret,
              tokenExpiresAt,
              tmdbApiKey,
              uiLanguage,
            });
            await this.plugin.saveSettings();
            this.plugin.configureAutoSync();
            new Notice(t("reset.notice"));
            this.display();
          }),
      );
    }  // end of "general" tab — second half (Reset)
  }
}

/**
 * [0.7.0] Confirmation modal for the manual backfill button (spec 0006).
 * Explains the safety rules in plain language before the user can
 * confirm a potentially-disruptive operation.
 */
class BackfillConfirmModal extends Modal {
  private days: number;
  private translate: ReturnType<typeof getTranslator>;
  private onConfirm: () => Promise<void>;

  constructor(
    app: App,
    days: number,
    translate: ReturnType<typeof getTranslator>,
    onConfirm: () => Promise<void>,
  ) {
    super(app);
    this.days = days;
    this.translate = translate;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.translate("daily.backfill.modal.title", { days: this.days }));

    // Multi-line body — split on \n so each paragraph renders separately
    const body = this.translate("daily.backfill.modal.body", { days: this.days });
    for (const para of body.split("\n")) {
      if (para.trim() === "") {
        contentEl.createEl("br");
      } else {
        contentEl.createEl("p", { text: para });
      }
    }

    const btnContainer = contentEl.createDiv({ cls: "trakt-modal-buttons" });
    const cancelBtn = btnContainer.createEl("button", {
      text: this.translate("daily.backfill.modal.cancel"),
    });
    cancelBtn.onclick = () => this.close();

    const confirmBtn = btnContainer.createEl("button", {
      text: this.translate("daily.backfill.modal.confirm"),
      cls: "mod-cta",
    });
    confirmBtn.onclick = async () => {
      this.close();
      await this.onConfirm();
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
