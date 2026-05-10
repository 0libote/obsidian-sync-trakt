import { requestUrl } from "obsidian";
import type { PosterSize } from "./settings";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface TmdbTranslation {
  title: string;
  overview: string;
  tagline: string;
  genres: string[];
}

export interface TmdbMetadata {
  poster_url: string;
  translation: TmdbTranslation | null;
}

/**
 * Fetch poster URL (and, when language is non-empty, translated metadata) for
 * a movie by its TMDB ID. Returns empty poster_url + null translation on any
 * error so callers can fall back gracefully.
 */
export async function fetchMovieMetadata(
  tmdbId: number,
  apiKey: string,
  size: PosterSize,
  language: string,
): Promise<TmdbMetadata> {
  return fetchTmdbMetadata("movie", tmdbId, apiKey, size, language);
}

/**
 * Fetch poster URL (and, when language is non-empty, translated metadata) for
 * a TV show by its TMDB ID.
 */
export async function fetchTvMetadata(
  tmdbId: number,
  apiKey: string,
  size: PosterSize,
  language: string,
): Promise<TmdbMetadata> {
  return fetchTmdbMetadata("tv", tmdbId, apiKey, size, language);
}

async function fetchTmdbMetadata(
  mediaType: "movie" | "tv",
  tmdbId: number,
  apiKey: string,
  size: PosterSize,
  language: string,
): Promise<TmdbMetadata> {
  try {
    const params = new URLSearchParams({ api_key: apiKey });
    if (language) params.set("language", language);
    const resp = await requestUrl({
      url: `${TMDB_BASE}/${mediaType}/${tmdbId}?${params.toString()}`,
      method: "GET",
      headers: { "Content-Type": "application/json" },
      throw: false,
    });

    if (resp.status !== 200) {
      console.warn(
        `TMDB lookup failed for ${mediaType}/${tmdbId}: ${resp.status}`,
      );
      return { poster_url: "", translation: null };
    }

    const data = resp.json as {
      poster_path: string | null;
      title?: string;
      name?: string;
      overview?: string;
      tagline?: string;
      genres?: { name?: string }[];
    };

    const poster_url = data.poster_path
      ? `${TMDB_IMAGE_BASE}/${size}${data.poster_path}`
      : "";

    if (!language) {
      return { poster_url, translation: null };
    }

    const translation: TmdbTranslation = {
      title: (mediaType === "movie" ? data.title : data.name) || "",
      overview: data.overview || "",
      tagline: data.tagline || "",
      genres: (data.genres || [])
        .map((g) => (g.name || "").trim())
        .filter((n) => n.length > 0),
    };
    return { poster_url, translation };
  } catch (e) {
    console.warn(`TMDB lookup error for ${mediaType}/${tmdbId}:`, e);
    return { poster_url: "", translation: null };
  }
}
