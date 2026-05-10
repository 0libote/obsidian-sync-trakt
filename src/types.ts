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
  removed: number;
  failed: number;
  errors: string[];
}
