import { requestUrl } from "obsidian";
import type { PosterSize } from "./settings";
import type {
  TmdbCache,
  TmdbCacheEntry,
  TmdbTranslationData,
} from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const SIMPLIFIED_ONLY_TITLE_CHARS =
  "钢铁国剧话后发云龙马爱体边这过东叶万为无乐们见点车长汉湾台广丽门书";
const TRADITIONAL_ONLY_TITLE_CHARS =
  "鋼鐵國劇話後發雲龍馬愛體邊這過東葉萬為無樂們見點車長漢灣臺廣麗門書";

/**
 * One day in ms. Used for TTL math + jitter.
 */
const ONE_DAY_MS = 86_400_000;

/**
 * Per-entry random jitter applied to TMDB cache TTL. With ±5 days, 1000+
 * entries cached at the same time spread their expirations across a 10-day
 * window, so revalidation load is steady instead of bursty.
 */
const TMDB_CACHE_JITTER_MS = 5 * ONE_DAY_MS;

/**
 * Sentinel used inside `expires_at` for entries that should never expire.
 * Picked so that `Date.now() < expires_at` is always true within JS's safe
 * integer range (year ~275760).
 */
const NEVER_EXPIRES = Number.MAX_SAFE_INTEGER;

export type TmdbTranslation = TmdbTranslationData;

export interface TmdbMetadata {
  poster_url: string;
  translation: TmdbTranslation | null;
}

export interface TmdbTranslationEntry {
  iso_639_1: string;
  iso_3166_1: string;
  data: {
    title?: string;
    name?: string;
    overview?: string;
    tagline?: string;
  };
}

export interface TmdbMovieResponse {
  poster_path: string | null;
  original_title?: string;
  original_name?: string;
  title?: string;
  name?: string;
  original_language?: string;
  overview?: string;
  tagline?: string;
  genres?: { name?: string }[];
  translations?: { translations: TmdbTranslationEntry[] };
}

/**
 * Compose the cache key for an item. Mirrors spec 0001 §A "Storage". Type
 * disambiguates movie vs show with the same TMDB id; language gives each
 * locale its own slot (so switching from `zh-CN` to `ja-JP` is a clean
 * cache miss for ja-JP, not a wrong cache hit).
 */
export function tmdbCacheKey(
  mediaType: "movie" | "tv",
  tmdbId: number,
  language: string,
  fallback: string = "",
): string {
  const langPart = language || "default";
  // [0.9.0] Fallback enables strict-match mode in pickBestTranslation, which
  // produces a DIFFERENT filtered translation from the same raw data. Bake
  // it into the cache key so toggling fallback on/off invalidates entries
  // correctly. When fallback is "" (the default for upgraders), the key is
  // byte-identical to pre-0.9.0 — existing cached entries stay valid.
  if (fallback) {
    return `${mediaType}:${tmdbId}:${langPart}:fb=${fallback}`;
  }
  return `${mediaType}:${tmdbId}:${langPart}`;
}

/**
 * Compute when a freshly written cache entry should expire.
 *
 * - `ttlDays === 0` → never expire (`Number.MAX_SAFE_INTEGER`)
 * - otherwise → `now + ttlDays + uniformRandom(±5 days)`, clamped to ≥ 1 day
 */
export function computeCacheExpiry(ttlDays: number, now = Date.now()): number {
  if (ttlDays <= 0) return NEVER_EXPIRES;
  const baseMs = ttlDays * ONE_DAY_MS;
  const jitterMs = (Math.random() - 0.5) * 2 * TMDB_CACHE_JITTER_MS;
  return now + Math.max(ONE_DAY_MS, baseMs + jitterMs);
}

/**
 * Pure-data check: is a given entry fresh, stale, or fully expired? Pulled
 * out of the fetch path so smoke tests can verify staleness logic without
 * mocking time-of-day.
 */
export function cacheEntryFreshness(
  entry: TmdbCacheEntry | undefined,
  now = Date.now(),
): "missing" | "fresh" | "stale" {
  if (!entry) return "missing";
  return entry.expires_at > now ? "fresh" : "stale";
}

/**
 * Background revalidations are tracked here so that two concurrent fetches
 * for the same key don't issue duplicate API calls. Cleared when a
 * revalidation finishes (success or failure).
 */
const inFlightRevalidations = new Set<string>();

/**
 * Public entry point. Always cache-aware; see header comment in spec 0001
 * §A "Lazy revalidation". Behavior:
 *
 *   - cache hit + fresh    → return cached, no API call
 *   - cache hit + stale    → return cached immediately, fire-and-forget
 *                             a background fetch that updates the cache on
 *                             success (silently keeps stale on failure)
 *   - cache miss           → fetch synchronously, write the result, return
 *
 * The `cache` parameter is mutated in place — caller is expected to
 * `saveSettings()` after the surrounding sync run completes. We don't save
 * per-call to avoid serializing data.json hundreds of times during one sync.
 */
/**
 * [0.3.2] Verify a TMDB API key works by hitting `/configuration` — a
 * lightweight endpoint that returns image-base URLs and rate-limit info,
 * authenticated the same way as the real fetch endpoints we use elsewhere.
 *
 * Returns a discriminated union so callers can render the right message
 * without re-parsing error strings.
 *
 * Designed for a settings-tab "Test" button — runs once, never cached,
 * never touches the persistent TMDB cache. Empty input is a fast-path
 * `{ ok: false, reason: "empty" }` so the button can show a sensible
 * error without making a network call.
 */
export type TmdbVerifyResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "unauthorized" | "network"; detail?: string };

export async function verifyTmdbApiKey(
  apiKey: string,
): Promise<TmdbVerifyResult> {
  const key = apiKey.trim();
  if (!key) return { ok: false, reason: "empty" };

  const url = `${TMDB_BASE}/configuration?api_key=${encodeURIComponent(key)}`;
  try {
    const response = await requestUrl({
      url,
      method: "GET",
      // `throw: false` so we can inspect the status code on 401/404 etc.
      // instead of catching a generic exception. TMDB returns 401 for an
      // invalid key (with a `status_message` JSON body) which is what we
      // want to surface verbatim to the user.
      throw: false,
    });
    if (response.status === 200) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      // Try to extract TMDB's own "Invalid API key" message for the
      // tooltip — falls back to a generic string on parse failure.
      let detail: string | undefined;
      try {
        const body = response.json as { status_message?: string };
        detail = body?.status_message;
      } catch {
        /* ignore — detail stays undefined */
      }
      return { ok: false, reason: "unauthorized", detail };
    }
    return {
      ok: false,
      reason: "network",
      detail: `HTTP ${response.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      reason: "network",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function fetchMovieMetadata(
  tmdbId: number,
  apiKey: string,
  size: PosterSize,
  language: string,
  cache: TmdbCache,
  ttlDays: number,
  fallbackLanguage: string = "",
): Promise<TmdbMetadata> {
  return fetchTmdbMetadataCached(
    "movie",
    tmdbId,
    apiKey,
    size,
    language,
    cache,
    ttlDays,
    fallbackLanguage,
  );
}

export async function fetchTvMetadata(
  tmdbId: number,
  apiKey: string,
  size: PosterSize,
  language: string,
  cache: TmdbCache,
  ttlDays: number,
  fallbackLanguage: string = "",
): Promise<TmdbMetadata> {
  return fetchTmdbMetadataCached(
    "tv",
    tmdbId,
    apiKey,
    size,
    language,
    cache,
    ttlDays,
    fallbackLanguage,
  );
}

async function fetchTmdbMetadataCached(
  mediaType: "movie" | "tv",
  tmdbId: number,
  apiKey: string,
  size: PosterSize,
  language: string,
  cache: TmdbCache,
  ttlDays: number,
  fallbackLanguage: string = "",
): Promise<TmdbMetadata> {
  const key = tmdbCacheKey(mediaType, tmdbId, language, fallbackLanguage);
  const entry = cache[key];
  const freshness = cacheEntryFreshness(entry);

  if (freshness === "fresh" && entry) {
    // Hot path: every steady-state sync hits this for items we've already
    // seen. Zero API calls, zero await of network.
    return { poster_url: entry.poster_url, translation: entry.translation };
  }

  if (freshness === "stale" && entry) {
    // Stale-while-revalidate: serve the cached value now, fire a
    // background fetch that updates the cache on success. If the
    // background fetch fails, the stale entry stays — user sees old data
    // until the next successful revalidation, but never sees an empty.
    if (!inFlightRevalidations.has(key)) {
      inFlightRevalidations.add(key);
      void revalidateInBackground(
        mediaType,
        tmdbId,
        apiKey,
        size,
        language,
        cache,
        ttlDays,
        key,
        fallbackLanguage,
      );
    }
    return { poster_url: entry.poster_url, translation: entry.translation };
  }

  // Miss → fetch synchronously, write to cache.
  const fresh = await fetchTmdbMetadata(
    mediaType,
    tmdbId,
    apiKey,
    size,
    language,
    fallbackLanguage,
  );
  // Only cache successful fetches. A response that's both empty AND has no
  // poster suggests TMDB returned an error or we got rate-limited; we'd
  // rather retry next time than cache a placeholder.
  if (fresh.poster_url || fresh.translation || !language) {
    cache[key] = {
      poster_url: fresh.poster_url,
      translation: fresh.translation,
      cached_at: Date.now(),
      expires_at: computeCacheExpiry(ttlDays),
    };
  }
  return fresh;
}

async function revalidateInBackground(
  mediaType: "movie" | "tv",
  tmdbId: number,
  apiKey: string,
  size: PosterSize,
  language: string,
  cache: TmdbCache,
  ttlDays: number,
  key: string,
  fallbackLanguage: string = "",
): Promise<void> {
  try {
    const fresh = await fetchTmdbMetadata(
      mediaType,
      tmdbId,
      apiKey,
      size,
      language,
      fallbackLanguage,
    );
    if (fresh.poster_url || fresh.translation || !language) {
      cache[key] = {
        poster_url: fresh.poster_url,
        translation: fresh.translation,
        cached_at: Date.now(),
        expires_at: computeCacheExpiry(ttlDays),
      };
    }
    // Else: revalidation came back empty. Keep the existing stale entry.
  } catch (e) {
    console.warn(
      `TMDB background revalidation failed for ${key}; keeping stale entry`,
      e,
    );
  } finally {
    inFlightRevalidations.delete(key);
  }
}

/**
 * Drop every TMDB cache entry. Exposed so the settings UI button +
 * `Traktr: Clear TMDB cache` command can wire to the same call.
 */
export function clearTmdbCache(cache: TmdbCache): void {
  for (const k of Object.keys(cache)) delete cache[k];
}

/**
 * Cache observability for the settings UI. Returns the entry count + a
 * rough byte estimate for the description ("3,127 entries, ~1.5 MB").
 */
export function tmdbCacheStats(cache: TmdbCache): {
  entries: number;
  approxBytes: number;
} {
  const entries = Object.keys(cache).length;
  // Each entry is roughly: key string (40 chars) + 5 fields. Real measure
  // would require JSON.stringify which is expensive on large caches; this
  // estimate is good enough for UI rendering and avoids the perf hit.
  const approxBytes = entries * 500;
  return { entries, approxBytes };
}

// ─────────────────────────────────────────────────────────────────────
// Below: the original (non-cached) fetch path, plus the translation
// picker. Internal — public callers go through fetchMovieMetadata /
// fetchTvMetadata which handle caching automatically.
// ─────────────────────────────────────────────────────────────────────

async function fetchTmdbMetadata(
  mediaType: "movie" | "tv",
  tmdbId: number,
  apiKey: string,
  size: PosterSize,
  language: string,
  fallbackLanguage: string = "",
): Promise<TmdbMetadata> {
  try {
    const params = new URLSearchParams({ api_key: apiKey });
    if (language) {
      params.set("language", language);
      params.set("append_to_response", "translations");
    }
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

    const data = resp.json as TmdbMovieResponse;
    let posterPath = data.poster_path;

    // Poster fallback: if a language-specific request returned null, retry
    // without `language` to get the default poster. One extra call only
    // for items where the localized request didn't have a poster.
    if (language && !posterPath) {
      try {
        const fbParams = new URLSearchParams({ api_key: apiKey });
        const fbResp = await requestUrl({
          url: `${TMDB_BASE}/${mediaType}/${tmdbId}?${fbParams.toString()}`,
          method: "GET",
          headers: { "Content-Type": "application/json" },
          throw: false,
        });
        if (fbResp.status === 200) {
          const fbData = fbResp.json as TmdbMovieResponse;
          posterPath = fbData.poster_path;
        }
      } catch (e) {
        console.warn(
          `TMDB poster fallback error for ${mediaType}/${tmdbId}:`,
          e,
        );
      }
    }

    const poster_url = posterPath
      ? `${TMDB_IMAGE_BASE}/${size}${posterPath}`
      : "";

    if (!language) {
      return { poster_url, translation: null };
    }

    const translation = pickBestTranslation(
      data,
      language,
      mediaType,
      fallbackLanguage,
    );
    return { poster_url, translation };
  } catch (e) {
    console.warn(`TMDB lookup error for ${mediaType}/${tmdbId}:`, e);
    return { poster_url: "", translation: null };
  }
}

/**
 * Walk the translations array client-side to find the best variant in the
 * user's language family. Workaround for TMDB's documented "title locked
 * blank for zh-CN" quirk — see spec 0001 §Context for details.
 *
 * [0.9.0] When `fallbackLanguage` is non-empty, switches to strict-match
 * semantics (spec 0008): only an EXACT lang+country entry counts as the
 * primary; if not present, try strict-match the fallback; if neither
 * present, return null (caller keeps the English original). The pre-0.9.0
 * loose-match behaviour (zh-CN finds zh-TW via family fallback) is
 * preserved when `fallbackLanguage` is empty.
 */
export function pickBestTranslation(
  data: TmdbMovieResponse,
  language: string,
  mediaType: "movie" | "tv",
  fallbackLanguage: string = "",
): TmdbTranslation | null {
  const titleField = mediaType === "movie" ? data.title : data.name;
  const originalField =
    mediaType === "movie" ? data.original_title : data.original_name;
  const mainTitle = (titleField || "").trim();
  const mainOriginal = (originalField || "").trim();
  const mainOverview = (data.overview || "").trim();
  const mainTagline = (data.tagline || "").trim();
  const mainTitleDiffersFromOriginal =
    mainTitle.length > 0 && mainTitle !== mainOriginal;
  const mainTitleMatchesRequestedOriginalLanguage =
    titleMatchesRequestedOriginalLocale(
      mainTitle,
      language,
      data.original_language || "",
    );
  const mainTitleUsableForRequestedLanguage =
    mainTitleDiffersFromOriginal || mainTitleMatchesRequestedOriginalLanguage;
  const mainGenres = (data.genres || [])
    .map((g) => (g.name || "").trim())
    .filter((n) => n.length > 0);

  // [0.9.0] Strict mode — never substitute country variants.
  if (fallbackLanguage) {
    const all = data.translations?.translations || [];
    const primary = pickStrictTmdb(all, language, mediaType, mainGenres);
    if (primary) {
      const title =
        primary.title ||
        (mainTitleUsableForRequestedLanguage ? mainTitle : primary.title);
      return {
        ...primary,
        title,
      };
    }
    if (mainTitleUsableForRequestedLanguage) {
      return {
        title: mainTitle,
        overview: mainOverview,
        tagline: mainTagline,
        genres: mainGenres,
      };
    }
    return (
      pickStrictTmdb(all, fallbackLanguage, mediaType, mainGenres) ||
      null
    );
  }

  const mainLooksLocalized =
    mainTitleUsableForRequestedLanguage;

  const candidates = orderCandidates(
    data.translations?.translations || [],
    language,
  );

  const fromCandidate = (
    field: "title" | "overview" | "tagline",
  ): string => {
    for (const c of candidates) {
      const value =
        field === "title"
          ? mediaType === "movie"
            ? c.data.title
            : c.data.name
          : field === "overview"
            ? c.data.overview
            : c.data.tagline;
      if (value && value.trim().length > 0) return value.trim();
    }
    return "";
  };

  if (mainLooksLocalized) {
    return {
      title: mainTitle,
      overview: mainOverview || fromCandidate("overview"),
      tagline: mainTagline || fromCandidate("tagline"),
      genres: mainGenres,
    };
  }

  const candidateTitle = fromCandidate("title");
  const candidateOverview = fromCandidate("overview");
  const candidateTagline = fromCandidate("tagline");

  if (
    candidateTitle.length === 0 &&
    candidateOverview.length === 0 &&
    candidateTagline.length === 0
  ) {
    return null;
  }

  return {
    title: candidateTitle,
    overview: candidateOverview,
    tagline: candidateTagline,
    genres: mainGenres,
  };
}

function baseLanguageCode(language: string): string {
  return (language || "").split("-")[0].toLowerCase();
}

function chineseScriptPreference(
  language: string,
): "simplified" | "traditional" | "unspecified" {
  const subtags = (language || "").split("-");
  const normalized = subtags.map((part) => part.toLowerCase());
  if (normalized.includes("hans")) return "simplified";
  if (normalized.includes("hant")) return "traditional";

  const region = subtags
    .slice(1)
    .find((part) => /^[a-zA-Z]{2}$/.test(part))
    ?.toUpperCase();
  if (region === "CN" || region === "SG" || region === "MY") {
    return "simplified";
  }
  if (region === "TW" || region === "HK" || region === "MO") {
    return "traditional";
  }
  return "unspecified";
}

function containsAnyChar(value: string, chars: string): boolean {
  for (const char of chars) {
    if (value.includes(char)) return true;
  }
  return false;
}

function titleMatchesRequestedOriginalLocale(
  title: string,
  requestedLanguage: string,
  originalLanguage: string,
): boolean {
  const requestedBase = baseLanguageCode(requestedLanguage);
  const originalBase = baseLanguageCode(originalLanguage);
  if (!title || !requestedBase || requestedBase !== originalBase) {
    return false;
  }
  if (requestedBase !== "zh") return true;

  const preference = chineseScriptPreference(requestedLanguage);
  if (preference === "simplified") {
    return !containsAnyChar(title, TRADITIONAL_ONLY_TITLE_CHARS);
  }
  if (preference === "traditional") {
    return !containsAnyChar(title, SIMPLIFIED_ONLY_TITLE_CHARS);
  }
  return true;
}

/**
 * [0.9.0] Strict-match a single language entry from the TMDB translations
 * array. Unlike `orderCandidates` (which spreads to a whole country family),
 * this returns the SINGLE entry that matches lang+country exactly — or any
 * entry of that language when the request carries no country part. Returns
 * null if no entry has usable title/overview/tagline content, so the caller
 * can advance to the next fallback level.
 *
 * `mainGenres` is taken from the top-level `?language=` response (which is
 * what TMDB returns in the user's requested locale, or the original
 * language if that locale doesn't exist). Genres aren't part of the
 * per-translation entry on TMDB, so they ride along with whichever
 * translation we pick.
 */
function pickStrictTmdb(
  all: ReadonlyArray<TmdbTranslationEntry>,
  language: string,
  mediaType: "movie" | "tv",
  mainGenres: string[],
): TmdbTranslation | null {
  const parts = language.split("-");
  const langCode = (parts[0] || "").toLowerCase();
  const country = (parts[1] || "").toUpperCase();
  if (!langCode) return null;

  const entry = country
    ? all.find(
        (t) =>
          (t.iso_639_1 || "").toLowerCase() === langCode &&
          (t.iso_3166_1 || "").toUpperCase() === country,
      )
    : all.find((t) => (t.iso_639_1 || "").toLowerCase() === langCode);
  if (!entry) return null;

  const title = (
    (mediaType === "movie" ? entry.data.title : entry.data.name) || ""
  ).trim();
  const overview = (entry.data.overview || "").trim();
  const tagline = (entry.data.tagline || "").trim();

  if (title.length === 0 && overview.length === 0 && tagline.length === 0) {
    return null;
  }

  return { title, overview, tagline, genres: mainGenres };
}

function orderCandidates(
  all: ReadonlyArray<TmdbTranslationEntry>,
  language: string,
): TmdbTranslationEntry[] {
  const parts = language.split("-");
  const langCode = (parts[0] || "").toLowerCase();
  const country = (parts[1] || "").toUpperCase();
  if (!langCode) return [];

  const sameLang = all.filter(
    (t) => (t.iso_639_1 || "").toLowerCase() === langCode,
  );
  if (sameLang.length === 0) return [];

  const familyFallback: Record<string, string[]> = {
    zh: ["CN", "TW", "HK", "SG"],
    en: ["US", "GB", "AU", "CA"],
    es: ["ES", "MX", "AR"],
    pt: ["BR", "PT"],
    fr: ["FR", "CA"],
  };
  const ordered: string[] = [];
  if (country) ordered.push(country);
  for (const fb of familyFallback[langCode] || []) {
    if (!ordered.includes(fb)) ordered.push(fb);
  }

  const ranked: TmdbTranslationEntry[] = [];
  for (const c of ordered) {
    const match = sameLang.find((t) => t.iso_3166_1 === c);
    if (match) ranked.push(match);
  }
  for (const t of sameLang) {
    if (!ranked.includes(t)) ranked.push(t);
  }
  return ranked;
}
