import type { NormalizedItem, EpisodeWatchHistory } from "./types";
import type { TraktrSettings } from "./settings";
import {
  getEffectiveMetadataLanguage,
  getEffectiveTemplateLanguage,
} from "./settings";
import { renderTemplate, toFrontmatter } from "./utils";

/**
 * Marker comments wrapping the auto-generated Watch History section in the
 * note body. These let `updateManagedBodySections()` find and replace just
 * that block on every sync — leaving the user's hand-written body content
 * outside the markers untouched. We use Obsidian's native `%% ... %%`
 * comment syntax so the markers are invisible in reading view.
 */
export const WATCH_HISTORY_MARKER_START = "%% trakt:watch-history:start %%";
export const WATCH_HISTORY_MARKER_END = "%% trakt:watch-history:end %%";

const WATCH_HISTORY_MARKER_RE =
  /%% trakt:watch-history:start %%[\s\S]*?%% trakt:watch-history:end %%/;

/** Format an ISO-8601 timestamp as `YYYY-MM-DD HH:MM` in the user's local
 * timezone. Trakt records `watched_at` in UTC, but a viewer cares about the
 * wall-clock time when they actually pressed play, which is local. */
function formatWatchTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Render the full Watch History section (heading + bulleted list) for an
 * item, wrapped in machine-managed markers. Returns "" when no detailed
 * history was collected — the empty case is what makes `{{watch_history}}`
 * collapse cleanly in default templates.
 *
 * The markers are essential: they let later syncs find this section in the
 * body and replace its contents without touching anything else the user
 * wrote.
 */
export function renderWatchHistorySection(
  item: NormalizedItem,
  settings: TraktrSettings,
): string {
  const list = renderWatchHistoryList(item);
  if (!list) return "";
  const heading = watchHistoryHeading(
    getEffectiveTemplateLanguage(settings),
  );
  return `${WATCH_HISTORY_MARKER_START}\n## ${heading}\n${list}\n${WATCH_HISTORY_MARKER_END}`;
}

/**
 * Update the managed Watch History section in an existing note body, in
 * place. Behavior:
 *
 * - If markers are present in the content → replace what's between them
 *   with a freshly rendered section (or with empty markers if there's no
 *   data, so we don't leave a stale list around).
 * - If markers are NOT present (e.g. note created with an older version
 *   of this plugin, or user removed them) → append the section to the
 *   end of the body, with a blank line separator.
 * - If detailed watch history is disabled (`syncWatchedDetail = false`) →
 *   leave the content untouched. We don't strip existing markers because
 *   the user may simply have toggled detail off temporarily.
 */
export function updateManagedBodySections(
  content: string,
  item: NormalizedItem,
  settings: TraktrSettings,
): string {
  if (!settings.syncWatchedDetail) return content;

  const newSection = renderWatchHistorySection(item, settings);
  const hasMarkers = WATCH_HISTORY_MARKER_RE.test(content);

  if (hasMarkers) {
    // Always replace between markers — even if newSection is empty, we
    // want to clear stale data rather than keep yesterday's list around.
    const replacement =
      newSection ||
      `${WATCH_HISTORY_MARKER_START}\n${WATCH_HISTORY_MARKER_END}`;
    return content.replace(WATCH_HISTORY_MARKER_RE, replacement);
  }

  // No markers in content. Append only when we have data to show — no
  // point inserting empty markers into a note that's never had history.
  if (!newSection) return content;

  // Preserve trailing newline behavior of the original content. If the
  // body ended with a single trailing newline, our appended block ends
  // with one too; multiple trailing newlines collapse to a single blank
  // line before our section.
  const trimmed = content.replace(/\n+$/, "");
  return `${trimmed}\n\n${newSection}\n`;
}

/** Render only the bullet list (no heading) — useful for users who want to
 * write their own heading in their template. Returns "" when no detail. */
export function renderWatchHistoryList(item: NormalizedItem): string {
  if (item.type === "movie") {
    const ts = item.watch_history_movie;
    if (!ts || ts.length === 0) return "";
    return ts.map((t) => `- ${formatWatchTime(t)}`).join("\n");
  }
  // show
  const eps = item.watch_history_episodes;
  if (!eps || eps.length === 0) return "";
  return eps.map(formatEpisodeLine).join("\n");
}

function formatEpisodeLine(ep: EpisodeWatchHistory): string {
  const code = `S${ep.season}E${ep.episode}`;
  const times = ep.watched_at.map(formatWatchTime).join(", ");
  return `- ${code} — ${times}`;
}

function watchHistoryHeading(templateLang: string): string {
  const code = (templateLang || "").trim();
  if (code === "zh-CN") return "观看记录";
  if (code === "zh-TW" || code === "zh-HK") return "觀看紀錄";
  return "Watch History";
}

function traktUrl(item: NormalizedItem): string {
  return `https://trakt.tv/${item.type === "movie" ? "movies" : "shows"}/${item.ids.slug}`;
}

function imdbUrl(item: NormalizedItem): string | null {
  return item.ids.imdb ? `https://www.imdb.com/title/${item.ids.imdb}` : null;
}

/**
 * Build the full template context (variables available for {{interpolation}})
 * from a normalized item. Template variables are NOT prefixed — they use
 * friendly names so templates stay readable.
 */
function buildTemplateContext(
  item: NormalizedItem,
  settings: TraktrSettings
): Record<string, unknown> {
  const folder = settings.tagNotesFolder;
  const pfx = folder ? `${folder}/` : "";
  const tagNoteLinks = [`[[${pfx}${item.type}]]`];
  // Tag-note wikilinks use the ORIGINAL English genre list so that links
  // remain stable when the user switches metadata language.
  for (const genre of item.originalGenres) {
    tagNoteLinks.push(`[[${pfx}genre/${genre}]]`);
  }
  if (item.watchlist) tagNoteLinks.push(`[[${pfx}watchlist]]`);
  if (item.watched) tagNoteLinks.push(`[[${pfx}watched]]`);
  if (item.favorite) tagNoteLinks.push(`[[${pfx}favorite]]`);
  if (item.my_rating) tagNoteLinks.push(`[[${pfx}rated]]`);
  const tag_notes = tagNoteLinks.join(", ");

  return {
    tag_notes,
    title: item.title,
    year: item.year,
    type: item.type,
    overview: item.overview,
    genres: item.genres.join(", "),
    runtime: item.runtime,
    trakt_rating: item.rating,
    trakt_votes: item.votes,
    certification: item.certification,
    country: item.country,
    language: item.language,
    status: item.status,
    trakt_id: item.ids.trakt,
    trakt_slug: item.ids.slug,
    imdb_id: item.ids.imdb || "",
    tmdb_id: item.ids.tmdb || "",
    tvdb_id: item.ids.tvdb || "",
    trakt_url: traktUrl(item),
    imdb_url: imdbUrl(item) ?? "",
    poster_url: item.poster_url || "",
    // Movie-specific
    tagline: item.tagline || "",
    released: item.released || "",
    // Show-specific
    network: item.network || "",
    aired_episodes: item.aired_episodes || "",
    first_aired: item.first_aired ? item.first_aired.split("T")[0] : "",
    // Source flags
    watchlist: item.watchlist ? "true" : "",
    watchlist_added_at: item.watchlist_added_at || "",
    watched: item.watched ? "true" : "",
    plays: item.plays || "",
    last_watched_at: item.last_watched_at
      ? item.last_watched_at.split("T")[0]
      : "",
    episodes_watched: item.episodes_watched || "",
    favorite: item.favorite ? "true" : "",
    favorited_at: item.favorited_at || "",
    my_rating: item.my_rating || "",
    rated_at: item.rated_at || "",
    // i18n: originals are always available, even when localization is off,
    // so users can opt into stable English filenames or template fields
    // without flipping the global setting.
    original_title: item.originalTitle,
    original_overview: item.originalOverview,
    original_tagline: item.originalTagline || "",
    original_genres: item.originalGenres.join(", "),
    metadata_language: getEffectiveMetadataLanguage(settings),
    // Watch history (only populated when syncWatchedDetail is on AND the
    // item appears in /sync/history). When empty, both variables resolve to
    // empty strings so default-template lines collapse cleanly.
    // {{watch_history}} = full section (heading + bulleted list)
    // {{watch_history_list}} = list only (caller writes their own heading)
    watch_history: renderWatchHistorySection(item, settings),
    watch_history_list: renderWatchHistoryList(item),
  };
}

/**
 * Build the YAML frontmatter data object for an item.
 * ALL keys are prefixed with settings.propertyPrefix.
 */
export function buildFrontmatterData(
  item: NormalizedItem,
  settings: TraktrSettings
): Record<string, unknown> {
  const p = settings.propertyPrefix;
  // When localization is off (effective language is empty), trakt_original_*
  // fields are NOT written — preserves byte-for-byte default behavior.
  const lang = getEffectiveMetadataLanguage(settings);
  const i18nOn = lang !== "";

  const data: Record<string, unknown> = {};

  // Core metadata
  data[`${p}title`] = item.title;
  if (i18nOn) data[`${p}original_title`] = item.originalTitle;
  data[`${p}year`] = item.year;
  data[`${p}type`] = item.type;
  data[`${p}id`] = item.ids.trakt;
  data[`${p}slug`] = item.ids.slug;
  data[`${p}imdb_id`] = item.ids.imdb || null;
  data[`${p}tmdb_id`] = item.ids.tmdb || null;
  data[`${p}genres`] = item.genres;
  if (i18nOn) data[`${p}original_genres`] = item.originalGenres;
  data[`${p}runtime`] = item.runtime;
  data[`${p}certification`] = item.certification;
  data[`${p}rating`] = item.rating;
  data[`${p}votes`] = item.votes;
  data[`${p}country`] = item.country;
  data[`${p}language`] = item.language;
  data[`${p}status`] = item.status;
  data[`${p}overview`] = item.overview;
  if (i18nOn) data[`${p}original_overview`] = item.originalOverview;

  // Movie-specific
  if (item.type === "movie") {
    data[`${p}released`] = item.released || null;
    data[`${p}tagline`] = item.tagline || null;
    if (i18nOn) {
      data[`${p}original_tagline`] = item.originalTagline || null;
    }
  }

  // Show-specific
  if (item.type === "show") {
    data[`${p}tvdb_id`] = item.ids.tvdb || null;
    data[`${p}network`] = item.network || null;
    data[`${p}aired_episodes`] = item.aired_episodes || null;
    data[`${p}first_aired`] = item.first_aired
      ? item.first_aired.split("T")[0]
      : null;
  }

  // Source flags
  if (item.watchlist !== undefined) {
    data[`${p}watchlist`] = item.watchlist;
    if (item.watchlist_added_at) {
      data[`${p}watchlist_added_at`] = item.watchlist_added_at;
    }
  }

  if (item.watched !== undefined) {
    data[`${p}watched`] = item.watched;
    if (item.plays !== undefined) data[`${p}plays`] = item.plays;
    if (item.last_watched_at) {
      data[`${p}last_watched_at`] = item.last_watched_at;
    }
    if (item.episodes_watched !== undefined) {
      data[`${p}episodes_watched`] = item.episodes_watched;
    }
  }

  if (item.favorite !== undefined) {
    data[`${p}favorite`] = item.favorite;
    if (item.favorited_at) {
      data[`${p}favorited_at`] = item.favorited_at;
    }
  }

  if (item.my_rating !== undefined) {
    data[`${p}my_rating`] = item.my_rating;
    if (item.rated_at) {
      data[`${p}rated_at`] = item.rated_at;
    }
  }

  // Links
  data[`${p}url`] = traktUrl(item);
  data[`${p}imdb_url`] = imdbUrl(item);
  data[`${p}poster_url`] = item.poster_url || null;
  data[`${p}synced_at`] = new Date().toISOString();
  if (i18nOn) data[`${p}metadata_language`] = lang;

  if (settings.addTags) {
    const tagPfx = settings.tagPrefix;
    const tags = [`${tagPfx}/${item.type}`];
    // Tags use the ORIGINAL English genre list, by design — they back machine
    // queries (Dataview etc.) and changing them would silently break user
    // queries when language switches.
    for (const genre of item.originalGenres) {
      tags.push(`${tagPfx}/genre/${genre}`);
    }
    if (item.watchlist) tags.push(`${tagPfx}/watchlist`);
    if (item.watched) tags.push(`${tagPfx}/watched`);
    if (item.favorite) tags.push(`${tagPfx}/favorite`);
    if (item.my_rating) tags.push(`${tagPfx}/rated`);
    data["tags"] = tags;
  }

  if (settings.addTagNotes) {
    const folder = settings.tagNotesFolder;
    const pfx = folder ? `${folder}/` : "";
    const tagNotes = [`[[${pfx}${item.type}]]`];
    // Same rationale as tags: tag-note wikilinks must stay stable across
    // language changes so users don't end up with split graphs.
    for (const genre of item.originalGenres) {
      tagNotes.push(`[[${pfx}genre/${genre}]]`);
    }
    if (item.watchlist) tagNotes.push(`[[${pfx}watchlist]]`);
    if (item.watched) tagNotes.push(`[[${pfx}watched]]`);
    if (item.favorite) tagNotes.push(`[[${pfx}favorite]]`);
    if (item.my_rating) tagNotes.push(`[[${pfx}rated]]`);
    data[`${p}tag_notes`] = tagNotes;
  }

  return data;
}

/**
 * Render a complete note (frontmatter + body) for an item.
 */
export function renderNote(
  item: NormalizedItem,
  settings: TraktrSettings
): string {
  const fmData = buildFrontmatterData(item, settings);
  const frontmatter = toFrontmatter(fmData);

  const template =
    item.type === "movie"
      ? settings.movieNoteTemplate
      : settings.showNoteTemplate;

  const body = renderTemplate(template, buildTemplateContext(item, settings));

  return `---\n${frontmatter}\n---\n${body}`;
}

/**
 * Render only the frontmatter section for an item.
 * Used when updating existing notes without overwriting the body.
 */
export function renderFrontmatterOnly(
  item: NormalizedItem,
  settings: TraktrSettings
): string {
  return toFrontmatter(buildFrontmatterData(item, settings));
}
