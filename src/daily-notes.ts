/**
 * [0.7.0] Daily Notes integration. Inserts per-event lines into the
 * user's Daily Note for each sync. See spec 0006 for the full design
 * + 26-row edge-case matrix.
 *
 * Safety contract (the spec's most important property):
 * > For every Daily Note file on disk, content outside the marker
 * > region must be byte-for-byte identical before and after every
 * > catch-up run. No exceptions.
 *
 * This module owns the algorithm; the Obsidian-API-bound parts live
 * in main.ts / settings.ts (vault.read, vault.process, etc.). Pure
 * logic here is unit-testable; the rest is verified by manual smoke
 * during release.
 */

import type { App } from "obsidian";
import { normalizePath, TFile } from "obsidian";
import type { NormalizedItem, DailyNoteEvent, DailyNoteEventAction } from "./types";
import type { TraktrSettings } from "./settings";
import { getEffectiveTemplateLanguage } from "./settings";

/**
 * Hard cap on catch-up range. If the user was away longer than this,
 * we clip the cursor to (today - SAFETY_CAP). The remaining gap can be
 * filled manually via the Backfill button (which has its own 30-day
 * cap). See spec 0006 edge case 12.
 */
const SAFETY_CAP_DAYS = 90;

// ── Date helpers ──

/** "YYYY-MM-DD" for today in the system local timezone. */
export function localTodayISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" of a date relative to system local timezone. */
export function localISODate(dateOrIso: Date | string): string {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  return localTodayISODate(d);
}

/** "HH:MM" in local 24-hour time. */
export function localHHMM(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "??:??";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Add N days to a "YYYY-MM-DD" string and return another "YYYY-MM-DD". */
export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localTodayISODate(dt);
}

/** Inclusive day delta between two "YYYY-MM-DD" strings: from <= to. */
export function daysBetweenISO(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const f = new Date(fy, fm - 1, fd).getTime();
  const t = new Date(ty, tm - 1, td).getTime();
  return Math.round((t - f) / 86_400_000);
}

// ── Path computation ──

/**
 * Render the Daily Note path for a given ISO date, using Obsidian's
 * bundled moment.js for the filename format. Folder + ".md" appended.
 *
 * Examples:
 *   folder="Daily", format="YYYY-MM-DD", date="2026-05-11"
 *     → "Daily/2026-05-11.md"
 *   folder="01 Daily", format="YYYY/YYYY.MM.DD", date="2026-05-11"
 *     → "01 Daily/2026/2026.05.11.md"
 */
export function computeDailyNotePath(
  date: string,
  folder: string,
  format: string,
  momentFn: (input: string, fmt: string) => { format(out: string): string },
): string {
  const parsed = momentFn(date, "YYYY-MM-DD");
  const filename = parsed.format(format);
  const base = folder.replace(/^\/+|\/+$/g, ""); // strip leading/trailing slashes
  const full = base ? `${base}/${filename}.md` : `${filename}.md`;
  return normalizePath(full);
}

// ── Marker handling ──

/**
 * Check that BOTH markers are present in the content AND end appears
 * after start. Missing-pair / inverted order / only-one-side all
 * return false → caller treats as "no valid markers".
 *
 * [0.7.1] Also reject empty or identical start/end strings. If a user
 * sets both markers to the same string (e.g. both "%%"), the function
 * could otherwise find two occurrences of that same string and treat
 * them as a "pair", causing `replaceMarkerBlock` to mangle non-marker
 * content between them. Requiring distinct strings closes that
 * loophole — same fix Obsidian's own native section markers use.
 */
export function isMarkerRegionValid(
  content: string,
  markerStart: string,
  markerEnd: string,
): boolean {
  if (!markerStart || !markerEnd) return false;
  if (markerStart === markerEnd) return false;
  const startIdx = content.indexOf(markerStart);
  if (startIdx === -1) return false;
  const endIdx = content.indexOf(markerEnd, startIdx + markerStart.length);
  return endIdx !== -1;
}

/**
 * Returns true if the region between a valid marker pair contains only
 * whitespace. Returns false if markers are missing/invalid OR the region
 * has any non-whitespace content.
 *
 * [0.7.2] Used by past-day catch-up + backfill to distinguish two cases:
 *   - empty marker pair (e.g. injected by a Daily Note template) → fill it
 *   - marker pair with real content → preserve it (existing safety)
 * Without this, any Daily Note template that pre-seeds the markers would
 * make past-day backfill a no-op for those notes.
 */
export function isMarkerRegionEmpty(
  content: string,
  markerStart: string,
  markerEnd: string,
): boolean {
  if (!isMarkerRegionValid(content, markerStart, markerEnd)) return false;
  const startIdx = content.indexOf(markerStart);
  const endIdx = content.indexOf(markerEnd, startIdx + markerStart.length);
  const inner = content.slice(startIdx + markerStart.length, endIdx);
  return inner.trim().length === 0;
}

/**
 * Replace the content between the first valid marker pair with `block`.
 * Caller MUST have already verified validity via isMarkerRegionValid.
 *
 * `block` should include the markers themselves — this function
 * replaces the FULL region [startIdx, endIdx + markerEnd.length).
 */
export function replaceMarkerBlock(
  content: string,
  markerStart: string,
  markerEnd: string,
  newBlock: string,
): string {
  const startIdx = content.indexOf(markerStart);
  const endIdx = content.indexOf(markerEnd, startIdx + markerStart.length);
  const before = content.slice(0, startIdx);
  const after = content.slice(endIdx + markerEnd.length);
  return before + newBlock + after;
}

/**
 * Append `block` to the end of `content`, normalizing trailing
 * whitespace and ensuring exactly one blank line of separation.
 * `block` should include the markers themselves.
 */
export function appendMarkerBlock(content: string, newBlock: string): string {
  const trimmed = content.replace(/\s+$/, "");
  // If content was empty, don't lead with newlines
  return trimmed.length > 0 ? `${trimmed}\n\n${newBlock}\n` : `${newBlock}\n`;
}

// ── Event aggregation ──

/**
 * Collect ALL events that fall on `date` (in local timezone) across
 * the user's enabled sync sources. Returns sorted ascending by
 * timestamp.
 */
export function aggregateEventsForDate(
  date: string,
  items: Iterable<NormalizedItem>,
  settings: TraktrSettings,
): DailyNoteEvent[] {
  const events: DailyNoteEvent[] = [];

  for (const item of items) {
    // 1. Watched events (detailed history)
    if (settings.syncWatchedDetail) {
      if (item.type === "movie" && item.watch_history_movie) {
        for (const ts of item.watch_history_movie) {
          if (localISODate(ts) === date) {
            events.push({
              timestamp: ts,
              localTime: localHHMM(ts),
              action: "watched",
              display: renderDisplay(item),
            });
          }
        }
      } else if (item.type === "show" && item.watch_history_episodes) {
        // Group same-timestamp episodes for same show so they comma-merge.
        // Different timestamps stay as separate events.
        const bucketByTimestamp = new Map<string, number[]>(); // ts → episode numbers within same season
        const seasonByTimestamp = new Map<string, number>();
        for (const ep of item.watch_history_episodes) {
          for (const ts of ep.watched_at) {
            if (localISODate(ts) !== date) continue;
            // Key by timestamp + season (since "S1E16, S2E1" doesn't merge sensibly)
            const key = `${ts}|${ep.season}`;
            if (!bucketByTimestamp.has(key)) {
              bucketByTimestamp.set(key, []);
              seasonByTimestamp.set(key, ep.season);
            }
            bucketByTimestamp.get(key)!.push(ep.episode);
          }
        }
        for (const [key, episodes] of bucketByTimestamp) {
          const ts = key.split("|")[0];
          const season = seasonByTimestamp.get(key)!;
          const sortedEps = [...episodes].sort((a, b) => a - b);
          events.push({
            timestamp: ts,
            localTime: localHHMM(ts),
            action: "watched",
            display: renderShowDisplay(item, season, sortedEps),
          });
        }
      }
    }

    // 2. Watchlist additions
    if (settings.syncWatchlist && item.watchlist_added_at) {
      if (localISODate(item.watchlist_added_at) === date) {
        events.push({
          timestamp: item.watchlist_added_at,
          localTime: localHHMM(item.watchlist_added_at),
          action: "added_to_watchlist",
          display: renderDisplay(item),
        });
      }
    }

    // 3. Favorites
    if (settings.syncFavorites && item.favorited_at) {
      if (localISODate(item.favorited_at) === date) {
        events.push({
          timestamp: item.favorited_at,
          localTime: localHHMM(item.favorited_at),
          action: "favorited",
          display: renderDisplay(item),
        });
      }
    }

    // 4. Ratings
    if (settings.syncRatings && item.rated_at && item.my_rating) {
      if (localISODate(item.rated_at) === date) {
        events.push({
          timestamp: item.rated_at,
          localTime: localHHMM(item.rated_at),
          action: "rated",
          display: renderDisplay(item),
          ratingValue: item.my_rating,
        });
      }
    }
  }

  // Sort ascending by raw timestamp string (ISO-8601 sorts correctly
  // lexicographically when consistent timezone — we use UTC from Trakt).
  events.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
  return events;
}

function renderDisplay(item: NormalizedItem): string {
  return `${item.title} (${item.year})`;
}

function renderShowDisplay(
  item: NormalizedItem,
  season: number,
  episodes: number[],
): string {
  const epList = episodes.map((e) => `S${season}E${e}`).join(", ");
  return `${item.title} (${item.year}) ${epList}`;
}

// ── Block rendering ──

/**
 * Verbs for each (action, language) pair. Languages must match the
 * bundled template language set from spec 0007. Unknown languages
 * fall back to English.
 */
const VERBS: Record<string, Record<DailyNoteEventAction, string>> = {
  en:    { watched: "watched", added_to_watchlist: "added to watchlist", favorited: "favorited", rated: "rated" },
  "zh-CN": { watched: "看了", added_to_watchlist: "加入想看", favorited: "收藏了", rated: "打分" },
  "zh-TW": { watched: "看了", added_to_watchlist: "加入想看", favorited: "收藏了", rated: "打分" },
  "ja-JP": { watched: "視聴", added_to_watchlist: "ウォッチリストに追加", favorited: "お気に入りに追加", rated: "評価" },
  "ko-KR": { watched: "시청", added_to_watchlist: "시청 목록에 추가", favorited: "즐겨찾기 추가", rated: "평가" },
  "fr-FR": { watched: "a regardé", added_to_watchlist: "a ajouté à la liste", favorited: "a mis en favori", rated: "a noté" },
  "de-DE": { watched: "hat angeschaut", added_to_watchlist: "zur Watchlist hinzugefügt", favorited: "als Favorit markiert", rated: "bewertet" },
  "it-IT": { watched: "ha visto", added_to_watchlist: "ha aggiunto alla watchlist", favorited: "ha aggiunto ai preferiti", rated: "ha valutato" },
  "es-ES": { watched: "vio", added_to_watchlist: "añadió a la lista", favorited: "marcó como favorito", rated: "calificó" },
  "pt-BR": { watched: "assistiu", added_to_watchlist: "adicionou à lista", favorited: "favoritou", rated: "avaliou" },
  "ru-RU": { watched: "посмотрел", added_to_watchlist: "добавил в список", favorited: "добавил в избранное", rated: "оценил на" },
};

/** Aliases — short codes map to the full locale. */
const VERB_ALIASES: Record<string, string> = {
  ja: "ja-JP", ko: "ko-KR", fr: "fr-FR", de: "de-DE",
  it: "it-IT", es: "es-ES", pt: "pt-BR", "pt-pt": "pt-BR",
  "es-mx": "es-ES", "zh-hk": "zh-TW", ru: "ru-RU",
};

function resolveVerbLanguage(lang: string): string {
  const code = (lang || "").trim();
  if (VERBS[code]) return code;
  const lower = code.toLowerCase();
  const aliased = VERB_ALIASES[lower];
  if (aliased && VERBS[aliased]) return aliased;
  // Try the full-locale lookup case-insensitively
  for (const k of Object.keys(VERBS)) {
    if (k.toLowerCase() === lower) return k;
  }
  return "en";
}

/**
 * Render the verb (action text) for an event in the given language.
 * For "rated", appends the rating value like " 9/10".
 */
export function renderVerb(
  action: DailyNoteEventAction,
  lang: string,
  ratingValue?: number,
): string {
  const langKey = resolveVerbLanguage(lang);
  const verbs = VERBS[langKey];
  const verb = verbs[action];
  if (action === "rated" && ratingValue !== undefined) {
    return `${verb} ${ratingValue}/10`;
  }
  return verb;
}

/** Render one line for an event. Format: "{HH:MM} — {verb} {display}". */
export function renderEntry(event: DailyNoteEvent, lang: string): string {
  const verb = renderVerb(event.action, lang, event.ratingValue);
  return `${event.localTime} — ${verb} ${event.display}`;
}

/**
 * Render the full marker block for a date's events. Empty events
 * still produce a block with just the markers (so today can have
 * empty markers ready for events to land later).
 */
export function renderMarkerBlock(
  events: DailyNoteEvent[],
  markerStart: string,
  markerEnd: string,
  lang: string,
): string {
  if (events.length === 0) {
    return `${markerStart}\n${markerEnd}`;
  }
  const lines = events.map((e) => renderEntry(e, lang)).join("\n");
  return `${markerStart}\n${lines}\n${markerEnd}`;
}

// ── Catch-up loop ──

export interface DateProcessResult {
  status: "skipped_no_file" | "skipped_has_markers" | "wrote_new" | "overwrote";
}

/** All the dependencies the catch-up algorithm needs from the host (Plugin). */
export interface DailyNotesHost {
  app: App;
  settings: TraktrSettings;
  saveSettings: () => Promise<void>;
  /** Returns the merged item map used in the most recent sync, for event aggregation. */
  getMergedItems: () => Iterable<NormalizedItem>;
}

/**
 * Catch-up algorithm: always process today (overwrite mode), then walk
 * past days (add-only). Advances `lastDailyNoteSyncedAt` at the end.
 * See spec 0006 §"Catch-up algorithm".
 */
export async function processCatchUp(host: DailyNotesHost): Promise<{
  todayMode: DateProcessResult["status"];
  pastWrote: number;
  pastSkipped: number;
}> {
  const today = localTodayISODate();
  const last = host.settings.historyState.lastDailyNoteSyncedAt || "";

  // 1. Today — always overwrite. Happens regardless of cursor.
  const todayResult = await processDate(host, today, "today");

  // 2. Past days — add-only. Walk last+1 through today-1.
  let pastWrote = 0;
  let pastSkipped = 0;
  if (last && last < today) {
    let cursor = addDaysISO(last, 1);
    if (daysBetweenISO(cursor, today) > SAFETY_CAP_DAYS) {
      console.warn(
        `[Traktr] Daily catch-up gap > ${SAFETY_CAP_DAYS} days; clipping`,
      );
      cursor = addDaysISO(today, -SAFETY_CAP_DAYS);
    }
    while (cursor < today) {
      const result = await processDate(host, cursor, "past");
      if (result.status === "wrote_new") pastWrote++;
      else pastSkipped++;
      cursor = addDaysISO(cursor, 1);
    }
  }

  // 3. Advance cursor to today (only after successful processing — if
  //    processDate threw, we'd skip this assignment).
  host.settings.historyState.lastDailyNoteSyncedAt = today;
  await host.saveSettings();

  return { todayMode: todayResult.status, pastWrote, pastSkipped };
}

/**
 * Process ONE date. `mode` selects the write policy:
 *   "today" → always overwrite within markers (or insert markers if absent)
 *   "past"  → add-only: skip if markers present
 *
 * Always silent on missing file (returns "skipped_no_file"). Caller
 * decides how to surface results to the user.
 */
export async function processDate(
  host: DailyNotesHost,
  date: string,
  mode: "today" | "past",
): Promise<DateProcessResult> {
  const { app, settings } = host;
  const moment = (window as unknown as { moment: (i: string, f: string) => { format(o: string): string } })
    .moment;
  const path = computeDailyNotePath(
    date,
    settings.dailyNotesFolder,
    settings.dailyNotesFilenameFormat,
    moment,
  );
  const abstractFile = app.vault.getAbstractFileByPath(path);
  if (!abstractFile || !(abstractFile instanceof TFile)) {
    return { status: "skipped_no_file" };
  }
  const file: TFile = abstractFile;

  const content = await app.vault.read(file);
  const hasMarkers = isMarkerRegionValid(
    content,
    settings.dailyNotesMarkerStart,
    settings.dailyNotesMarkerEnd,
  );

  if (mode === "past") {
    // [0.7.2] Empty marker pair (e.g. injected by a Daily Note template)
    // should be filled, not skipped. Only skip when the region already
    // has real content — that's what the safety contract protects.
    if (
      hasMarkers &&
      !isMarkerRegionEmpty(
        content,
        settings.dailyNotesMarkerStart,
        settings.dailyNotesMarkerEnd,
      )
    ) {
      return { status: "skipped_has_markers" };
    }
    const events = aggregateEventsForDate(date, host.getMergedItems(), settings);
    if (events.length === 0) return { status: "skipped_no_file" };
    const lang = getEffectiveTemplateLanguage(settings);
    const block = renderMarkerBlock(
      events,
      settings.dailyNotesMarkerStart,
      settings.dailyNotesMarkerEnd,
      lang,
    );
    if (hasMarkers) {
      // Empty region present — replace in place so we don't end up with
      // a duplicate marker pair below the original.
      await app.vault.process(file, (old) =>
        replaceMarkerBlock(
          old,
          settings.dailyNotesMarkerStart,
          settings.dailyNotesMarkerEnd,
          block,
        ),
      );
    } else {
      await app.vault.process(file, (old) => appendMarkerBlock(old, block));
    }
    return { status: "wrote_new" };
  }

  // mode === "today"
  const events = aggregateEventsForDate(date, host.getMergedItems(), settings);
  if (events.length === 0 && !hasMarkers) {
    // Nothing to write and no existing region to refresh; do nothing.
    return { status: "skipped_no_file" };
  }
  const lang = getEffectiveTemplateLanguage(settings);
  const block = renderMarkerBlock(
    events,
    settings.dailyNotesMarkerStart,
    settings.dailyNotesMarkerEnd,
    lang,
  );
  if (hasMarkers) {
    await app.vault.process(file, (old) =>
      replaceMarkerBlock(
        old,
        settings.dailyNotesMarkerStart,
        settings.dailyNotesMarkerEnd,
        block,
      ),
    );
    return { status: "overwrote" };
  } else {
    await app.vault.process(file, (old) => appendMarkerBlock(old, block));
    return { status: "wrote_new" };
  }
}

/**
 * Manual backfill — walks `today - days + 1` through today, ignoring
 * the cursor. After completion, advances cursor to today.
 *
 * Same safety as catch-up: past days are add-only. Today always
 * overwrites.
 */
export async function manualBackfill(
  host: DailyNotesHost,
  days: number,
): Promise<{ wrote: number; skipped: number }> {
  const today = localTodayISODate();
  const safeDays = Math.max(1, Math.min(30, days));
  let cursor = addDaysISO(today, -(safeDays - 1));
  let wrote = 0;
  let skipped = 0;

  while (cursor <= today) {
    const mode = cursor === today ? "today" : "past";
    const result = await processDate(host, cursor, mode);
    if (result.status === "wrote_new" || result.status === "overwrote") {
      wrote++;
    } else {
      skipped++;
    }
    cursor = addDaysISO(cursor, 1);
  }

  host.settings.historyState.lastDailyNoteSyncedAt = today;
  await host.saveSettings();

  return { wrote, skipped };
}

/**
 * Render 3 hardcoded example events for the settings-page live preview.
 * Uses the user's current language settings so they see what their
 * Daily Note entries will actually look like.
 */
export function renderPreview(settings: TraktrSettings): string {
  const lang = getEffectiveTemplateLanguage(settings);
  const examples: DailyNoteEvent[] = [
    {
      timestamp: "2026-05-11T10:00:00Z",
      localTime: "10:00",
      action: "watched",
      display: "Breaking Bad (2008) S1E1, S1E2",
    },
    {
      timestamp: "2026-05-11T14:30:00Z",
      localTime: "14:30",
      action: "added_to_watchlist",
      display: "Inception (2010)",
    },
    {
      timestamp: "2026-05-11T21:30:00Z",
      localTime: "21:30",
      action: "rated",
      display: "The Dark Knight (2008)",
      ratingValue: 9,
    },
  ];
  return examples.map((e) => renderEntry(e, lang)).join("\n");
}
