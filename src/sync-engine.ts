import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { TraktrSettings } from "./settings";
import {
  getEffectiveMetadataLanguage,
  getEffectiveMetadataFallbackLanguage,
} from "./settings";
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
  frontmatterWouldChange,
  mergeFrontmatterIntoContent,
  updateManagedBodySections,
} from "./note-renderer";
import {
  sanitizeFilename,
  renderTemplate,
  parseFrontmatter,
  processWithConcurrency,
} from "./utils";
import {
  applyHistoryStateToItems,
  getIncrementalStartAt,
  mergeHistoryEvents,
  replaceFromFullRefresh,
  shouldRunFullRefresh,
} from "./history-state";

/**
 * Cap on simultaneous TMDB requests during a sync. Keeps the user's CPU /
 * network unloaded, gives the status bar room to update mid-sync, and
 * sidesteps TMDB's rate limit (50 req/s) — a `Promise.all` burst over 1000+
 * items can saturate the bucket and trigger 429s, which we silently swallow
 * as "no poster".
 */
const TMDB_CONCURRENCY = 5;

/**
 * Cap on simultaneous Trakt /translations fallback calls (only used when no
 * TMDB API key is configured). Trakt allows 1000 req / 5min, so 5 in flight
 * is comfortably below the limit.
 */
const TRAKT_TRANSLATION_CONCURRENCY = 5;

/**
 * [0.9.0] Extract the base language code from a BCP-47 string. `zh-CN` → `zh`,
 * `en-US` → `en`, `en` → `en`. Used by the Trakt translation fetcher in
 * strict-mode (spec 0008): we query Trakt with just `zh` so the response
 * includes all variants (zh-CN, zh-TW, zh-HK, zh-SG), then filter
 * strictly client-side in pickTraktTranslation.
 */
function baseLangCode(language: string): string {
  return (language.split("-")[0] || "").toLowerCase();
}

/**
 * Progress reporter: called periodically with a human-readable status line.
 * Used by the plugin to drive the status-bar text — `sync()` accepts an
 * optional callback so the engine stays UI-agnostic.
 */
export type SyncProgress = (message: string) => void;

export interface DailyNotesDataSyncResult {
  status: "updated" | "already_running" | "failed";
  items: NormalizedItem[];
}

interface DetailedHistorySyncResult {
  events: TraktHistoryItem[];
  wasFullRefresh: boolean;
}

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

function lastTimestamp(timestamps: ReadonlyArray<string>): string | undefined {
  if (timestamps.length === 0) return undefined;
  return timestamps.reduce((latest, ts) => (ts > latest ? ts : latest));
}

// ── Watch history aggregation ──
//
// As of 0.2.0 this is a thin wrapper over `history-state.ts`. The previous
// in-memory aggregateMovieHistory / aggregateShowHistory functions were
// recomputed from a full Trakt history fetch every sync. They've been
// replaced by a persistent `HistoryState` object that:
//
//   1. Carries an aggregated form of every event we've ever seen
//   2. Supports incremental fetch via `?start_at=lastIncrementalSyncAt`
//   3. Triggers a periodic full refresh to detect deletions
//
// See spec 0001 for the design rationale and history-state.ts for the
// merge / replace operations.

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

/**
 * Render a filename for an item using the user's filenameTemplate.
 *
 * `titleOverride` lets the disambiguation logic substitute a richer title
 * (e.g. `"重生 (Born Again)"` or `"重生 (Born Again) [157810]"`) without
 * changing what `{{title}}` means everywhere else. When the user's template
 * doesn't include `{{title}}`, the override is silently ignored — which is
 * fine: a custom template that omits title is presumably already producing
 * unique filenames via other variables.
 */
export function buildFilename(
  item: NormalizedItem,
  template: string,
  titleOverride?: string,
): string {
  const context: Record<string, unknown> = {
    title: titleOverride ?? item.title,
    year: item.year,
    imdb_id: item.ids.imdb || "",
    trakt_id: item.ids.trakt,
  };
  return sanitizeFilename(renderTemplate(template, context));
}

/**
 * [0.3.1] Resolve filename collisions by progressively disambiguating.
 *
 * Background: with metadata localization, common-translation titles
 * (e.g. "重生" for both "Born Again" and "Reborn") can produce the same
 * filename for distinct Trakt items. Without disambiguation, the second
 * `vault.create()` throws "File already exists" and the user sees a
 * recurring per-sync failure for that item.
 *
 * Strategy — three tiers, returning the FIRST one whose filename is free:
 *
 *  - **Tier 0** (default): `{{title}} ({{year}})` → e.g. `重生 (2020)`
 *  - **Tier 1** (only when originalTitle differs from title): inject the
 *    English original alongside the localized title →
 *    `重生 (Born Again) (2020)`. Doesn't help when localization is off
 *    (originalTitle === title), so we skip straight to Tier 2 in that case.
 *  - **Tier 2** (last-resort, guaranteed unique since Trakt IDs are
 *    globally unique): append `[trakt_id]` →
 *    `重生 (Born Again) [157810] (2020)` or `重生 [157810] (2020)`.
 *
 * The augmentation always goes into the `{{title}}` slot — the year /
 * trakt_id / imdb_id positions in the user's template stay where the
 * user put them. Result: for the default template, year stays at the end
 * (matching the user's existing notes' visual convention).
 *
 * Pure function: `isTaken(filename)` is the only side-effecting input,
 * making the policy fully unit-testable without an Obsidian vault.
 */
/**
 * [1.0.0 / spec 0009] Rename an existing note to match the current
 * `item.title` + filename template if the two have drifted (typically
 * because the user changed `metadataLanguage` or `metadataFallbackLanguage`,
 * or edited the template). Uses `app.fileManager.renameFile` so internal
 * Obsidian links to this note auto-update.
 *
 * Returns true if a rename actually happened, false otherwise. Bails when
 * `autoRenameOnLanguageChange` is off, when the desired path equals the
 * current path, or when something goes wrong (logged, swallowed).
 *
 * Self-collision exclusion: `disambiguatedFilename`'s `isTaken` callback
 * here returns false for the file being renamed. Without this, the file
 * always "collides" with itself and the disambiguator tiers up forever
 * (turning "Reborn (2020).md" into "Reborn [157810] (2020).md" gratuitously).
 */
export async function maybeRenameExistingFile(
  app: App,
  file: TFile,
  item: NormalizedItem,
  folderPath: string,
  template: string,
): Promise<boolean> {
  const { filename } = disambiguatedFilename(item, template, (candidate) => {
    const candidatePath = normalizePath(`${folderPath}/${candidate}.md`);
    if (candidatePath === file.path) return false; // self never collides with itself
    return !!app.vault.getAbstractFileByPath(candidatePath);
  });
  const desiredPath = normalizePath(`${folderPath}/${filename}.md`);
  if (desiredPath === file.path) return false;

  try {
    await app.fileManager.renameFile(file, desiredPath);
    // fileManager.renameFile mutates file.path / file.name in place; the
    // existing TFile reference stays valid for the diff/overwrite path
    // that runs after this returns.
    return true;
  } catch (e) {
    console.warn(
      `[Traktr] Rename failed for ${file.path} → ${desiredPath}; keeping current name`,
      e,
    );
    return false;
  }
}

/**
 * [1.0.0 / spec 0009] Standalone "Rename now" action — walks every note in
 * the sync folder that has a `trakt_id` in its frontmatter, recomputes the
 * desired filename from the current item title (read from frontmatter) +
 * template, and renames if different.
 *
 * Used by:
 *   - the Settings → Localization "Rename now" button (manual trigger)
 *   - the post-1.0-upgrade modal's "I'll do it now" flow (not yet wired)
 *
 * Does NOT need the full sync engine — operates purely on the on-disk
 * notes' current frontmatter. Returns `{ renamed, scanned }` so the UI can
 * show a result count.
 *
 * Unlike the sync-time rename, this path doesn't have a `NormalizedItem`
 * — instead it builds a minimal one from the existing frontmatter so
 * `disambiguatedFilename` can compute the desired path. The minimal item
 * preserves the same fields the filename template references
 * (`{{title}}`, `{{original_title}}`, `{{year}}`, etc.). Anything else the
 * template might reference isn't available here — those template variables
 * render as empty strings, same as they would on a sync-time rename for an
 * item with sparse data.
 */
export async function renameAllNotes(
  app: App,
  folderPath: string,
  template: string,
  propertyPrefix: string,
): Promise<{ renamed: number; scanned: number }> {
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!(folder instanceof TFolder)) return { renamed: 0, scanned: 0 };

  let renamed = 0;
  let scanned = 0;

  for (const child of folder.children) {
    if (!(child instanceof TFile) || child.extension !== "md") continue;
    const content = await app.vault.cachedRead(child);
    const { frontmatter } = parseFrontmatter(content);
    const synthItem = itemFromFrontmatter(frontmatter, propertyPrefix);
    if (!synthItem) continue;
    scanned++;

    const didRename = await maybeRenameExistingFile(
      app,
      child,
      synthItem,
      folderPath,
      template,
    );
    if (didRename) renamed++;
  }

  return { renamed, scanned };
}

function itemFromFrontmatter(
  frontmatter: Record<string, string>,
  propertyPrefix: string,
): NormalizedItem | null {
  const idKey = `${propertyPrefix}id`;
  const typeKey = `${propertyPrefix}type`;
  const titleKey = `${propertyPrefix}title`;
  const originalTitleKey = `${propertyPrefix}original_title`;
  const yearKey = `${propertyPrefix}year`;
  const slugKey = `${propertyPrefix}slug`;
  const imdbKey = `${propertyPrefix}imdb_id`;
  const tmdbKey = `${propertyPrefix}tmdb_id`;

  const traktId = parseInt(frontmatter[idKey], 10);
  const type = frontmatter[typeKey];
  if (isNaN(traktId)) return null;
  if (type !== "movie" && type !== "show") return null;

  const tmdbId = parseInt(frontmatter[tmdbKey], 10);

  // Build a minimal NormalizedItem just for filename rendering.
  // Properties not consulted by the template are left as empty defaults.
  return {
    type,
    title: frontmatter[titleKey] || "",
    originalTitle: frontmatter[originalTitleKey] || "",
    year: parseInt(frontmatter[yearKey], 10) || 0,
    ids: {
      trakt: traktId,
      slug: frontmatter[slugKey] || "",
      imdb: frontmatter[imdbKey] || "",
      tmdb: isNaN(tmdbId) ? 0 : tmdbId,
    },
    overview: "",
    genres: [],
    runtime: 0,
    rating: 0,
    votes: 0,
    certification: "",
    country: "",
    language: "",
    status: "",
    originalOverview: "",
    originalGenres: [],
  } as unknown as NormalizedItem;
}

type NoteIdentityRecord = {
  file: TFile;
  item: NormalizedItem;
  syncedAtMs: number;
};

export type DedupeDuplicateNotesResult = {
  scanned: number;
  duplicateGroups: number;
  movedToTrash: number;
  renamed: number;
  failed: number;
  errors: string[];
};

function syncedAtMs(frontmatter: Record<string, string>, propertyPrefix: string): number {
  const raw = frontmatter[`${propertyPrefix}synced_at`];
  const parsed = raw ? Date.parse(raw) : NaN;
  return isNaN(parsed) ? 0 : parsed;
}

function preferredDuplicateKeep(
  records: NoteIdentityRecord[],
  folderPath: string,
  template: string,
  app: App,
): NoteIdentityRecord {
  const groupPaths = new Set(records.map((record) => record.file.path));
  const scored = records.map((record) => {
    const { filename } = disambiguatedFilename(
      record.item,
      template,
      (candidate) => {
        const candidatePath = normalizePath(`${folderPath}/${candidate}.md`);
        const found = app.vault.getAbstractFileByPath(candidatePath);
        if (found instanceof TFile && groupPaths.has(found.path)) return false;
        return !!found;
      },
    );
    const desiredPath = normalizePath(`${folderPath}/${filename}.md`);
    const idToken = `[${record.item.ids.trakt}]`;
    return {
      record,
      matchesCurrentTemplate: record.file.path === desiredPath,
      hasFallbackIdToken: record.file.basename.includes(idToken),
    };
  });

  scored.sort((a, b) => {
    if (a.matchesCurrentTemplate !== b.matchesCurrentTemplate) {
      return a.matchesCurrentTemplate ? -1 : 1;
    }
    if (a.hasFallbackIdToken !== b.hasFallbackIdToken) {
      return a.hasFallbackIdToken ? 1 : -1;
    }
    if (a.record.syncedAtMs !== b.record.syncedAtMs) {
      return b.record.syncedAtMs - a.record.syncedAtMs;
    }
    return a.record.file.path.localeCompare(b.record.file.path);
  });

  return scored[0].record;
}

export async function dedupeDuplicateNotes(
  app: App,
  folderPath: string,
  template: string,
  propertyPrefix: string,
): Promise<DedupeDuplicateNotesResult> {
  const result: DedupeDuplicateNotesResult = {
    scanned: 0,
    duplicateGroups: 0,
    movedToTrash: 0,
    renamed: 0,
    failed: 0,
    errors: [],
  };
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!(folder instanceof TFolder)) return result;

  const groups = new Map<string, NoteIdentityRecord[]>();
  for (const child of folder.children) {
    if (!(child instanceof TFile) || child.extension !== "md") continue;
    const content = await app.vault.cachedRead(child);
    const { frontmatter } = parseFrontmatter(content);
    const item = itemFromFrontmatter(frontmatter, propertyPrefix);
    if (!item) continue;
    result.scanned++;
    const key = itemKey(item.type, item.ids.trakt);
    const records = groups.get(key) ?? [];
    records.push({
      file: child,
      item,
      syncedAtMs: syncedAtMs(frontmatter, propertyPrefix),
    });
    groups.set(key, records);
  }

  for (const records of groups.values()) {
    if (records.length <= 1) continue;
    result.duplicateGroups++;
    const keep = preferredDuplicateKeep(records, folderPath, template, app);
    for (const record of records) {
      if (record === keep) continue;
      try {
        await app.fileManager.trashFile(record.file);
        result.movedToTrash++;
      } catch (e) {
        result.failed++;
        const msg = `Failed to move duplicate "${record.file.path}" to trash: ${e instanceof Error ? e.message : String(e)}`;
        result.errors.push(msg);
        console.error("[Traktr]", msg, e);
      }
    }

    try {
      const renamed = await maybeRenameExistingFile(
        app,
        keep.file,
        keep.item,
        folderPath,
        template,
      );
      if (renamed) result.renamed++;
    } catch (e) {
      result.failed++;
      const msg = `Failed to rename kept duplicate "${keep.file.path}": ${e instanceof Error ? e.message : String(e)}`;
      result.errors.push(msg);
      console.error("[Traktr]", msg, e);
    }
  }

  return result;
}

export function disambiguatedFilename(
  item: NormalizedItem,
  template: string,
  isTaken: (filename: string) => boolean,
): { filename: string; tier: 0 | 1 | 2 } {
  // Tier 0
  const tier0 = buildFilename(item, template);
  if (!isTaken(tier0)) return { filename: tier0, tier: 0 };

  // Tier 1 — only meaningful when originalTitle is actually different.
  // When localization is off (or the title happens to be the same in both
  // languages, e.g. proper nouns), skip directly to tier 2.
  const hasDistinctOriginal =
    !!item.originalTitle && item.originalTitle !== item.title;
  if (hasDistinctOriginal) {
    const tier1 = buildFilename(
      item,
      template,
      `${item.title} (${item.originalTitle})`,
    );
    if (!isTaken(tier1)) return { filename: tier1, tier: 1 };
  }

  // Tier 2 — trakt_id is unique, so this WILL be free unless the user has
  // a file we don't know about. Format depends on whether tier 1 was an
  // option:
  //   with original title:    重生 (Born Again) [157810] (2020)
  //   without original title: 重生 [157810] (2020)
  const tier2Title = hasDistinctOriginal
    ? `${item.title} (${item.originalTitle}) [${item.ids.trakt}]`
    : `${item.title} [${item.ids.trakt}]`;
  const tier2 = buildFilename(item, template, tier2Title);
  return { filename: tier2, tier: 2 };
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
      const key = itemKey(type, traktId);
      const existing = map.get(key);
      if (!existing || preferIdentityFile(child, existing, traktId)) {
        map.set(key, child);
      }
    }
  }

  return map;
}

function preferIdentityFile(candidate: TFile, current: TFile, traktId: number): boolean {
  // If a prior race already created "Title [id] (year).md" beside the
  // original "Title (year).md", keep updating the original path. The bracketed
  // form is only a collision fallback, not a better identity match.
  const idToken = `[${traktId}]`;
  const candidateHasIdToken = candidate.basename.includes(idToken);
  const currentHasIdToken = current.basename.includes(idToken);
  if (candidateHasIdToken !== currentHasIdToken) {
    return !candidateHasIdToken;
  }
  return candidate.path < current.path;
}

export async function findMatchingIdentityFile(
  app: App,
  propertyPrefix: string,
  type: ItemType,
  traktId: number,
  files: TFile[],
): Promise<TFile | null> {
  const idKey = `${propertyPrefix}id`;
  const typeKey = `${propertyPrefix}type`;
  let match: TFile | null = null;
  const seen = new Set<string>();

  for (const child of files) {
    if (seen.has(child.path)) continue;
    seen.add(child.path);

    const content = await app.vault.cachedRead(child);
    const { frontmatter } = parseFrontmatter(content);
    const noteId = parseInt(frontmatter[idKey], 10);
    const noteType = frontmatter[typeKey];
    if (noteId !== traktId || noteType !== type) continue;
    if (!match || preferIdentityFile(child, match, traktId)) {
      match = child;
    }
  }

  return match;
}

// ── Sync Engine ──

export class SyncEngine {
  private app: App;
  private settings: TraktrSettings;
  private saveSettings: () => Promise<void>;
  private syncing = false;
  /**
   * [0.7.0] Optional callback fired AFTER reconcileType and saveSettings,
   * with the merged items as input. The plugin uses this hook to run
   * Daily Notes catch-up (spec 0006) without coupling the engine to
   * Daily Notes itself.
   */
  private onAfterSync?: (items: NormalizedItem[]) => Promise<string | void>;

  constructor(
    app: App,
    settings: TraktrSettings,
    saveSettings: () => Promise<void>,
    onAfterSync?: (items: NormalizedItem[]) => Promise<string | void>,
  ) {
    this.app = app;
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.onAfterSync = onAfterSync;
  }

  async sync(
    onProgress?: SyncProgress,
    options: { forceFullHistoryRefresh?: boolean } = {},
  ): Promise<SyncResult> {
    const t = getTranslator(this.settings.uiLanguage);
    if (this.syncing) {
      new Notice(t("notice.alreadySyncing"));
      return { added: 0, updated: 0, unchanged: 0, removed: 0, renamed: 0, failed: 0, errors: [] };
    }

    this.syncing = true;
    const result: SyncResult = {
      added: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      renamed: 0,
      failed: 0,
      errors: [],
    };

    console.debug("[Traktr] Sync started");
    try {
      // 1. Ensure valid token
      await ensureValidToken(this.settings, this.saveSettings);

      // 2. Fetch list endpoints in parallel; populate the merged map.
      //    Each (movie / show) source is independent of detailed history.
      onProgress?.(t("progress.fetchingTrakt"));
      const merged = new Map<string, NormalizedItem>();

      await Promise.all([
        this.settings.syncMovies ? this.fetchAndMergeMovies(merged) : Promise.resolve(),
        this.settings.syncShows ? this.fetchAndMergeShows(merged) : Promise.resolve(),
      ]);

      // 3. Detailed watch history (incremental or periodic full refresh).
      //    Updates the persistent historyState in `this.settings`. Skipped
      //    entirely when syncWatched / syncWatchedDetail is off.
      if (this.settings.syncWatched && this.settings.syncWatchedDetail) {
        const history = await this.syncDetailHistory(
          options.forceFullHistoryRefresh === true,
          onProgress,
        );
        this.mergeHistoryOnlyItems(merged, history.events);
        if (!history.wasFullRefresh) {
          await this.ensureHistoryStateItemsAreMerged(merged, onProgress);
        }
      }

      // 4. Apply persistent history state to in-memory items so the note
      //    renderer sees the watch_history_* fields.
      applyHistoryStateToItems(this.settings.historyState, merged.values());

      // 5. Ensure tag note files exist
      await this.ensureTagNotes(merged);

      // 6. Reconcile all items into the single notes folder
      await this.reconcileType(merged, result, onProgress);

      // 7. Persist any state mutations (TMDB cache writes, history state
      //    updates) so they survive across sessions and across devices.
      await this.saveSettings();

      let resultNoticeSuffix = "";

      // 7.5 — [0.7.0] Daily Notes catch-up. Side effect: must not roll
      // back the main sync result if it fails. See spec 0006.
      if (this.onAfterSync) {
        try {
          resultNoticeSuffix = (await this.onAfterSync([...merged.values()])) ?? "";
        } catch (e) {
          console.warn("[Traktr] Daily Notes catch-up failed (non-fatal):", e);
        }
      }

      // 8. Show result
      console.debug(`[Traktr] Sync complete — added: ${result.added}, updated: ${result.updated}, unchanged: ${result.unchanged}, removed: ${result.removed}, renamed: ${result.renamed}, failed: ${result.failed}`);
      let msg = t("notice.syncComplete", {
        added: result.added,
        updated: result.updated,
        unchanged: result.unchanged,
        removed: result.removed,
      });
      // [1.0.0] Surface rename count when non-zero — the common
      // steady-state case is zero, so we'd rather suppress than add noise.
      if (result.renamed > 0) {
        msg += t("notice.syncCompleteWithRenames", { renamed: result.renamed });
      }
      if (resultNoticeSuffix) {
        msg += resultNoticeSuffix;
      }
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
   * Build a fresh Daily Notes data snapshot without reconciling media notes.
   *
   * This intentionally shares the same `syncing` lock with full sync. The
   * returned items have detailed history applied and metadata localization
   * enriched, so the Daily Notes renderer sees the same title/year values it
   * would see after a full sync, but no media files are created, renamed,
   * deleted, or modified.
   */
  async syncDailyNotesData(
    onProgress?: SyncProgress,
    options: { suppressAlreadyRunningNotice?: boolean } = {},
  ): Promise<DailyNotesDataSyncResult> {
    const t = getTranslator(this.settings.uiLanguage);
    if (this.syncing) {
      if (!options.suppressAlreadyRunningNotice) {
        new Notice(t("notice.alreadySyncing"));
      }
      return { status: "already_running", items: [] };
    }

    this.syncing = true;
    try {
      await ensureValidToken(this.settings, this.saveSettings);

      onProgress?.(t("progress.fetchingTrakt"));
      const merged = new Map<string, NormalizedItem>();
      await Promise.all([
        this.settings.syncMovies
          ? this.fetchAndMergeMovies(merged)
          : Promise.resolve(),
        this.settings.syncShows
          ? this.fetchAndMergeShows(merged)
          : Promise.resolve(),
      ]);

      if (this.settings.syncWatched && this.settings.syncWatchedDetail) {
        const history = await this.syncDetailHistory(false, onProgress);
        this.mergeHistoryOnlyItems(merged, history.events);
        if (!history.wasFullRefresh) {
          await this.ensureHistoryStateItemsAreMerged(merged, onProgress);
        }
      }

      applyHistoryStateToItems(this.settings.historyState, merged.values());
      const items = [...merged.values()];
      await this.enrichMetadata(items, onProgress);
      await this.saveSettings();

      return { status: "updated", items };
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Unknown error during Daily Notes sync.";
      console.error("[Traktr] Daily Notes data sync failed:", e);
      new Notice(t("notice.syncFailed", { msg }), 10000);
      return { status: "failed", items: [] };
    } finally {
      this.syncing = false;
    }
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
   * Fetch from all enabled list sources for movies and merge into map.
   * Detailed history is handled separately by `syncDetailHistory()` so its
   * full vs incremental decision is made once across both types.
   */
  private async fetchAndMergeMovies(
    map: Map<string, NormalizedItem>
  ): Promise<void> {
    const { clientId, accessToken } = this.settings;

    const [
      watchlistItems,
      watchedItems,
      favoriteItems,
      ratingItems,
    ] = await Promise.all([
      this.settings.syncWatchlist ? fetchWatchlist("movies", clientId, accessToken) : Promise.resolve([] as TraktWatchlistItem[]),
      this.settings.syncWatched ? fetchWatchedMovies(clientId, accessToken) : Promise.resolve([] as TraktWatchedMovieItem[]),
      this.settings.syncFavorites ? fetchFavorites("movies", clientId, accessToken) : Promise.resolve([] as TraktFavoriteItem[]),
      this.settings.syncRatings ? fetchRatings("movies", clientId, accessToken) : Promise.resolve([] as TraktRatingItem[]),
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
  }

  /**
   * Fetch from all enabled list sources for shows and merge into map.
   * Detailed history is handled separately by `syncDetailHistory()`.
   */
  private async fetchAndMergeShows(
    map: Map<string, NormalizedItem>
  ): Promise<void> {
    const { clientId, accessToken } = this.settings;

    const [
      watchlistItems,
      watchedItems,
      favoriteItems,
      ratingItems,
    ] = await Promise.all([
      this.settings.syncWatchlist ? fetchWatchlist("shows", clientId, accessToken) : Promise.resolve([] as TraktWatchlistItem[]),
      this.settings.syncWatched ? fetchWatchedShows(clientId, accessToken) : Promise.resolve([] as TraktWatchedShowItem[]),
      this.settings.syncFavorites ? fetchFavorites("shows", clientId, accessToken) : Promise.resolve([] as TraktFavoriteItem[]),
      this.settings.syncRatings ? fetchRatings("shows", clientId, accessToken) : Promise.resolve([] as TraktRatingItem[]),
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
  }

  /**
   * Pull detailed watch history from Trakt and update the persistent
   * `historyState`. Decides incremental vs full refresh based on
   * `lastFullRefreshAt` + the configured interval.
   *
   *   - **Incremental** (fast path): `?start_at=lastIncrementalSyncAt`,
   *     append new events into state via `mergeHistoryEvents`. Typical
   *     weekly catch-up = 1 page = 1 API call.
   *   - **Full refresh** (slow path): no `start_at`, pull everything,
   *     `replaceFromFullRefresh` rebuilds state from scratch and detects
   *     deletions by diffing against `knownEventIds`.
   *
   * Caller is `sync()`. Both movie and episode history are fetched in
   * parallel; their events go into the same shared state object (which
   * has separate `byMovie` and `byShow` maps internally).
   */
  private async syncDetailHistory(
    forceFullRefresh: boolean,
    onProgress?: SyncProgress,
  ): Promise<DetailedHistorySyncResult> {
    const t = getTranslator(this.settings.uiLanguage);
    const state = this.settings.historyState;
    const interval = this.settings.historyFullRefreshIntervalDays;
    const authoritativeFullRefreshMs = state.lastAuthoritativeFullRefreshAt
      ? Date.parse(state.lastAuthoritativeFullRefreshAt)
      : NaN;
    const localFullRefreshMs = state.lastFullRefreshAt
      ? Date.parse(state.lastFullRefreshAt)
      : NaN;
    const localBehindAuthoritative =
      !isNaN(authoritativeFullRefreshMs) &&
      (isNaN(localFullRefreshMs) ||
        localFullRefreshMs < authoritativeFullRefreshMs);
    const fullRefresh =
      forceFullRefresh ||
      localBehindAuthoritative ||
      shouldRunFullRefresh(state, interval);
    const startAt = fullRefresh ? "" : getIncrementalStartAt(state);

    onProgress?.(
      t(
        fullRefresh
          ? "progress.fullHistoryRefresh"
          : "progress.fetchingTraktHistory",
      ),
    );

    const { clientId, accessToken } = this.settings;
    const [movieEvents, episodeEvents] = await Promise.all([
      this.settings.syncMovies
        ? fetchHistory("movies", clientId, accessToken, startAt)
        : Promise.resolve([] as TraktHistoryItem[]),
      this.settings.syncShows
        ? fetchHistory("episodes", clientId, accessToken, startAt)
        : Promise.resolve([] as TraktHistoryItem[]),
    ]);

    const all = [...movieEvents, ...episodeEvents];

    if (fullRefresh) {
      replaceFromFullRefresh(state, all);
      state.lastAuthoritativeFullRefreshAt = state.lastFullRefreshAt;
    } else {
      mergeHistoryEvents(state, all);
    }
    return { events: all, wasFullRefresh: fullRefresh };
  }

  private hasUnmergedHistoryStateItems(
    map: Map<string, NormalizedItem>,
  ): boolean {
    const state = this.settings.historyState;
    if (
      this.settings.syncMovies &&
      Object.keys(state.byMovie).some((id) =>
        !map.has(itemKey("movie", Number(id))),
      )
    ) {
      return true;
    }
    if (
      this.settings.syncShows &&
      Object.keys(state.byShow).some((id) =>
        !map.has(itemKey("show", Number(id))),
      )
    ) {
      return true;
    }
    return false;
  }

  private async ensureHistoryStateItemsAreMerged(
    map: Map<string, NormalizedItem>,
    onProgress?: SyncProgress,
  ): Promise<void> {
    if (!this.hasUnmergedHistoryStateItems(map)) return;

    // Old local runtime state can already contain detailed-history entries
    // from builds that did not seed history-only items into `merged`. That
    // state has ids and timestamps, but not enough media metadata to create a
    // NormalizedItem, so repair it with one full history pull.
    const history = await this.syncDetailHistory(true, onProgress);
    this.mergeHistoryOnlyItems(map, history.events);
  }

  /**
   * `/sync/watched/shows` can miss items that only have detailed history rows
   * in `/sync/history/episodes` (notably season 0 specials on some Trakt data).
   * The history state would then contain the event, but no `NormalizedItem`
   * would exist for note creation or Daily Notes aggregation. Seed those items
   * from the history payload so detailed watch history is not silently orphaned.
   */
  private mergeHistoryOnlyItems(
    map: Map<string, NormalizedItem>,
    historyEvents: ReadonlyArray<TraktHistoryItem>,
  ): void {
    const state = this.settings.historyState;

    for (const ev of historyEvents) {
      if (ev.type === "movie" && ev.movie) {
        const item = getOrCreateItem(map, ev.movie.ids, "movie", ev.movie);
        if (!item.watched) {
          const watchedAt = state.byMovie[ev.movie.ids.trakt] ?? [ev.watched_at];
          item.watched = true;
          item.plays = watchedAt.length;
          item.last_watched_at = lastTimestamp(watchedAt) ?? ev.watched_at;
        }
      } else if (ev.type === "episode" && ev.show) {
        const item = getOrCreateItem(
          map,
          ev.show.ids,
          "show",
          undefined,
          ev.show,
        );
        if (!item.watched) {
          const episodes = state.byShow[ev.show.ids.trakt] ?? [];
          item.watched = true;
          item.episodes_watched = episodes.length || 1;
          item.plays =
            episodes.reduce((sum, ep) => sum + ep.watched_at.length, 0) || 1;
          item.last_watched_at =
            lastTimestamp(episodes.flatMap((ep) => ep.watched_at)) ??
            ev.watched_at;
        }
      }
    }
  }

  private async enrichMetadata(
    itemList: NormalizedItem[],
    onProgress?: SyncProgress,
  ): Promise<void> {
    const t = getTranslator(this.settings.uiLanguage);
    const language = getEffectiveMetadataLanguage(this.settings);
    const fallbackLanguage = getEffectiveMetadataFallbackLanguage(this.settings);
    if (this.settings.tmdbApiKey) {
      await processWithConcurrency(
        itemList,
        TMDB_CONCURRENCY,
        async (item) => {
          if (!item.ids.tmdb) {
            if (language) {
              await this.applyTraktTranslation(
                item,
                language,
                fallbackLanguage,
              );
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
            this.settings.tmdbCache,
            this.settings.tmdbCacheTtlDays,
            fallbackLanguage,
          );
          item.poster_url = meta.poster_url;
          if (meta.translation) {
            applyTranslation(item, meta.translation);
          }
        },
        (done, total) =>
          onProgress?.(t("progress.fetchingMetadata", { done, total })),
      );
    } else if (language) {
      await processWithConcurrency(
        itemList,
        TRAKT_TRANSLATION_CONCURRENCY,
        (item) => this.applyTraktTranslation(item, language, fallbackLanguage),
        (done, total) =>
          onProgress?.(t("progress.fetchingTranslations", { done, total })),
      );
    }
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
    fallbackLanguage: string = "",
  ): Promise<void> {
    const traktType = item.type === "movie" ? "movies" : "shows";
    const translations = await fetchTraktTranslations(
      traktType,
      item.ids.trakt,
      // [0.9.0] When fallback is set we need to query Trakt with the BASE
      // language code (e.g. "zh") so we get all variants (zh-CN, zh-TW,
      // zh-HK) in the response, then filter strictly client-side. With no
      // fallback, the legacy behaviour passes the full code unchanged.
      fallbackLanguage ? baseLangCode(language) : language,
      this.settings.clientId,
    );
    const picked = pickTraktTranslation(translations, language, fallbackLanguage);
    if (!picked && fallbackLanguage) {
      // Strict primary missed — fetch the fallback language family and pick
      // strictly from it.
      const fbTranslations = await fetchTraktTranslations(
        traktType,
        item.ids.trakt,
        baseLangCode(fallbackLanguage),
        this.settings.clientId,
      );
      const fbPicked = pickTraktTranslation(
        fbTranslations,
        fallbackLanguage,
        fallbackLanguage, // strict mode for the fallback walk too
      );
      if (!fbPicked) return;
      applyTranslation(item, {
        title: fbPicked.title,
        overview: fbPicked.overview,
        tagline: fbPicked.tagline,
        genres: undefined,
      });
      return;
    }
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
    result: SyncResult,
    onProgress?: SyncProgress,
  ): Promise<void> {
    const t = getTranslator(this.settings.uiLanguage);
    const folderPath = normalizePath(this.settings.folder);
    await ensureFolder(this.app, folderPath);

    // Fetch poster + (optionally) translation per item from TMDB. We use a
    // bounded concurrency pool (5 in flight) instead of a Promise.all burst:
    //   - lets the status bar show real progress while running
    //   - keeps us comfortably under TMDB's 50 req/s rate limit
    //   - 1000+ item libraries no longer blast the rate-limit bucket and
    //     silently lose posters/translations to swallowed 429s
    const itemList = [...mergedItems.values()];
    await this.enrichMetadata(itemList, onProgress);

    // Scan immediately before writing. This matters for multi-device vaults:
    // Obsidian Sync may download existing media notes while the metadata
    // lookups above are running, and those files must be updated in place.
    const localNotes = await scanExistingNotes(
      this.app,
      folderPath,
      this.settings.propertyPrefix
    );

    // Create or update notes
    let writeIndex = 0;
    const writeTotal = mergedItems.size;
    for (const [key, item] of mergedItems) {
      writeIndex++;
      // Throttle progress updates so we don't spam the status bar — every
      // 10 items, or on the last one, is enough to feel responsive.
      if (writeIndex % 10 === 0 || writeIndex === writeTotal) {
        onProgress?.(
          t("progress.writingNotes", { done: writeIndex, total: writeTotal }),
        );
      }
      try {
        let existingFile = localNotes.get(key);

        if (!existingFile) {
          // CREATE — with two-tier filename disambiguation (spec 0.3.1).
          // The plugin keys items by `(type, trakt_id)` internally, so we
          // already know this Trakt id has no existing note. But the
          // FILENAME may still collide with another item that happens to
          // share the same default `{{title}} ({{year}})` string —
          // localized titles like "重生" / "Reborn" / "Be Reborn" all
          // collapse to "重生" under zh-CN.
          const collidedFiles: TFile[] = [];
          const { filename, tier } = disambiguatedFilename(
            item,
            this.settings.filenameTemplate,
            (candidate) => {
              const found = this.app.vault.getAbstractFileByPath(
                normalizePath(`${folderPath}/${candidate}.md`),
              );
              if (found instanceof TFile) {
                collidedFiles.push(found);
                return true;
              }
              return !!found;
            },
          );
          if (tier > 0) {
            const liveFile = await findMatchingIdentityFile(
              this.app,
              this.settings.propertyPrefix,
              item.type,
              item.ids.trakt,
              collidedFiles,
            );
            if (liveFile) {
              existingFile = liveFile;
              localNotes.set(key, liveFile);
            }
          }
          if (!existingFile) {
            if (tier > 0) {
              console.warn(
                `[Traktr] Filename collision for "${item.title}" (${item.type} ${item.ids.trakt}); using tier-${tier} fallback: ${filename}.md`,
              );
            }
            const filePath = normalizePath(`${folderPath}/${filename}.md`);
            await this.app.vault.create(filePath, renderNote(item, this.settings));
            result.added++;
            continue;
          }
        }

        // [1.0.0] Rename if title/template drifted from filename. Runs
        // BEFORE the overwrite/diff branching so any downstream path read
        // uses the new filename. fileManager.renameFile mutates the TFile
        // in place and auto-updates Obsidian internal links.
        if (this.settings.autoRenameOnLanguageChange) {
          const renamed = await maybeRenameExistingFile(
            this.app,
            existingFile,
            item,
            folderPath,
            this.settings.filenameTemplate,
          );
          if (renamed) result.renamed++;
        }

        if (this.settings.overwriteExisting) {
          // Full-overwrite mode: documented to always rewrite. Diff path
          // bypassed by user choice.
          await this.app.vault.process(existingFile, () =>
            renderNote(item, this.settings)
          );
          result.updated++;
        } else {
          // [0.3.0] Diff-first update — see spec 0002.
          //
          // The 0.2.x code unconditionally called processFrontMatter +
          // (optionally) vault.process for every existing note, which
          // touched all ~1200 files' mtimes every sync and produced a
          // cross-device-sync storm even when nothing actually changed.
          //
          // Now: predict whether either write would meaningfully change
          // the file. Skip both when neither would. The synced_at field is
          // ignored in the frontmatter diff so it doesn't drive its own
          // update; it gets stamped to "now" only when SOMETHING ELSE
          // really changed.
          //
          // Failure-mode contract: if the diff is wrong, err on the side
          // of writing (false positive = wasted I/O; false negative =
          // user data is stale). See spec 0002 §"Edge cases" for the
          // matrix and rationale.

          const newData = buildFrontmatterData(item, this.settings);
          const syncedAtKey = `${this.settings.propertyPrefix}synced_at`;

          // Read existing frontmatter via Obsidian's metadata cache
          // (returns properly-typed values: numbers stay numbers, arrays
          // stay arrays — unlike our own parseFrontmatter() which is
          // string-only). When the cache is missing or unparsed (rare:
          // fresh file Obsidian hasn't indexed yet, or malformed YAML),
          // we conservatively treat that as "definitely write".
          const cached = this.app.metadataCache.getFileCache(existingFile);
          const existingFm = cached?.frontmatter as
            | Record<string, unknown>
            | undefined;
          const fmChanged =
            !existingFm ||
            frontmatterWouldChange(newData, existingFm, [syncedAtKey]);

          // Body diff (only when watch-history detail is on — that's the
          // one section we manage in the body). We pre-read the file once
          // to compute the diff; the actual write inside vault.process
          // re-reads atomically to avoid races with frontmatter updates
          // that may have just happened in this same iteration.
          let bodyChanged = false;
          if (this.settings.syncWatchedDetail) {
            const oldContent = await this.app.vault.cachedRead(existingFile);
            const newContent = updateManagedBodySections(
              oldContent,
              item,
              this.settings,
            );
            bodyChanged = oldContent !== newContent;
          }

          if (!fmChanged && !bodyChanged) {
            // Nothing to do — note is already in sync. ZERO writes.
            // synced_at on disk stays at whatever its previous value was,
            // which now correctly reflects "last actual change" instead
            // of "last sync touch".
            result.unchanged++;
            continue;
          }

          // At least one real change. Rebuild the plugin-owned frontmatter
          // fields textually instead of using processFrontMatter. This keeps
          // the update path able to repair notes whose YAML is already
          // malformed, because Obsidian's frontmatter parser throws before
          // invoking our callback in that case.
          await this.app.vault.process(existingFile, (oldContent) => {
            const withFrontmatter = mergeFrontmatterIntoContent(
              oldContent,
              newData,
            );
            if (!bodyChanged) return withFrontmatter;
            return updateManagedBodySections(
              withFrontmatter,
              item,
              this.settings,
            );
          });
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
