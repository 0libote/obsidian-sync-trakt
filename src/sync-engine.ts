import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { TraktrSettings } from "./settings";
import { getEffectiveMetadataLanguage } from "./settings";
import { getTranslator } from "./i18n";
import type {
  TraktWatchlistItem,
  TraktWatchedMovieItem,
  TraktWatchedShowItem,
  TraktFavoriteItem,
  TraktRatingItem,
  TraktHistoryItem,
  NormalizedItem,
  SyncResult,
  TraktMovie,
  TraktShow,
  TraktIds,
  ItemType,
  EpisodeWatchHistory,
} from "./types";
import {
  fetchWatchlist,
  fetchWatchedMovies,
  fetchWatchedShows,
  fetchFavorites,
  fetchRatings,
  fetchHistory,
  fetchTraktTranslations,
  pickTraktTranslation,
} from "./trakt-api";
import { fetchMovieMetadata, fetchTvMetadata } from "./tmdb-api";
import { ensureValidToken } from "./trakt-auth";
import {
  renderNote,
  buildFrontmatterData,
  updateManagedBodySections,
} from "./note-renderer";
import { sanitizeFilename, renderTemplate, parseFrontmatter } from "./utils";

// ── Normalization helpers ──

function baseFromMovie(m: TraktMovie): NormalizedItem {
  const overview = m.overview || "";
  const genres = m.genres || [];
  return {
    type: "movie",
    title: m.title,
    year: m.year,
    ids: m.ids,
    overview,
    genres,
    runtime: m.runtime || 0,
    rating: m.rating || 0,
    votes: m.votes || 0,
    certification: m.certification || "",
    country: m.country || "",
    language: m.language || "",
    status: m.status || "",
    tagline: m.tagline,
    released: m.released,
    originalTitle: m.title,
    originalOverview: overview,
    originalTagline: m.tagline,
    originalGenres: [...genres],
  };
}

function baseFromShow(s: TraktShow): NormalizedItem {
  const overview = s.overview || "";
  const genres = s.genres || [];
  return {
    type: "show",
    title: s.title,
    year: s.year,
    ids: s.ids,
    overview,
    genres,
    runtime: s.runtime || 0,
    rating: s.rating || 0,
    votes: s.votes || 0,
    certification: s.certification || "",
    country: s.country || "",
    language: s.language || "",
    status: s.status || "",
    network: s.network,
    aired_episodes: s.aired_episodes,
    first_aired: s.first_aired,
    originalTitle: s.title,
    originalOverview: overview,
    originalGenres: [...genres],
  };
}

/**
 * Apply a translation overlay to an item in place. Empty strings are treated
 * as "no translation" — TMDB returns "" rather than null when a field has no
 * translation in the requested language. originalTitle / originalOverview /
 * originalTagline / originalGenres are populated by base*() and never
 * overwritten here, so they always hold the source-language values.
 */
function applyTranslation(
  item: NormalizedItem,
  translation: {
    title?: string;
    overview?: string;
    tagline?: string;
    genres?: string[];
  },
): void {
  if (translation.title) item.title = translation.title;
  if (translation.overview) item.overview = translation.overview;
  if (translation.tagline) item.tagline = translation.tagline;
  if (translation.genres && translation.genres.length > 0) {
    item.genres = translation.genres;
  }
}

function itemKey(type: ItemType, traktId: number): string {
  return `${type}:${traktId}`;
}

// ── Watch history aggregation ──
//
// Both helpers walk a /sync/history page and group its rows by item id. They
// only ATTACH timestamps to items already present in the merged map — so an
// item the user has watched but doesn't have via watchlist/watched/favorite/
// rating won't accidentally get a note created. (In practice anyone calling
// fetchHistory has syncWatched on, which already populates the map from
// `/sync/watched/*`.)

function chronologicalSort(timestamps: string[]): string[] {
  // ISO-8601 strings sort lexicographically the same as chronologically when
  // they all share the same offset (Trakt uses UTC `Z`), so a plain string
  // sort is safe and avoids new Date() per element.
  return [...timestamps].sort();
}

export function aggregateMovieHistory(
  history: ReadonlyArray<TraktHistoryItem>,
  map: Map<string, NormalizedItem>,
): void {
  // Group all "movie" history rows by trakt id.
  const byTraktId = new Map<number, string[]>();
  for (const row of history) {
    if (row.type !== "movie" || !row.movie) continue;
    const traktId = row.movie.ids.trakt;
    const list = byTraktId.get(traktId);
    if (list) list.push(row.watched_at);
    else byTraktId.set(traktId, [row.watched_at]);
  }
  for (const [traktId, timestamps] of byTraktId) {
    const item = map.get(itemKey("movie", traktId));
    if (!item) continue;
    item.watch_history_movie = chronologicalSort(timestamps);
  }
}

export function aggregateShowHistory(
  history: ReadonlyArray<TraktHistoryItem>,
  map: Map<string, NormalizedItem>,
): void {
  // Group "episode" rows by show trakt id, then within each show by S/E.
  // Each (show, season, episode) accumulates the list of watched_at strings.
  const byShow = new Map<number, Map<string, EpisodeWatchHistory>>();
  for (const row of history) {
    if (row.type !== "episode" || !row.show || !row.episode) continue;
    const showId = row.show.ids.trakt;
    const seKey = `${row.episode.season}:${row.episode.number}`;

    let perEpisode = byShow.get(showId);
    if (!perEpisode) {
      perEpisode = new Map();
      byShow.set(showId, perEpisode);
    }
    let entry = perEpisode.get(seKey);
    if (!entry) {
      entry = {
        season: row.episode.season,
        episode: row.episode.number,
        title: row.episode.title,
        watched_at: [],
      };
      perEpisode.set(seKey, entry);
    }
    entry.watched_at.push(row.watched_at);
  }

  for (const [showId, perEpisode] of byShow) {
    const item = map.get(itemKey("show", showId));
    if (!item) continue;
    const episodes: EpisodeWatchHistory[] = [];
    for (const entry of perEpisode.values()) {
      episodes.push({
        season: entry.season,
        episode: entry.episode,
        title: entry.title,
        watched_at: chronologicalSort(entry.watched_at),
      });
    }
    // Stable order: by season ascending, then episode ascending. Lets the
    // template render `S1E1, S1E2, …, S2E1` predictably.
    episodes.sort(
      (a, b) => a.season - b.season || a.episode - b.episode,
    );
    item.watch_history_episodes = episodes;
  }
}

function getOrCreateItem(
  map: Map<string, NormalizedItem>,
  ids: TraktIds,
  type: ItemType,
  movie?: TraktMovie,
  show?: TraktShow
): NormalizedItem {
  const key = itemKey(type, ids.trakt);
  const existing = map.get(key);
  if (existing) return existing;

  let item: NormalizedItem;
  if (type === "movie" && movie) {
    item = baseFromMovie(movie);
  } else if (type === "show" && show) {
    item = baseFromShow(show);
  } else {
    throw new Error(`Cannot create item: missing ${type} data`);
  }

  map.set(key, item);
  return item;
}

// ── Folder & file helpers ──

async function ensureFolder(app: App, path: string): Promise<void> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFolder) return;
  if (!existing) {
    await app.vault.createFolder(path);
  }
}

function buildFilename(item: NormalizedItem, template: string): string {
  const context: Record<string, unknown> = {
    title: item.title,
    year: item.year,
    imdb_id: item.ids.imdb || "",
    trakt_id: item.ids.trakt,
  };
  return sanitizeFilename(renderTemplate(template, context));
}

/**
 * Scan a folder for notes and build a composite "type:trakt_id" → TFile map
 * from frontmatter. Reading both t_id and t_type avoids collisions between
 * movies and shows that share the same numeric Trakt ID.
 */
async function scanExistingNotes(
  app: App,
  folderPath: string,
  propertyPrefix: string
): Promise<Map<string, TFile>> {
  const map = new Map<string, TFile>();
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!(folder instanceof TFolder)) return map;

  const idKey = `${propertyPrefix}id`;
  const typeKey = `${propertyPrefix}type`;

  for (const child of folder.children) {
    if (!(child instanceof TFile) || child.extension !== "md") continue;
    const content = await app.vault.cachedRead(child);
    const { frontmatter } = parseFrontmatter(content);
    const traktId = parseInt(frontmatter[idKey], 10);
    const type = frontmatter[typeKey];
    if (!isNaN(traktId) && (type === "movie" || type === "show")) {
      map.set(itemKey(type, traktId), child);
    }
  }

  return map;
}

// ── Sync Engine ──

export class SyncEngine {
  private app: App;
  private settings: TraktrSettings;
  private saveSettings: () => Promise<void>;
  private syncing = false;

  constructor(
    app: App,
    settings: TraktrSettings,
    saveSettings: () => Promise<void>
  ) {
    this.app = app;
    this.settings = settings;
    this.saveSettings = saveSettings;
  }

  async sync(): Promise<SyncResult> {
    const t = getTranslator(this.settings.uiLanguage);
    if (this.syncing) {
      new Notice(t("notice.alreadySyncing"));
      return { added: 0, updated: 0, removed: 0, failed: 0, errors: [] };
    }

    this.syncing = true;
    const result: SyncResult = {
      added: 0,
      updated: 0,
      removed: 0,
      failed: 0,
      errors: [],
    };

    console.debug("[Traktr] Sync started");
    try {
      // 1. Ensure valid token
      await ensureValidToken(this.settings, this.saveSettings);

      // 2. Fetch from all enabled sources in parallel, merging into a single
      //    map keyed by "type:trakt_id" to avoid cross-type ID collisions.
      const merged = new Map<string, NormalizedItem>();

      await Promise.all([
        this.settings.syncMovies ? this.fetchAndMergeMovies(merged) : Promise.resolve(),
        this.settings.syncShows ? this.fetchAndMergeShows(merged) : Promise.resolve(),
      ]);

      // 3. Ensure tag note files exist
      await this.ensureTagNotes(merged);

      // 4. Reconcile all items into the single notes folder
      await this.reconcileType(merged, result);

      // 5. Show result
      console.debug(`[Traktr] Sync complete — added: ${result.added}, updated: ${result.updated}, removed: ${result.removed}, failed: ${result.failed}`);
      let msg = t("notice.syncComplete", {
        added: result.added,
        updated: result.updated,
        removed: result.removed,
      });
      if (result.failed > 0) {
        msg += t("notice.syncCompleteWithFailures", { failed: result.failed });
        console.error(`[Traktr] Sync completed with ${result.failed} failure(s):`);
        for (const err of result.errors) {
          console.error(err);
        }
      }
      new Notice(msg, result.failed > 0 ? 10000 : 5000);
      if (result.failed > 0) {
        const more =
          result.errors.length > 1
            ? t("notice.syncMore", { count: result.errors.length - 1 })
            : "";
        new Notice(`${t("status.prefix")}${result.errors[0]}${more}`, 10000);
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Unknown error during sync.";
      console.error("[Traktr] Sync failed:", e);
      new Notice(t("notice.syncFailed", { msg }), 10000);
      result.errors.push(msg);
    } finally {
      this.syncing = false;
    }

    return result;
  }

  /**
   * Create tag note files for all tag notes referenced by the merged items.
   * Only creates files that don't already exist — never overwrites.
   */
  private async ensureTagNotes(
    mergedItems: Map<string, NormalizedItem>
  ): Promise<void> {
    if (!this.settings.createTagNotes) return;

    const folder = this.settings.tagNotesFolder;
    const pfx = folder ? `${folder}/` : "";

    // Collect all unique note paths (without .md extension). Genre paths use
    // the original (English) genre list so tag-note files don't churn or
    // duplicate when the user switches metadata languages.
    const paths = new Set<string>();
    for (const item of mergedItems.values()) {
      paths.add(`${pfx}${item.type}`);
      for (const genre of item.originalGenres) {
        paths.add(`${pfx}genre/${genre}`);
      }
      if (item.watchlist) paths.add(`${pfx}watchlist`);
      if (item.watched) paths.add(`${pfx}watched`);
      if (item.favorite) paths.add(`${pfx}favorite`);
      if (item.my_rating) paths.add(`${pfx}rated`);
    }

    for (const notePath of paths) {
      const filePath = normalizePath(`${notePath}.md`);
      // Ensure parent folder(s) exist
      const lastSlash = filePath.lastIndexOf("/");
      if (lastSlash > 0) {
        await ensureFolder(this.app, filePath.slice(0, lastSlash));
      }
      // Create file only if it doesn't already exist
      if (!this.app.vault.getAbstractFileByPath(filePath)) {
        await this.app.vault.create(filePath, "");
      }
    }
  }

  /**
   * Fetch from all enabled sources for movies in parallel and merge into map.
   */
  private async fetchAndMergeMovies(
    map: Map<string, NormalizedItem>
  ): Promise<void> {
    const { clientId, accessToken } = this.settings;
    // syncWatchedDetail is gated behind syncWatched so we never fetch a huge
    // history list for someone who hasn't even opted into watch sync.
    const fetchDetail = this.settings.syncWatched && this.settings.syncWatchedDetail;

    const [
      watchlistItems,
      watchedItems,
      favoriteItems,
      ratingItems,
      historyItems,
    ] = await Promise.all([
      this.settings.syncWatchlist ? fetchWatchlist("movies", clientId, accessToken) : Promise.resolve([] as TraktWatchlistItem[]),
      this.settings.syncWatched ? fetchWatchedMovies(clientId, accessToken) : Promise.resolve([] as TraktWatchedMovieItem[]),
      this.settings.syncFavorites ? fetchFavorites("movies", clientId, accessToken) : Promise.resolve([] as TraktFavoriteItem[]),
      this.settings.syncRatings ? fetchRatings("movies", clientId, accessToken) : Promise.resolve([] as TraktRatingItem[]),
      fetchDetail ? fetchHistory("movies", clientId, accessToken) : Promise.resolve([] as TraktHistoryItem[]),
    ]);

    for (const raw of watchlistItems) {
      if (!raw.movie) continue;
      const item = getOrCreateItem(map, raw.movie.ids, "movie", raw.movie);
      item.watchlist = true;
      item.watchlist_added_at = raw.listed_at;
    }

    for (const raw of watchedItems) {
      const item = getOrCreateItem(map, raw.movie.ids, "movie", raw.movie);
      item.watched = true;
      item.plays = raw.plays;
      item.last_watched_at = raw.last_watched_at;
    }

    for (const raw of favoriteItems) {
      if (!raw.movie) continue;
      const item = getOrCreateItem(map, raw.movie.ids, "movie", raw.movie);
      item.favorite = true;
      item.favorited_at = raw.listed_at;
    }

    for (const raw of ratingItems) {
      if (!raw.movie) continue;
      const item = getOrCreateItem(map, raw.movie.ids, "movie", raw.movie);
      item.my_rating = raw.rating;
      item.rated_at = raw.rated_at;
    }

    if (fetchDetail) aggregateMovieHistory(historyItems, map);
  }

  /**
   * Fetch from all enabled sources for shows in parallel and merge into map.
   */
  private async fetchAndMergeShows(
    map: Map<string, NormalizedItem>
  ): Promise<void> {
    const { clientId, accessToken } = this.settings;
    const fetchDetail = this.settings.syncWatched && this.settings.syncWatchedDetail;

    const [
      watchlistItems,
      watchedItems,
      favoriteItems,
      ratingItems,
      historyItems,
    ] = await Promise.all([
      this.settings.syncWatchlist ? fetchWatchlist("shows", clientId, accessToken) : Promise.resolve([] as TraktWatchlistItem[]),
      this.settings.syncWatched ? fetchWatchedShows(clientId, accessToken) : Promise.resolve([] as TraktWatchedShowItem[]),
      this.settings.syncFavorites ? fetchFavorites("shows", clientId, accessToken) : Promise.resolve([] as TraktFavoriteItem[]),
      this.settings.syncRatings ? fetchRatings("shows", clientId, accessToken) : Promise.resolve([] as TraktRatingItem[]),
      fetchDetail ? fetchHistory("episodes", clientId, accessToken) : Promise.resolve([] as TraktHistoryItem[]),
    ]);

    for (const raw of watchlistItems) {
      if (!raw.show) continue;
      const item = getOrCreateItem(map, raw.show.ids, "show", undefined, raw.show);
      item.watchlist = true;
      item.watchlist_added_at = raw.listed_at;
    }

    for (const raw of watchedItems) {
      const item = getOrCreateItem(map, raw.show.ids, "show", undefined, raw.show);
      item.watched = true;
      item.plays = raw.plays;
      item.last_watched_at = raw.last_watched_at;
      if (raw.seasons) {
        item.episodes_watched = raw.seasons.reduce(
          (sum, s) => sum + s.episodes.length,
          0
        );
      }
    }

    for (const raw of favoriteItems) {
      if (!raw.show) continue;
      const item = getOrCreateItem(map, raw.show.ids, "show", undefined, raw.show);
      item.favorite = true;
      item.favorited_at = raw.listed_at;
    }

    for (const raw of ratingItems) {
      if (!raw.show) continue;
      const item = getOrCreateItem(map, raw.show.ids, "show", undefined, raw.show);
      item.my_rating = raw.rating;
      item.rated_at = raw.rated_at;
    }

    if (fetchDetail) aggregateShowHistory(historyItems, map);
  }

  /**
   * Fetch a translation from Trakt's /translations/{lang} endpoint and apply
   * it to the item. Only used when no TMDB API key is configured (or the item
   * has no TMDB ID), since Trakt translations cover title/overview/tagline
   * but not genres.
   */
  private async applyTraktTranslation(
    item: NormalizedItem,
    language: string,
  ): Promise<void> {
    const traktType = item.type === "movie" ? "movies" : "shows";
    const translations = await fetchTraktTranslations(
      traktType,
      item.ids.trakt,
      language,
      this.settings.clientId,
    );
    const picked = pickTraktTranslation(translations, language);
    if (!picked) return;
    applyTranslation(item, {
      title: picked.title,
      overview: picked.overview,
      tagline: picked.tagline,
      // No genre data on this endpoint — leave originalGenres / genres alone.
      genres: undefined,
    });
  }

  /**
   * Reconcile merged items against the vault.
   */
  private async reconcileType(
    mergedItems: Map<string, NormalizedItem>,
    result: SyncResult
  ): Promise<void> {
    const folderPath = normalizePath(this.settings.folder);
    await ensureFolder(this.app, folderPath);

    const localNotes = await scanExistingNotes(
      this.app,
      folderPath,
      this.settings.propertyPrefix
    );

    // Fetch poster + (optionally) translation in a single TMDB call per item.
    // When metadataLanguage is unset, the call shape is unchanged from the
    // pre-i18n version, so default behavior is byte-stable.
    const language = getEffectiveMetadataLanguage(this.settings);
    if (this.settings.tmdbApiKey) {
      await Promise.all(
        [...mergedItems.values()].map(async (item) => {
          if (!item.ids.tmdb) {
            // No TMDB ID — try Trakt's translation endpoint as a fallback when
            // i18n is enabled. Posters require TMDB, so we skip those.
            if (language) {
              await this.applyTraktTranslation(item, language);
            }
            return;
          }
          const fetcher =
            item.type === "movie" ? fetchMovieMetadata : fetchTvMetadata;
          const meta = await fetcher(
            item.ids.tmdb,
            this.settings.tmdbApiKey,
            this.settings.posterSize,
            language,
          );
          item.poster_url = meta.poster_url;
          if (meta.translation) {
            applyTranslation(item, meta.translation);
          }
        })
      );
    } else if (language) {
      // No TMDB key + i18n enabled → fall back to Trakt's translation endpoint.
      await Promise.all(
        [...mergedItems.values()].map((item) =>
          this.applyTraktTranslation(item, language),
        ),
      );
    }

    // Create or update notes
    for (const [key, item] of mergedItems) {
      try {
        const existingFile = localNotes.get(key);

        if (!existingFile) {
          // CREATE
          const filename = buildFilename(item, this.settings.filenameTemplate);
          const filePath = normalizePath(`${folderPath}/${filename}.md`);
          await this.app.vault.create(filePath, renderNote(item, this.settings));
          result.added++;
        } else {
          // UPDATE
          if (this.settings.overwriteExisting) {
            // Replace full note content atomically
            await this.app.vault.process(existingFile, () =>
              renderNote(item, this.settings)
            );
          } else {
            // Frontmatter-only update via Obsidian's API — preserves the note body
            await this.app.fileManager.processFrontMatter(
              existingFile,
              (fm: Record<string, unknown>) => {
                const newData = buildFrontmatterData(item, this.settings);
                for (const [key, value] of Object.entries(newData)) {
                  if (value === null || value === undefined) {
                    delete fm[key];
                  } else {
                    fm[key] = value;
                  }
                }
              }
            );
            // Body remains the user's territory — except for the
            // machine-managed Watch History block, which the user
            // explicitly opted into via syncWatchedDetail. Without this
            // step, the watch_history list would only show whatever was
            // current at note-CREATE time and never update afterwards.
            if (this.settings.syncWatchedDetail) {
              await this.app.vault.process(existingFile, (oldContent) =>
                updateManagedBodySections(oldContent, item, this.settings),
              );
            }
          }
          result.updated++;
        }
      } catch (e) {
        result.failed++;
        const msg = `Failed to sync "${item.title}" (${item.type} ${item.ids.trakt}): ${e instanceof Error ? e.message : String(e)}`;
        result.errors.push(msg);
        console.error("[Traktr]", msg, e);
      }
    }

    // Remove notes that are no longer in any synced source
    if (this.settings.deleteRemovedItems) {
      for (const [key, file] of localNotes) {
        if (!mergedItems.has(key)) {
          try {
            await this.app.fileManager.trashFile(file);
            result.removed++;
          } catch (e) {
            result.failed++;
            const msg = `Failed to remove "${file.name}": ${e instanceof Error ? e.message : String(e)}`;
            result.errors.push(msg);
            console.error("[Traktr]", msg, e);
          }
        }
      }
    }
  }
}
