/**
 * Helpers that operate on `HistoryState`. See spec 0001 §Part B.
 *
 * The state is a single object stored at `settings.historyState`, written
 * through Obsidian's normal `saveSettings()` path. Operations here mutate
 * the state IN PLACE — caller is expected to save once after a sync run
 * completes, not per-event.
 */
import type {
  HistoryState,
  NormalizedItem,
  TraktHistoryItem,
} from "./types";

/**
 * Should the next sync trigger a full Trakt history refresh? Returns true
 * when:
 *
 * - `lastFullRefreshAt` is empty (first run, or state was cleared) — we
 *   need a full pull to seed the state
 * - or `now - lastFullRefreshAt` exceeds the configured interval, so we
 *   re-pull to detect deletions
 */
export function shouldRunFullRefresh(
  state: HistoryState,
  intervalDays: number,
  now = Date.now(),
): boolean {
  if (!state.lastFullRefreshAt) return true;
  const lastMs = Date.parse(state.lastFullRefreshAt);
  if (isNaN(lastMs)) return true;
  return now - lastMs >= intervalDays * 86_400_000;
}

/**
 * Determine the `start_at` value to send to `/sync/history` for an
 * incremental fetch. Returns "" (no filter, full pull) when we don't
 * have a known incremental anchor yet.
 */
export function getIncrementalStartAt(state: HistoryState): string {
  return state.lastIncrementalSyncAt || "";
}

/**
 * Append new history events into the existing aggregated state. Idempotent:
 * replaying the same events doesn't add duplicate timestamps because we
 * dedupe by `id`.
 *
 * Mutates `state` in place. Returns the count of newly-ingested events
 * (events whose id was previously unknown) for progress reporting.
 */
export function mergeHistoryEvents(
  state: HistoryState,
  events: ReadonlyArray<TraktHistoryItem>,
): number {
  const known = new Set(state.knownEventIds);
  let newlyAdded = 0;
  let latestWatched = state.lastIncrementalSyncAt;

  for (const ev of events) {
    if (typeof ev.id !== "number") continue;
    if (known.has(ev.id)) continue;
    if (!ev.watched_at) continue;

    if (ev.type === "movie" && ev.movie) {
      const id = ev.movie.ids.trakt;
      const list = state.byMovie[id] ?? [];
      list.push(ev.watched_at);
      state.byMovie[id] = list;
    } else if (ev.type === "episode" && ev.show && ev.episode) {
      const showId = ev.show.ids.trakt;
      const eps = state.byShow[showId] ?? [];
      let entry = eps.find(
        (e) =>
          e.season === ev.episode!.season && e.episode === ev.episode!.number,
      );
      if (!entry) {
        entry = {
          season: ev.episode.season,
          episode: ev.episode.number,
          title: ev.episode.title,
          watched_at: [],
        };
        eps.push(entry);
      } else if (!entry.title && ev.episode.title) {
        // Backfill the title if we now have it (Trakt may omit it on some
        // calls and include it on others).
        entry.title = ev.episode.title;
      }
      entry.watched_at.push(ev.watched_at);
      state.byShow[showId] = eps;
    } else {
      // Unknown event type — skip.
      continue;
    }

    known.add(ev.id);
    newlyAdded++;
    if (!latestWatched || ev.watched_at > latestWatched) {
      latestWatched = ev.watched_at;
    }
  }

  // Sort timestamps + episodes after the merge so display order is stable.
  for (const id of Object.keys(state.byMovie)) {
    state.byMovie[Number(id)] = chronologicalSort(state.byMovie[Number(id)]);
  }
  for (const id of Object.keys(state.byShow)) {
    const eps = state.byShow[Number(id)];
    for (const e of eps) e.watched_at = chronologicalSort(e.watched_at);
    eps.sort((a, b) => a.season - b.season || a.episode - b.episode);
  }

  state.knownEventIds = Array.from(known);
  if (latestWatched) state.lastIncrementalSyncAt = latestWatched;
  return newlyAdded;
}

/**
 * Replace the entire state from a full history pull. Used after a periodic
 * full refresh to detect deletions: any event id present in the prior
 * `knownEventIds` but absent from `events` was deleted on Trakt.
 *
 * Returns the count of detected deletions (for progress / logging).
 */
export function replaceFromFullRefresh(
  state: HistoryState,
  events: ReadonlyArray<TraktHistoryItem>,
  now = Date.now(),
): { deletedCount: number; totalEvents: number } {
  const fullIds = new Set(
    events
      .map((e) => e.id)
      .filter((id): id is number => typeof id === "number"),
  );
  const deletedCount = state.knownEventIds.filter(
    (id) => !fullIds.has(id),
  ).length;

  // Rebuild from scratch — simpler than surgically patching, and total cost
  // is sub-100ms even for 14k events.
  const fresh = stateFromEvents(events);
  state.byMovie = fresh.byMovie;
  state.byShow = fresh.byShow;
  state.knownEventIds = fresh.knownEventIds;
  state.lastIncrementalSyncAt = fresh.lastIncrementalSyncAt || state.lastIncrementalSyncAt;
  state.lastFullRefreshAt = new Date(now).toISOString();
  return { deletedCount, totalEvents: events.length };
}

/**
 * Pure: build a fresh `HistoryState` from a raw event list. Used both by
 * `replaceFromFullRefresh` and by smoke tests that want to verify
 * aggregation determinism without touching mutable state.
 */
export function stateFromEvents(
  events: ReadonlyArray<TraktHistoryItem>,
): HistoryState {
  const out: HistoryState = {
    byMovie: {},
    byShow: {},
    knownEventIds: [],
    lastIncrementalSyncAt: "",
    lastFullRefreshAt: "",
    lastDailyNoteSyncedAt: "",
  };
  // Reuse mergeHistoryEvents — it already handles all the dedup / sort logic
  // and pulls `lastIncrementalSyncAt` from the latest event.
  mergeHistoryEvents(out, events);
  return out;
}

/**
 * Apply the aggregated state onto in-memory `NormalizedItem`s for note
 * rendering. Items are matched by Trakt id; items not present in state
 * keep their existing `watch_history_*` (likely undefined).
 */
export function applyHistoryStateToItems(
  state: HistoryState,
  items: Iterable<NormalizedItem>,
): void {
  for (const item of items) {
    if (item.type === "movie") {
      const list = state.byMovie[item.ids.trakt];
      if (list && list.length > 0) {
        item.watch_history_movie = [...list];
      }
    } else {
      const eps = state.byShow[item.ids.trakt];
      if (eps && eps.length > 0) {
        // Defensive copy — we don't want downstream renderers to mutate
        // our persistent state object.
        item.watch_history_episodes = eps.map((e) => ({
          season: e.season,
          episode: e.episode,
          title: e.title,
          watched_at: [...e.watched_at],
        }));
      }
    }
  }
}

function chronologicalSort(timestamps: ReadonlyArray<string>): string[] {
  // ISO-8601 strings sort lexicographically the same as chronologically
  // when they share the same offset (Trakt uses UTC `Z`). Avoids new Date()
  // per element.
  return [...timestamps].sort();
}

/**
 * Drop everything in the state. Used by `Traktr: Force full history
 * refresh` (sets fields to defaults so the next sync seeds afresh) and by
 * a settings UI button if/when we add one.
 */
export function clearHistoryState(state: HistoryState): void {
  state.byMovie = {};
  state.byShow = {};
  state.knownEventIds = [];
  state.lastIncrementalSyncAt = "";
  state.lastFullRefreshAt = "";
}

/**
 * Cheap observability for the settings UI: how many things are tracked.
 */
export function historyStateStats(state: HistoryState): {
  movies: number;
  shows: number;
  events: number;
} {
  let events = state.knownEventIds.length;
  if (events === 0) {
    // Older state from a 0.1.x upgrade may have populated by/byShow but
    // not knownEventIds (we didn't track the set then). Estimate from the
    // aggregated lists.
    for (const list of Object.values(state.byMovie)) events += list.length;
    for (const eps of Object.values(state.byShow)) {
      for (const e of eps) events += e.watched_at.length;
    }
  }
  return {
    movies: Object.keys(state.byMovie).length,
    shows: Object.keys(state.byShow).length,
    events,
  };
}
