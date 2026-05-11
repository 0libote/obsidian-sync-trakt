# 0004 — Submission preparation for Obsidian Community Plugins directory

- **Status**: implemented
- **Released in**: 0.4.0
- **Date**: 2026-05-11
- **Authors**: @o1xhack, Claude

## Context

By 0.3.2 the plugin is feature-stable, install via BRAT works smoothly, and
nothing blocks daily use. The next step is submission to the official
[Obsidian Community Plugins directory](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json),
which would let users install through Obsidian's built-in plugin browser
without needing BRAT.

The submission process is a single-file PR to `obsidian-releases`. The
[validation bot](https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml)
runs automatically on the PR and rejects entries that violate any of a
handful of hard rules. **One of those rules blocks our current state:**

```javascript
if (plugin.id?.toLowerCase().includes('obsidian')) {
  addError(`Please don't use the word \`obsidian\` in the plugin ID. ...`);
}
```

Our current `manifest.json` has `"id": "obsidian-sync-trakt"`. We have to
change it. That's a data-touching change (the plugin id is the folder
name under `.obsidian/plugins/<id>/`), so we also need a migration story
for existing BRAT-installed users — otherwise their data.json sits
abandoned at the old folder path while the upgraded plugin sees a fresh
default-state at the new folder path.

While we're touching the manifest, we also fix a long-standing minor
issue: `minAppVersion` is set to `1.4.0`, but our actual minimum is
`1.6.6` (we use `fileManager.trashFile` which has `@since 1.6.6` in
the official `obsidian.d.ts`). Without enabling `deleteRemovedItems`,
the older floor was harmless. But the declaration was inaccurate, and
fixing it before public submission is the right time.

## Goals / Non-goals

### Goals

- `manifest.json` `id` complies with the bot's "no `obsidian` in id" rule
- `manifest.json` `minAppVersion` accurately reflects the highest
  `@since` of any API the plugin actually calls
- Existing BRAT users (anyone who's been running 0.3.x) get their
  data — Trakt tokens, TMDB cache, history state, all settings —
  migrated to the new folder path on first launch of 0.4.0,
  **transparently**, with a single one-time confirmation Notice
- After migration, the old folder is **left in place** (not deleted)
  as a safety net in case the user reverts. Cleanup is the user's
  decision
- Submission to the directory is decoupled from this release — 0.4.0
  ships first, then the user manually submits the PR (this gives them
  control over the timing and PR description)

### Non-goals

- **Renaming the GitHub repo.** The repo stays at
  `o1xhack/obsidian-sync-trakt`. GitHub redirects + BRAT's HTTP-301
  following mean external links / BRAT subscriptions keep working
  with no churn. Keeping the repo name also keeps URLs in 9 READMEs,
  spec docs, changelog, release notes all valid without a doc sweep.
- **Renaming the display name.** `"Obsidian Sync Trakt"` stays. The
  bot doesn't check display name, only id. Reviewers occasionally
  request dropping "Obsidian" from display names, but it's a
  comment-and-fix flow during human review, not a bot block. If
  flagged, we change it in a 0.4.1 — cheaper than pre-emptively
  updating all docs.
- **Auto-deleting the old folder.** Leaving it in place protects users
  who downgrade. After a few releases (when downgrade is unlikely),
  a future cleanup spec could add a "remove legacy folder" step.

## Design

Three small pieces — manifest update, migration code, tests.

### Part A — Manifest update

```diff
- "id": "obsidian-sync-trakt",
+ "id": "sync-trakt",
- "minAppVersion": "1.4.0",
+ "minAppVersion": "1.6.6",
```

`name`, `description`, `author`, `authorUrl`, `isDesktopOnly` stay
unchanged.

### Part B — Migration code (in main.ts loadSettings)

The migration runs **once** per device, the first time 0.4.0 starts up
on that device. Trigger: `data.json` is missing from the new folder
(plugin's default load returns `null`) AND `data.json` exists at the
old folder path.

```typescript
async loadSettings() {
  let loaded = (await this.loadData()) as Partial<TraktrSettings> | null;
  if (!loaded) {
    loaded = await this.migrateFromLegacyFolder();
  }
  Object.assign(this.settings, DEFAULT_SETTINGS, loaded ?? {});
}

private async migrateFromLegacyFolder(): Promise<Partial<TraktrSettings> | null> {
  const legacyPath = normalizePath(
    `${this.app.vault.configDir}/plugins/obsidian-sync-trakt/data.json`,
  );
  try {
    const exists = await this.app.vault.adapter.exists(legacyPath);
    if (!exists) return null;

    const raw = await this.app.vault.adapter.read(legacyPath);
    const parsed = JSON.parse(raw) as Partial<TraktrSettings>;

    // Write to the new folder via the standard plugin API so it's
    // canonically located at `.obsidian/plugins/sync-trakt/data.json`.
    await this.saveData(parsed);

    new Notice(
      getTranslator(parsed.uiLanguage as UiLanguage | undefined ?? "en")(
        "notice.migratedFromLegacyFolder",
      ),
      8000,
    );
    console.info(
      "[Traktr] Migrated data.json from " +
      ".obsidian/plugins/obsidian-sync-trakt/ → .obsidian/plugins/sync-trakt/. " +
      "Old folder left in place; safe to delete manually after confirming.",
    );
    return parsed;
  } catch (e) {
    console.warn("[Traktr] Legacy-folder migration failed:", e);
    return null;
  }
}
```

Key decisions:

- **Uses `vault.adapter.read`** (a low-level filesystem API) to read
  from outside our plugin's own folder. `loadData()` only reads our
  own folder, so we can't use it for cross-folder reading.
- **Catches all exceptions** and degrades to "no migration, use
  DEFAULT_SETTINGS". A migration failure should never leave the user
  unable to launch the plugin.
- **Translates the Notice** using the recovered `uiLanguage` if
  available, falling back to English. So a user who had set the UI to
  Chinese still sees the migration message in Chinese.
- **Does not delete the legacy folder.** A `console.info` line tells
  power users it's safe to delete manually. Automated deletion is
  out of scope here — too risky for too little benefit (one folder
  per Obsidian vault).

### Part C — Idempotency check

After the first run, `data.json` exists in the new folder, so
`loadData()` returns the migrated state on subsequent runs and
`migrateFromLegacyFolder` is never called. The check is implicit:
the migration only runs when `loaded === null`.

The legacy folder's `data.json` is **not** modified during migration,
so if the user keeps both 0.3.x (via BRAT pinning) and 0.4.0
installed simultaneously, both versions remain functional with their
own state. No corruption hazard.

### Submission flow (out of scope code-wise, in scope process-wise)

After 0.4.0 release lands and works in the user's main vault:

1. User forks `obsidianmd/obsidian-releases`
2. Edits `community-plugins.json`, adds at the end:
   ```json
   {
     "id": "sync-trakt",
     "name": "Obsidian Sync Trakt",
     "author": "o1xhack",
     "description": "Sync your Trakt.tv watchlist, watch history, favorites, and ratings into Obsidian notes — with metadata localization and detailed per-episode watch timestamps.",
     "repo": "o1xhack/obsidian-sync-trakt"
   }
   ```
3. Opens PR titled `Add plugin: Obsidian Sync Trakt`
4. Fills the PR template (checkboxes for the 9 self-review items)
5. Waits for `Ready for review` label from the bot
6. Addresses reviewer comments if any

## Edge cases

| # | Scenario | Behavior |
|---|---|---|
| 1 | Fresh install of 0.4.0 (no legacy folder) | `loadData()` returns null; legacy folder check returns false; falls back to DEFAULT_SETTINGS. Normal first-run experience |
| 2 | 0.3.x user upgrading via BRAT | `loadData()` returns null (new folder empty); legacy folder check finds the old data.json; migration runs; Notice shown; subsequent loads see the migrated state |
| 3 | User reverts 0.4.0 → 0.3.x via BRAT | Legacy folder's data.json was never deleted, so 0.3.x picks back up where it left off. Any changes made in 0.4.0 are NOT propagated back — they live in the new folder. Documented as expected |
| 4 | User has both versions installed (legacy + new ids) somehow | Each version reads its own folder; no cross-contamination. Edge case unlikely in practice but safe |
| 5 | Legacy data.json is malformed JSON | `JSON.parse` throws; caught; logged; falls back to DEFAULT_SETTINGS. Plugin still launches |
| 6 | Filesystem permission denied on legacy folder | `vault.adapter.read` throws; caught; logged; falls back to DEFAULT_SETTINGS |
| 7 | User explicitly deletes legacy folder after migration | No effect — current state is in the new folder. Cleanup encouraged but not required |
| 8 | Migration runs successfully but `saveData()` fails | Try-catch around saveData would let plugin start with the parsed state in memory but no on-disk backup. We don't add an extra try around saveData here — if it fails, something larger is wrong and we want it surfaced. Plugin will still work for the current session |

## Tests

`tests/i18n.smoke.ts`:

- Migration path is reachable via a mock vault adapter that returns
  a known-good data.json from the legacy path
- Migration handles malformed JSON gracefully (returns null, doesn't
  throw)
- Migration handles missing legacy file (returns null, doesn't throw)
- After migration, the parsed state matches the source legacy state
  byte-for-byte (no mutation in transit)

Migration is tested in isolation as a pure async function. The
`onload`-level integration is covered by manual smoke during release
verification.

## Migration / backward compatibility

- **From 0.3.x via BRAT**: transparent — see edge case 2
- **Fresh install**: no migration runs; standard first-run setup
- **Downgrade to 0.3.x**: works — legacy folder still contains the
  pre-upgrade state (and possibly newer state if BRAT polled before
  the user reverted, but BRAT doesn't sync back)

## Future work

- **Auto-delete legacy folder after N successful syncs** — could be
  added in a later release once we're confident no users need to
  revert. Not pressing.
- **Submission to directory** — process documented above; user
  executes manually after this release
- **Display name change if reviewer requests** — 0.4.1 hotfix-style
  release, no code changes, just `manifest.json` name field +
  README sweep
