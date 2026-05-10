# 0002 — Diff-based write (skip no-op note updates)

- **Status**: implemented
- **Released in**: 0.3.0
- **Date**: 2026-05-10
- **Authors**: @o1xhack, Claude
- **Builds on**: [0001-incremental-sync](0001-incremental-sync.md)

## Context

0.2.0 dropped sync wall time from minutes to single-digit seconds by caching
TMDB metadata and incrementally fetching Trakt history. But one cost center
remained: **every sync still physically rewrites every note's frontmatter**,
even when nothing about that item actually changed.

Two paths combine to cause this:

1. `buildFrontmatterData` (note-renderer.ts:310) sets
   `data[`${p}synced_at`] = new Date().toISOString()` unconditionally on
   every call → the generated frontmatter is bytewise different from disk
   on every sync, even for unchanged items.
2. The sync-engine UPDATE branch (sync-engine.ts:678-712) always calls
   `processFrontMatter` for existing notes, with no diff check. Obsidian's
   `processFrontMatter` does not skip writes when the callback produces
   identical content.

The local-disk impact is small (Obsidian's frontmatter API is fast). The
**real cost** is downstream: any file `mtime` change cascades through the
user's vault-sync layer.

| Sync layer | Per-sync cost in 0.2.x |
|---|---|
| Obsidian Sync | ~1200 file diffs uploaded, billed bandwidth |
| iCloud Drive | ~1200 file revisions tracked, multi-minute "syncing…" on iPhone |
| Syncthing | ~1200 file-change events broadcast to every paired device |
| Git (vault-as-repo) | ~1200-line noise commit per sync |

A user with 1200 items who watches one new episode triggers ~1199 files'
worth of pure waste.

The architectural fix: **only write to a note when its frontmatter or
managed body section would actually change.** This is a strict
optimization — no user-visible behavior changes, only the noise.

## Goals / Non-goals

### Goals

- A sync that finds no Trakt-side changes for an item produces **zero
  writes** for that item's note (no `processFrontMatter` call, no
  `vault.process` call)
- A sync that finds **real** changes still writes those changes promptly
  and completely. **Zero data loss compared to 0.2.x** is a hard
  constraint — if anywhere the diff is ambiguous, we err on the side of
  writing
- `trakt_synced_at` semantic upgrades: it now means *"the last time this
  note was actually modified by sync"* rather than *"the last time sync
  touched this note"*. This makes the field useful for sorting/filtering
  in Bases and Dataview
- File `mtime` becomes a reliable signal of "this note had real changes"
  — usable as a Bases sort key (`file.mtime`) and as a debugging tool

### Non-goals

- **Hash-based change detection.** A naive `JSON.stringify(a) ===
  JSON.stringify(b)` is tempting but brittle: key order matters, and
  Obsidian's YAML parser may surface values with slightly different
  types (number vs string) than our build function. Instead we do a
  semantic per-key compare. (See "Design — diff algorithm" below.)
- **Diffing user-edited frontmatter against ours.** The plugin only owns
  `trakt_*` (and the global `tags` field when `addTags` is on). User
  fields are never inspected, never compared, never written. The diff
  ignores them entirely.
- **Diffing the user's hand-written note body.** Body comparison only
  applies to the machine-managed Watch History block (between
  `%% trakt:watch-history:start %%` / `:end %%` markers). Everything
  outside the markers is opaque to the diff and never touched.
- **Persisting a content hash to data.json.** No new persistent state.
  The diff is computed from "what's currently on disk" vs "what we'd
  write", both freshly produced. This keeps the cache layer simple and
  is robust against external edits (Mac edits a note → iPhone sees the
  diff and re-syncs the now-divergent frontmatter, no stale-hash
  mistakes).
- **Diffing TMDB cache writes.** The cache lives in data.json, not
  in note files. Out of scope.

## Design

The change splits into three pieces: the diff algorithm, the engine
wire-up, and the `synced_at` semantic update.

### Part A — Diff algorithm

Two pure functions in `src/note-renderer.ts`:

#### `frontmatterWouldChange(newData, existingFm): boolean`

Mirrors the exact logic of the existing `processFrontMatter` callback
(sync-engine.ts:691-696). Returns `true` iff that callback would mutate
the input `fm`.

```typescript
export function frontmatterWouldChange(
  newData: Record<string, unknown>,
  existingFm: Record<string, unknown>,
  ignoreKeys: string[] = [],
): boolean {
  for (const [key, newValue] of Object.entries(newData)) {
    if (ignoreKeys.includes(key)) continue;
    const existingValue = existingFm[key];
    if (newValue === null || newValue === undefined) {
      // Callback would `delete fm[key]`. Real change only if key exists.
      if (key in existingFm) return true;
      continue;
    }
    // Callback would `fm[key] = newValue`. Real change if values differ.
    if (!valuesEqual(existingValue, newValue)) return true;
  }
  return false;
}
```

`valuesEqual` handles:

- Primitives via `===` (with a numeric-vs-string-numeric tolerance, see
  edge case 6 below)
- Arrays via length + recursive element compare (order-sensitive)
- Anything else falls through to `===`

#### `bodySectionWouldChange(oldContent, newContent): boolean`

Just `oldContent !== newContent` — `updateManagedBodySections` is pure
and deterministic (verified in spec investigation; no embedded
timestamps, no language-from-locale, no randomness). String identity is
the right test.

### Part B — Engine wire-up

The UPDATE branch in `reconcileType` (sync-engine.ts:678-712) becomes:

```
existingFile = localNotes.get(key)
if !existingFile: CREATE branch (unchanged)
else if overwriteExisting:
    // unchanged — full-overwrite mode is documented to always rewrite
    vault.process(existingFile, () => renderNote(item, settings))
    result.updated++
else:
    // Diff-first frontmatter update
    newData = buildFrontmatterData(item, settings)  // includes synced_at
    existingFm = readFrontmatterFrom(existingFile)
    fmChanged = frontmatterWouldChange(newData, existingFm, ["${p}synced_at"])

    // Diff-first body update
    bodyChanged = false
    if syncWatchedDetail:
        oldContent = vault.read(existingFile)
        newContent = updateManagedBodySections(oldContent, item, settings)
        bodyChanged = oldContent !== newContent

    if !fmChanged and !bodyChanged:
        result.unchanged++  // new counter
        continue            // ZERO writes for this item

    // Something changed: write synced_at = now (only now, not earlier)
    if fmChanged:
        newData["${p}synced_at"] = new Date().toISOString()
        processFrontMatter(existingFile, fm => mergeNewDataInto(fm, newData))
    if bodyChanged:
        vault.process(existingFile, () => newContent)
    result.updated++
```

Critical detail: `synced_at` is **only stamped into `newData` AFTER**
we've decided there's a real change. This is what flips the semantics
from "every sync" to "when sync actually changed something".

For body-only changes (frontmatter unchanged), we still bump
`synced_at` — the note was modified by sync, that's the field's job.
Implementation: if `!fmChanged && bodyChanged`, also write `synced_at`
to frontmatter alongside the body.

### Part C — Counter & UI

`SyncResult` grows a field:

```typescript
export interface SyncResult {
  added: number;
  updated: number;
  unchanged: number;     // NEW: items found, but no write needed
  removed: number;
  failed: number;
  errors: string[];
}
```

The completion notice gets an additional clause when `unchanged > 0`:

- en: `Sync complete: {added} added, {updated} updated, {unchanged} unchanged, {removed} removed`
- zh-CN: `同步完成：新增 {added}，更新 {updated}，未变 {unchanged}，移除 {removed}`

In steady state, a user with 1200 items who watched one new episode will
see `0 added, 1 updated, 1199 unchanged, 0 removed` — concrete proof
the optimization is working.

## Edge cases (the data-safety contract)

The whole point of this spec is that the user's data must NOT silently
go un-synced. Every edge case below was considered explicitly; the
implementation is required to handle each correctly.

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | Note exists but has no frontmatter at all (user blanked it) | `existingFm = {}` → every newData key triggers change → full write |
| 2 | Note has frontmatter but no `trakt_*` keys (legacy note name collision) | All newData keys are missing in existingFm → full write |
| 3 | Note has stale `trakt_*` keys from older plugin version (different schema) | Stale extra keys ignored by diff; missing keys we now write trigger change → write |
| 4 | Same item, identical Trakt + TMDB data as last sync | `frontmatterWouldChange` returns false; if body unchanged → `unchanged++`, **zero writes** |
| 5 | Trakt returns same data but in slightly different array order (e.g. genres reordered upstream) | Order-sensitive compare → treated as change → write. False-positive rewrite is acceptable; silently dropping the change is not |
| 6 | YAML round-trip: disk has `trakt_year: 2024` (number), newData has `2024` (number) | Both numbers, `===` → equal → no write. If parser gives `"2024"` string, the type mismatch triggers a write. Acceptable false positive once, then stable |
| 7 | newData has `trakt_imdb_id: null`, disk has no such key | callback would `delete fm[key]`, but key doesn't exist → no-op → no write |
| 8 | newData has `trakt_imdb_id: null`, disk has `trakt_imdb_id: "tt1234"` | callback would delete → real change → write |
| 9 | User manually added `trakt_my_rating: 5` to frontmatter when it wasn't in newData | newData doesn't include `my_rating` → diff doesn't compare it → no write. User's manual value preserved (matches current 0.2.x behavior) |
| 10 | User manually edited a `trakt_*` field that IS in newData (e.g. changed `trakt_title`) | newData has the canonical value → diff detects mismatch → write, overwriting user's edit. **Matches current 0.2.x behavior** — plugin owns `trakt_*` keys |
| 11 | User added a non-`trakt_*` field (e.g. `my_notes: "foo"`) | Never inspected, never compared, never written. Preserved |
| 12 | `addTags = true`, genres unchanged | `tags` array in newData matches `tags` on disk → no write |
| 13 | `addTags` toggled from false to true | newData now contains `tags`, disk doesn't → diff change → write. New tags persist |
| 14 | `addTags` toggled from true to false | newData no longer contains `tags`. Diff doesn't see it → no write. Old tags **stranded** on disk. This matches current 0.2.x behavior; cleanup is out of scope here |
| 15 | `i18n` toggled on (metadata language set) | All `trakt_*` translated fields change + `trakt_original_*` fields appear → diff detects → write |
| 16 | `syncWatchedDetail` on, new episode watched | History state's `byShow[id]` gets new timestamp → `updateManagedBodySections` produces different body → `bodyChanged = true` → write (frontmatter + body, synced_at bumped) |
| 17 | `syncWatchedDetail` on, no new episodes | History state unchanged for this show → `updateManagedBodySections` produces identical content → `bodyChanged = false` → no write |
| 18 | `syncWatchedDetail` toggled off | Body diff skipped entirely. Old watch-history block remains in note body. No write triggered by this alone (matches current 0.2.x — toggling off doesn't strip markers) |
| 19 | `overwriteExisting = true` (full-body rewrite mode) | Diff path bypassed entirely. Same behavior as 0.2.x. Notice: this means every sync still rewrites every note when this setting is on — by user choice |
| 20 | TMDB cache stale revalidation finishes after sync starts (poster_url updates async) | This sync uses pre-revalidation value (matches 0.2.x); next sync's diff detects the new value → write. No data loss |
| 21 | First sync of a new item | CREATE branch, no diff involved. `synced_at` written |
| 22 | First-ever sync after upgrade from 0.2.x | All notes' `trakt_synced_at` on disk is stale. After this sync: notes with no real change → `synced_at` not refreshed, stays stale (documented as expected). Notes that DID change → `synced_at` updated to now |
| 23 | Concurrent file edit by user during sync (race) | Pre-existing race; not made worse. `vault.process` is atomic for the read-modify-write step. User edits between our diff-read and our write may be overwritten — same as 0.2.x |
| 24 | `propertyPrefix` changed (e.g. `trakt_` → `traktv_`) | All new keys differ; old keys are stranded on disk (same as 0.2.x). All notes get rewritten with new keys. Acceptable |
| 25 | Body file is huge and slow to read | We read it via `vault.read` once per item per sync. For 1200 items × ~5KB each = ~6MB cumulative read. Negligible; modern SSDs handle this in <100ms total |
| 26 | A note's frontmatter parses as empty due to a malformed YAML header | `processFrontMatter` provides `{}` in that case → all keys missing → full write triggered → side effect: malformed YAML gets repaired by Obsidian's serializer on the rewrite. Net win |

### Acceptance criterion (data integrity)

The primary defense against "we silently failed to sync N items" is the
following invariant, implemented as a test:

> **For every item where any field in `buildFrontmatterData(item,
> settings)` differs in any way from the on-disk frontmatter (ignoring
> only `synced_at`), `frontmatterWouldChange` MUST return `true`.**

This is checked in `tests/i18n.smoke.ts` via N+1 cases per field family
(one identical-data case → false; one perturbed-data case per field
family → true). See tests below.

### Failure mode if diff is wrong (worst case)

If the diff falsely returns `false` when it should return `true` →
**the note is not updated this sync**. The user sees stale data in the
note. But: the next time anything else about that item changes (e.g. a
re-watch event, a TMDB metadata refresh, a `last_watched_at` bump from
Trakt), the diff will trigger and the note will catch up. The
worst-case lag is bounded by the slower of: TMDB cache TTL (default 90
days) or Trakt history activity. For active users, lag is short. For
museum items in the library, lag is moot (the data isn't changing).

If the diff falsely returns `true` when it should return `false` →
**we write a no-op**. Cost: marginal extra disk I/O + cross-device sync
traffic. No data loss. This is the "safe" failure mode and is what the
diff errs toward when in doubt (see edge case 5).

## Implementation surface

| File | Change |
|---|---|
| `src/note-renderer.ts` | Add `frontmatterWouldChange()`, `valuesEqual()`, export both |
| `src/sync-engine.ts` | Rewrite UPDATE branch; thread `result.unchanged++` |
| `src/types.ts` | Add `unchanged: number` to `SyncResult` |
| `src/i18n.ts` | Extend `notice.syncComplete` with `{unchanged}` slot; en + zh-CN |
| `tests/i18n.smoke.ts` | New cases: diff true-negative (identical data), true-positives per field family, null-key edge cases, body-section identity, synced_at ignored |
| `docs/CHANGELOG.md` | 0.3.0 entry |
| `docs/MANUAL.md` + 3 translations (zh-CN, zh-TW, ja) | Update `trakt_synced_at` row to describe new semantic |
| `manifest.json` + `package.json` + `versions.json` | 0.2.0 → 0.3.0 |

The wire-up logic in sync-engine grows by ~20 lines. The diff helper is
~30 lines. Total: ~50 LOC of new logic + tests.

## Migration / backward compatibility

- **data.json**: no schema changes. The optimization is stateless.
- **Note files on disk**: no rewrites triggered by the upgrade itself.
  After upgrade, the first sync writes only items with real changes.
  Notes with stale `trakt_synced_at` from 0.2.x stay stale until that
  note has a real change — by design.
- **User templates**: `{{synced_at}}` is not a template variable, so
  no template change. Frontmatter consumers (Dataview, Bases) that
  read `trakt_synced_at` get a more meaningful value.
- **The first sync after upgrade is approximately the SAME cost as a
  0.2.x sync** for items that did have real Trakt-side changes during
  the upgrade window. Subsequent syncs are dramatically quieter.

## Tests

Added to `tests/i18n.smoke.ts`:

**`frontmatterWouldChange` — true negatives (no write needed):**

- Identical newData and existingFm → false
- newData has null for a key not in existingFm → false (no-op delete)
- newData has the same value as existingFm, different but equivalent types
  (`2024` number vs `2024` number) → false
- `synced_at` is the only difference between newData and existingFm → false
  when passed to `ignoreKeys`

**`frontmatterWouldChange` — true positives (write needed):**

- One key value differs → true
- newData has a key existingFm doesn't → true
- newData has null for a key existingFm has → true (real delete)
- Array element order differs (genres reordered) → true (order-sensitive)
- Array length differs → true

**Body section diff:**

- `updateManagedBodySections` called with same item twice → identical output
- Different `watch_history_episodes` → different output

**Integration:**

- Build mock item + identical mock fm → diff returns false; simulated
  sync would skip both processFrontMatter and vault.process
- Mock item with one perturbed field → diff returns true for that field

## Alternatives considered

### Hash-based comparison (rejected)

Compute a hash of `buildFrontmatterData` output, store last hash in
data.json keyed by item id, compare on next sync. **Rejected** because:

- New persistent state means a new failure mode (hash store corruption
  → either over-write or under-write)
- Doesn't account for external edits to the note (Mac edits, iPhone
  doesn't know the on-disk content diverged from the hash)
- We don't need it: per-key compare against on-disk YAML is fast enough

### Move `synced_at` out of frontmatter entirely (rejected)

Store one global `lastSyncAt` in `data.json` instead of per-note. **Rejected**
because:

- Loses the useful per-note meaning ("when did *this* note last change")
- Existing users have `trakt_synced_at` in their notes; dropping it
  creates orphan keys on disk
- Bases users may already be referencing the field

### Diff entire rendered file (`renderNote`) instead of per-section (rejected)

Compute the full rendered note string, compare against disk, write if
differ. **Rejected** because:

- Would re-render the body template every sync, which is wasted CPU when
  most items haven't changed
- Doesn't preserve user edits to the body outside markers — overwriting
  would discard them. Current per-field semantic is correct: we own
  `trakt_*` frontmatter + the marker-wrapped body section, and the user
  owns everything else

### Defer to Obsidian's `processFrontMatter` to skip no-op writes (rejected)

Hope that the Obsidian API is smart enough to compare before writing.
**Rejected** by inspection: the API contract makes no such promise, and
empirically every call results in a write. Even if a future Obsidian
release added this optimization, we'd still need to update `synced_at`
semantics ourselves.

## Future work

- **Strip orphaned tags** when `addTags` is toggled off (edge case 14).
  Out of scope here because it requires diffing existing tags against
  newData and selectively deleting — a different diff shape from this
  spec. Worth a separate follow-up if users report it.
- **Same treatment for `tag_notes` (`addTagNotes` toggle)** — symmetric
  to the tags case above.
- **Diff-driven "what changed in last sync" UI** — once we have per-note
  change detection, surface a list in a sidebar or modal: "These 3 notes
  changed in the last sync." Lightweight and useful for transparency.
- **Per-item `last_changed_by_sync` separate from `last_synced_at`** —
  could distinguish "we touched this note" from "we last verified
  it's up to date". Not pursued because `synced_at` post-this-spec
  already captures the former, and the latter doesn't have a clear use
  case.
