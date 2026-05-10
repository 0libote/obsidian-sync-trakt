// ── Trakt API Response Types ──

export interface TraktIds {
  trakt: number;
  slug: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
}

export interface TraktMovie {
  title: string;
  year: number;
  ids: TraktIds;
  tagline?: string;
  overview?: string;
  released?: string;
  runtime?: number;
  country?: string;
  genres?: string[];
  rating?: number;
  votes?: number;
  certification?: string;
  language?: string;
  status?: string;
}

export interface TraktShow {
  title: string;
  year: number;
  ids: TraktIds;
  overview?: string;
  first_aired?: string;
  runtime?: number;
  certification?: string;
  network?: string;
  country?: string;
  genres?: string[];
  aired_episodes?: number;
  rating?: number;
  votes?: number;
  language?: string;
  status?: string;
}

export interface TraktWatchlistItem {
  rank: number;
  id: number;
  listed_at: string;
  notes: string | null;
  type: "movie" | "show";
  movie?: TraktMovie;
  show?: TraktShow;
}

export interface TraktWatchedMovieItem {
  plays: number;
  last_watched_at: string;
  last_updated_at: string;
  movie: TraktMovie;
}

export interface TraktWatchedShowItem {
  plays: number;
  last_watched_at: string;
  last_updated_at: string;
  show: TraktShow;
  seasons?: TraktWatchedSeason[];
}

export interface TraktWatchedSeason {
  number: number;
  episodes: TraktWatchedEpisode[];
}

export interface TraktWatchedEpisode {
  number: number;
  plays: number;
  last_watched_at: string;
}

export interface TraktFavoriteItem {
  rank: number;
  id: number;
  listed_at: string;
  notes: string | null;
  type: "movie" | "show";
  movie?: TraktMovie;
  show?: TraktShow;
}

export interface TraktRatingItem {
  rated_at: string;
  rating: number;
  type: "movie" | "show";
  movie?: TraktMovie;
  show?: TraktShow;
}

/** Single entry from `/sync/history` — one row per individual watch event.
 * Re-watches show up as multiple entries with the same movie/episode ids. */
export interface TraktHistoryItem {
  id: number;
  watched_at: string;
  action: string;
  type: "episode" | "movie";
  episode?: {
    season: number;
    number: number;
    title?: string;
    ids: { trakt: number; tvdb?: number; imdb?: string; tmdb?: number };
  };
  show?: TraktShow;
  movie?: TraktMovie;
}

export interface TraktDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

export interface TraktTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: number;
}

// ── TMDB API Response Types ──

export interface TmdbMovieResponse {
  id: number;
  poster_path: string | null;
}

export interface TmdbTvResponse {
  id: number;
  poster_path: string | null;
}

// ── Internal Types ──

export type ItemType = "movie" | "show";

/** Per-episode entry in a show's detailed watch history. `watched_at` holds
 * every timestamp this episode was watched, in chronological order; same
 * episode watched twice → two strings. Episode title is best-effort (Trakt
 * may not include it on every history endpoint response). */
export interface EpisodeWatchHistory {
  season: number;
  episode: number;
  title?: string;
  watched_at: string[];
}

/**
 * Persistent aggregated state for the detailed watch history. Lives in
 * `data.json` under `settings.historyState`. See spec 0001 for design.
 *
 * - `byMovie` / `byShow`: ready-to-render aggregations keyed by Trakt id.
 * - `knownEventIds`: every individual watch-event id we've ingested. Used
 *   on full refresh to detect deletions (events present here but absent
 *   from the new full pull were deleted on Trakt).
 * - `lastIncrementalSyncAt`: ISO-8601. Next sync queries
 *   `/sync/history?start_at=<this>`. Empty string means we haven't
 *   incrementally synced yet — caller should treat that as "do a full
 *   pull this time."
 * - `lastFullRefreshAt`: ISO-8601. When `now - this >
 *   historyFullRefreshIntervalDays`, the next sync triggers a full pull
 *   to catch deletions.
 */
export interface HistoryState {
  byMovie: { [traktMovieId: number]: string[] };
  byShow: { [traktShowId: number]: EpisodeWatchHistory[] };
  knownEventIds: number[];
  lastIncrementalSyncAt: string;
  lastFullRefreshAt: string;
}

export const EMPTY_HISTORY_STATE: HistoryState = {
  byMovie: {},
  byShow: {},
  knownEventIds: [],
  lastIncrementalSyncAt: "",
  lastFullRefreshAt: "",
};

/**
 * Single TMDB cache entry. Stored under `settings.tmdbCache[key]` where
 * `key` is `${type}:${tmdbId}:${language || 'default'}`.
 *
 * `expires_at` includes a per-entry random jitter so 1000+ entries
 * cached at once don't all expire on the same day — see spec 0001.
 */
export interface TmdbCacheEntry {
  poster_url: string;
  translation: TmdbTranslationData | null;
  cached_at: number;
  expires_at: number;
}

/** Cached form of a TMDB translation. Mirrors `TmdbTranslation` from
 * tmdb-api.ts but lives here in types.ts so the cache's data shape is
 * declared independently of the API client. */
export interface TmdbTranslationData {
  title: string;
  overview: string;
  tagline: string;
  genres: string[];
}

export interface TmdbCache {
  [key: string]: TmdbCacheEntry;
}

export interface NormalizedItem {
  type: ItemType;
  title: string;
  year: number;
  ids: TraktIds;
  overview: string;
  genres: string[];
  runtime: number;
  rating: number;
  votes: number;
  certification: string;
  country: string;
  language: string;
  status: string;
  // Movie-specific
  tagline?: string;
  released?: string;
  // Show-specific
  network?: string;
  aired_episodes?: number;
  first_aired?: string;
  // TMDB poster
  poster_url?: string;
  // Originals (always English from Trakt). Surface-level fields above may be
  // overridden by translations when metadataLanguage is set; these always
  // hold the source-language values so tags and {{original_*}} stay stable.
  originalTitle: string;
  originalOverview: string;
  originalTagline?: string;
  originalGenres: string[];
  // Source flags (populated during merge)
  watchlist?: boolean;
  watchlist_added_at?: string;
  watched?: boolean;
  plays?: number;
  last_watched_at?: string;
  episodes_watched?: number;
  // Detailed watch history — populated only when settings.syncWatchedDetail is
  // on AND this item appears in /sync/history. Movies use watch_history_movie
  // (every watched_at timestamp); shows use watch_history_episodes (per-S/E
  // grouping with one or more timestamps each).
  watch_history_movie?: string[];
  watch_history_episodes?: EpisodeWatchHistory[];
  favorite?: boolean;
  favorited_at?: string;
  my_rating?: number;
  rated_at?: string;
}

export interface SyncResult {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  failed: number;
  errors: string[];
}
