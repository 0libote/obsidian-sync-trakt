import { Notice, Plugin, normalizePath } from "obsidian";
import {
  DEFAULT_SETTINGS,
  DEFAULT_LOCAL_KEYS,
  LOCAL_ELIGIBLE_KEYS,
  LOCAL_KEYS_STORAGE_KEY,
  LOCAL_STORAGE_PREFIX,
  TraktrSettingTab,
  type LocalEligibleKey,
  type TraktrSettings,
} from "./settings";
import { AuthModal } from "./trakt-auth";
import { SyncEngine } from "./sync-engine";
import { getTranslator, type UiLanguage } from "./i18n";
import { clearTmdbCache } from "./tmdb-api";
import type { NormalizedItem } from "./types";
import {
  processCatchUp,
  processDate,
  localTodayISODate,
  type DailyNotesHost,
} from "./daily-notes";

/**
 * [0.4.0] The plugin's folder name changed from `obsidian-sync-trakt`
 * (used 0.1.0 → 0.3.x) to `sync-trakt` (required for Obsidian's official
 * Community Plugins directory — bot rejects ids containing "obsidian").
 * `LEGACY_PLUGIN_ID` is the old folder name we migrate FROM. See
 * spec 0004 for the migration design + edge cases.
 */
const LEGACY_PLUGIN_ID = "obsidian-sync-trakt";

/**
 * [0.5.2] Files we remove from the legacy folder after a successful
 * migration. We DELIBERATELY keep `data.json` in place — it's the
 * user's recovered state, and acts as a last-resort safety net if
 * something goes wrong with the new folder (re-running migration is a
 * no-op when our own data.json exists, so the safety net is read-only
 * after this point).
 *
 * Deleting only the binaries removes the duplicate plugin entry from
 * Obsidian's plugin list (no manifest.json = not recognized as a
 * plugin) without sacrificing the recovery option.
 */
const LEGACY_BINARY_FILES = ["main.js", "manifest.json", "styles.css"];

export default class TraktrPlugin extends Plugin {
  settings: TraktrSettings = { ...DEFAULT_SETTINGS };
  /**
   * [0.5.0] The set of setting keys that live in localStorage on THIS
   * device (overriding their data.json values). The set is loaded from
   * localStorage at onload and mutated via setKeyIsLocal. See spec 0003.
   */
  localKeys: Set<LocalEligibleKey> = new Set();
  /**
   * [0.7.0] Cached map of merged items from the most recent sync.
   * Used by the Daily Notes backfill button (which runs outside a
   * sync context). Populated by SyncEngine.sync() right before
   * reconcileType. Empty array on plugin startup before first sync.
   */
  lastMergedItems: NormalizedItem[] = [];
  private syncEngine!: SyncEngine;
  private autoSyncIntervalId: number | null = null;
  private statusBarEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    console.debug(
      "[Traktr] Plugin loaded. Connected:",
      !!this.settings.accessToken,
    );

    // [0.5.2] If the legacy folder still has binary files lying around,
    // delete them — but keep data.json. Runs on every launch and is
    // idempotent (no-op when binaries are already gone), so it catches
    // both fresh-migrated and previously-migrated devices uniformly.
    // Fires AFTER loadSettings so migration (if needed) has completed
    // and we're already running off the new folder's data.
    void this.cleanupLegacyBinaries();

    this.syncEngine = new SyncEngine(
      this.app,
      this.settings,
      () => this.saveSettings(),
      async (mergedItems) => {
        // [0.7.0] After-sync hook — stash merged items for the
        // settings-tab Backfill button, then run Daily Notes
        // catch-up. Failures are swallowed inside SyncEngine.sync()
        // so they never break the main sync result.
        this.lastMergedItems = mergedItems;
        if (this.settings.dailyNotesEnabled) {
          const host: DailyNotesHost = {
            app: this.app,
            settings: this.settings,
            saveSettings: () => this.saveSettings(),
            getMergedItems: () => this.lastMergedItems,
          };
          const result = await processCatchUp(host);
          const t = getTranslator(this.settings.uiLanguage);
          new Notice(
            t("daily.catchUpDone", {
              todayMode: result.todayMode,
              pastWrote: result.pastWrote,
              pastSkipped: result.pastSkipped,
            }),
            6000,
          );
        }
      },
    );

    // Settings tab
    this.addSettingTab(new TraktrSettingTab(this.app, this));

    // [0.2.0] Re-read data.json from disk when Obsidian becomes visible
    // again. Cross-device flow: Mac syncs, vault sync layer propagates
    // data.json to iPhone; if the iPhone plugin only read data.json once
    // at onload(), the new state would be invisible until reload. This
    // catches the user-returns-to-app event and pulls fresh state.
    this.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void this.refreshSettingsFromDisk();
      }
    });

    const t = getTranslator(this.settings.uiLanguage);

    // Commands. Note: Obsidian caches command names at registration time, so
    // changing the UI language requires reloading the plugin to refresh
    // command palette labels. Documented behavior — not worth a bigger fix.
    this.addCommand({
      id: "trakt-sync",
      name: t("cmd.sync"),
      callback: async () => {
        if (!this.settings.accessToken) {
          new Notice(
            getTranslator(this.settings.uiLanguage)("notice.notConnected"),
          );
          return;
        }
        await this.runSyncWithProgress();
      },
    });

    this.addCommand({
      id: "trakt-connect",
      name: t("cmd.connect"),
      callback: () => {
        const tNow = getTranslator(this.settings.uiLanguage);
        if (!this.settings.clientId || !this.settings.clientSecret) {
          new Notice(tNow("notice.needCredentials"));
          return;
        }
        this.startAuth();
      },
    });

    this.addCommand({
      id: "trakt-disconnect",
      name: t("cmd.disconnect"),
      callback: async () => {
        const tNow = getTranslator(this.settings.uiLanguage);
        this.settings.accessToken = "";
        this.settings.refreshToken = "";
        this.settings.tokenExpiresAt = 0;
        await this.saveSettings();
        new Notice(tNow("auth.connection.disconnectedNotice"));
      },
    });

    // [0.2.0] Force a full Trakt history refresh on the next sync. Useful
    // when the user knows they just deleted a wrong scrobble on Trakt
    // and wants the plugin to detect it now instead of waiting for the
    // periodic full-refresh interval.
    this.addCommand({
      id: "trakt-force-full-history-refresh",
      name: t("cmd.forceFullHistoryRefresh"),
      callback: async () => {
        if (!this.settings.accessToken) {
          new Notice(
            getTranslator(this.settings.uiLanguage)("notice.notConnected"),
          );
          return;
        }
        await this.runSyncWithProgress({ forceFullHistoryRefresh: true });
      },
    });

    // [0.2.0] Drop every TMDB cache entry. The next sync re-fetches
    // metadata for every item from TMDB. Useful as a "refresh everything"
    // escape hatch when the user notices stale titles / posters that
    // outlast the configured TTL.
    this.addCommand({
      id: "trakt-clear-tmdb-cache",
      name: t("cmd.clearTmdbCache"),
      callback: async () => {
        const tNow = getTranslator(this.settings.uiLanguage);
        clearTmdbCache(this.settings.tmdbCache);
        await this.saveSettings();
        new Notice(tNow("tmdb.cache.clear.notice"));
      },
    });

    // [0.7.0] Today-only manual refresh of Daily Notes. Useful when
    // user wants to re-render today's entries without doing a full
    // Trakt sync. NOT linked to the Backfill button (which is a more
    // deliberate multi-day action and lives in settings only).
    this.addCommand({
      id: "trakt-sync-daily-notes-today",
      name: t("cmd.syncDailyNotesToday"),
      callback: async () => {
        const tNow = getTranslator(this.settings.uiLanguage);
        if (!this.settings.dailyNotesEnabled) {
          new Notice("Daily notes integration is disabled.");
          return;
        }
        const today = localTodayISODate();
        const host: DailyNotesHost = {
          app: this.app,
          settings: this.settings,
          saveSettings: () => this.saveSettings(),
          getMergedItems: () => this.lastMergedItems,
        };
        const result = await processDate(host, today, "today");
        new Notice(
          tNow("daily.catchUpDone", {
            todayMode: result.status,
            pastWrote: 0,
            pastSkipped: 0,
          }),
          6000,
        );
      },
    });

    // Status bar — only shown transiently during sync
    this.statusBarEl = this.addStatusBarItem();

    // Auto-sync
    this.configureAutoSync();

    // Sync on startup (delayed to let Obsidian finish loading)
    if (this.settings.syncOnStartup && this.settings.accessToken) {
      window.setTimeout(() => {
        void this.runSyncWithProgress();
      }, 5000);
    }
  }

  /**
   * Run a sync and surface live progress to the user. Drives BOTH:
   *   - the status bar (visible on desktop only — Obsidian's plugin API
   *     doesn't render status bar items on iOS / Android)
   *   - a persistent Notice (visible on every platform) — created with
   *     `new Notice(msg, 0)` so it stays up until we call `.hide()`,
   *     then `.setMessage()` updates the same notice in place rather
   *     than spamming a fresh notice for every progress tick.
   *
   * The Notice is the only visible feedback channel on mobile. Without
   * it, tapping "Traktr: Sync" on iPhone looked like nothing was
   * happening for the entire duration of the sync.
   */
  private async runSyncWithProgress(
    options: { forceFullHistoryRefresh?: boolean } = {},
  ): Promise<void> {
    const tNow = getTranslator(this.settings.uiLanguage);
    const initialMsg = tNow("status.syncing");
    const progressNotice = new Notice(
      `${tNow("status.prefix")}${initialMsg}`,
      0,
    );
    this.updateStatusBar(initialMsg);
    try {
      await this.syncEngine.sync((msg) => {
        this.updateStatusBar(msg);
        progressNotice.setMessage(`${tNow("status.prefix")}${msg}`);
      }, options);
    } finally {
      progressNotice.hide();
      this.updateStatusBar("");
    }
  }

  async loadSettings() {
    let loaded = (await this.loadData()) as Partial<TraktrSettings> | null;
    // [0.4.0] If our own data.json is empty, check whether this is a
    // 0.3.x → 0.4.0 upgrade with a legacy folder still sitting at
    // `.obsidian/plugins/obsidian-sync-trakt/`. If so, migrate the user's
    // state (Trakt tokens, TMDB cache, history state, settings) over to
    // the new folder transparently. The check is implicit / idempotent:
    // once migrated, our own data.json is populated, so this branch
    // never fires again. See spec 0004.
    if (!loaded) {
      loaded = await this.migrateFromLegacyFolder();
    }
    // [0.2.0] Mutate `this.settings` IN PLACE so SyncEngine's reference
    // (set via the constructor) stays valid. Replacing the object would
    // leave SyncEngine pointing at stale data.
    Object.assign(this.settings, DEFAULT_SETTINGS, loaded ?? {});

    // [0.5.0] Apply device-local overrides on top of data.json values.
    // See spec 0003 for design rationale.
    this.loadLocalKeysAndApplyOverlay();
  }

  /**
   * [0.5.0] Load the `_localKeys` list from localStorage. On the very
   * first 0.5.0 launch (list is missing), seed with the default-local
   * set per spec 0003. Then overlay all local values onto `this.settings`,
   * overriding whatever came from data.json.
   *
   * The metadata about "which keys are local on this device" is itself
   * device-local — stored in localStorage, NOT data.json. So Mac and
   * iPhone can have different sets of local keys, independently.
   */
  private loadLocalKeysAndApplyOverlay(): void {
    const eligible = new Set<string>(LOCAL_ELIGIBLE_KEYS);
    // [0.7.1] Runtime-validate the stored value instead of casting blindly.
    // app.loadLocalStorage returns `any | null` and we'd rather degrade
    // to "first launch" defaults than hand a corrupted array downstream.
    const rawUnknown: unknown = this.app.loadLocalStorage(
      LOCAL_KEYS_STORAGE_KEY,
    );
    const raw: string[] | null = Array.isArray(rawUnknown)
      ? rawUnknown.filter((v): v is string => typeof v === "string")
      : null;

    let localKeys: LocalEligibleKey[];
    if (raw === null) {
      // First 0.5.0 launch on this device — seed defaults and migrate the
      // current data.json value for each into localStorage so the user's
      // current state is preserved when we start excluding these from
      // data.json on subsequent saves.
      localKeys = [...DEFAULT_LOCAL_KEYS];
      this.app.saveLocalStorage(LOCAL_KEYS_STORAGE_KEY, localKeys);
      for (const key of localKeys) {
        this.app.saveLocalStorage(
          `${LOCAL_STORAGE_PREFIX}${key}`,
          this.settings[key],
        );
      }
      console.debug(
        "[Traktr] First 0.5.0 launch — seeded device-local keys:",
        localKeys,
      );
    } else {
      // Filter to currently-eligible keys (defensive — in case
      // LOCAL_ELIGIBLE_KEYS shrunk in a future release).
      localKeys = raw.filter((k): k is LocalEligibleKey => eligible.has(k));
    }
    this.localKeys = new Set(localKeys);
    this.applyLocalOverlay();
  }

  /**
   * Apply localStorage values for each local key onto `this.settings`,
   * overriding the value loaded from data.json. Called on initial load
   * and on refreshSettingsFromDisk so local overrides keep winning
   * after Obsidian Sync deposits a new data.json from another device.
   */
  private applyLocalOverlay(): void {
    for (const key of this.localKeys) {
      const localValue: unknown = this.app.loadLocalStorage(
        `${LOCAL_STORAGE_PREFIX}${key}`,
      );
      if (localValue !== null && localValue !== undefined) {
        (this.settings as unknown as Record<string, unknown>)[key] = localValue;
      }
    }
  }

  /**
   * [0.5.0] Toggle whether a setting key is device-local. Moves the
   * current value to / from localStorage; persists the updated
   * `_localKeys` list; triggers a full saveSettings so data.json
   * reflects the new partition.
   */
  async setKeyIsLocal(
    key: LocalEligibleKey,
    isLocal: boolean,
  ): Promise<void> {
    if (isLocal) {
      this.localKeys.add(key);
      // Persist the current in-memory value to localStorage so it
      // survives the data.json strip happening in saveSettings.
      this.app.saveLocalStorage(
        `${LOCAL_STORAGE_PREFIX}${key}`,
        this.settings[key],
      );
    } else {
      this.localKeys.delete(key);
      // Clear the localStorage entry — value lives in data.json from now.
      this.app.saveLocalStorage(`${LOCAL_STORAGE_PREFIX}${key}`, null);
    }
    this.app.saveLocalStorage(LOCAL_KEYS_STORAGE_KEY, [...this.localKeys]);
    await this.saveSettings();
  }

  /**
   * [0.4.0] One-time migration from the legacy `obsidian-sync-trakt`
   * folder to the new `sync-trakt` folder. Triggered the first time
   * 0.4.0 launches on a device that previously had 0.1.0-0.3.x installed.
   *
   * The legacy folder is read but NOT deleted — this is a safety net so
   * users who downgrade via BRAT find their old state intact. A console
   * line tells the user it's safe to delete manually after they've
   * confirmed 0.4.0 works.
   *
   * All exceptions are swallowed and the function returns null on
   * failure: a migration error should never block plugin launch.
   */
  private async migrateFromLegacyFolder(): Promise<Partial<TraktrSettings> | null> {
    const legacyPath = normalizePath(
      `${this.app.vault.configDir}/plugins/${LEGACY_PLUGIN_ID}/data.json`,
    );
    try {
      const exists = await this.app.vault.adapter.exists(legacyPath);
      if (!exists) return null;

      const raw = await this.app.vault.adapter.read(legacyPath);
      const parsed: unknown = JSON.parse(raw);

      // [0.7.1] Validate the parsed value is a plain object before
      // treating it as TraktrSettings. JSON.parse can return null, an
      // array, a primitive, etc. — none of which are safe to feed into
      // saveData() / Object.assign() downstream. A corrupted legacy
      // data.json that parses to e.g. `null` would otherwise loop the
      // migration on every launch (we'd write null, next load returns
      // null, migration sees null, repeat). Reject and degrade to
      // DEFAULT_SETTINGS instead.
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        console.warn(
          "[Traktr] Legacy data.json contains non-object root; skipping migration.",
        );
        return null;
      }
      const settings = parsed as Partial<TraktrSettings>;

      // Write to the new folder via the standard plugin API.
      await this.saveData(settings);

      // Surface the migration so the user knows what just happened.
      // Translates to the user's saved UI language if available.
      const lang: UiLanguage = settings.uiLanguage ?? "en";
      new Notice(
        getTranslator(lang)("notice.migratedFromLegacyFolder"),
        8000,
      );
      console.debug(
        `[Traktr] Migrated data.json from .obsidian/plugins/${LEGACY_PLUGIN_ID}/ ` +
          `→ .obsidian/plugins/sync-trakt/. Binary files in the legacy folder will be cleaned up on this launch; data.json is preserved as a recovery safety net.`,
      );
      return settings;
    } catch (e) {
      console.warn(
        "[Traktr] Legacy-folder migration failed; continuing with defaults:",
        e,
      );
      return null;
    }
  }

  /**
   * [0.5.2] Remove the binary files (main.js / manifest.json / styles.css)
   * from the legacy `obsidian-sync-trakt` folder while keeping data.json
   * untouched. Result:
   *
   *   - Obsidian no longer recognizes the legacy folder as a plugin
   *     (no manifest.json), so the duplicate entry disappears from
   *     Settings → Community plugins.
   *   - data.json remains as a recovery snapshot if the user needs to
   *     fall back. The folder is otherwise harmless cruft the user can
   *     delete manually whenever they like.
   *
   * Idempotent and silent: missing files / permission errors are
   * swallowed. Runs on every onload so it catches devices that
   * migrated under 0.4.0-0.5.1 (when this cleanup didn't exist) on
   * their next launch of 0.5.2+.
   *
   * Multi-device safety: each device runs this independently. When
   * Mac runs it and the vault sync layer propagates the deletions to
   * iPhone, iPhone's still-on-0.3.x plugin won't load on next launch
   * (no manifest.json), but BRAT will then install 0.5.2 to the new
   * `sync-trakt/` folder on iPhone, the migrateFromLegacyFolder code
   * will find the still-intact data.json, and everything recovers.
   */
  private async cleanupLegacyBinaries(): Promise<void> {
    const base = `${this.app.vault.configDir}/plugins/${LEGACY_PLUGIN_ID}`;
    for (const file of LEGACY_BINARY_FILES) {
      const path = normalizePath(`${base}/${file}`);
      try {
        if (await this.app.vault.adapter.exists(path)) {
          await this.app.vault.adapter.remove(path);
          console.debug(`[Traktr] Removed legacy binary: ${path}`);
        }
      } catch (e) {
        // Permission denied / file locked / other adapter errors — best
        // effort. Try again next launch. Never block plugin startup on
        // cleanup failures.
        console.debug(`[Traktr] Could not remove ${path}:`, e);
      }
    }
  }

  async saveSettings() {
    // [0.5.0] Split storage per spec 0003: local-marked keys go to
    // localStorage, the rest to data.json. Doing this split on every
    // save keeps the two layers consistent and means no special-case
    // write path — just two destinations.
    for (const key of this.localKeys) {
      this.app.saveLocalStorage(
        `${LOCAL_STORAGE_PREFIX}${key}`,
        this.settings[key],
      );
    }
    const synced = { ...this.settings } as Partial<TraktrSettings>;
    for (const key of this.localKeys) {
      delete synced[key];
    }
    await this.saveData(synced);
  }

  /**
   * [0.2.0] Re-read data.json from disk and merge into the in-memory
   * `this.settings`. Triggered when Obsidian becomes visible again, so
   * settings + cache state synced from another device (Mac → iPhone via
   * Obsidian Sync, etc.) are picked up without requiring a manual reload
   * of the plugin.
   *
   * In-place mutation is essential — see loadSettings() comment.
   *
   * [0.5.0] After applying the fresh data.json, we re-apply the local
   * overlay so device-local keys keep winning. Without this step, a
   * data.json sync from another device would clobber the local values
   * for keys that THIS device has marked local.
   */
  private async refreshSettingsFromDisk(): Promise<void> {
    try {
      const fresh = (await this.loadData()) as Partial<TraktrSettings> | null;
      // Wipe optional fields that may have been removed in the new state
      // (e.g. someone cleared their TMDB cache on another device — we'd
      // want this device to reflect that empty cache).
      const stale = this.settings as unknown as Record<string, unknown>;
      for (const k of Object.keys(stale)) delete stale[k];
      Object.assign(this.settings, DEFAULT_SETTINGS, fresh);
      // Re-overlay localStorage values on top of the fresh data.json.
      this.applyLocalOverlay();
    } catch (e) {
      console.warn("[Traktr] Failed to refresh settings from disk:", e);
    }
  }

  /**
   * Start the Trakt device auth flow.
   */
  startAuth(): void {
    const modal = new AuthModal(this.app, this.settings, async () => {
      await this.saveSettings();
    });
    modal.open();
  }

  /**
   * Configure or reconfigure the auto-sync interval.
   */
  configureAutoSync() {
    // Clear existing interval
    if (this.autoSyncIntervalId !== null) {
      window.clearInterval(this.autoSyncIntervalId);
      this.autoSyncIntervalId = null;
    }

    if (this.settings.autoSyncEnabled && this.settings.accessToken) {
      const intervalMs = this.settings.autoSyncIntervalMinutes * 60 * 1000;
      this.autoSyncIntervalId = window.setInterval(() => {
        void (async () => {
          try {
            // Auto-sync uses the same progress channel as the manual command.
            // Visible on every platform via the persistent Notice — important
            // on mobile where the status bar isn't rendered.
            await this.runSyncWithProgress();
          } catch (e) {
            console.error("Trakt auto-sync failed:", e);
            this.updateStatusBar("");
          }
        })();
      }, intervalMs);
      // Register for cleanup
      this.registerInterval(this.autoSyncIntervalId);
    }
  }

  private updateStatusBar(status: string) {
    if (this.statusBarEl) {
      const t = getTranslator(this.settings.uiLanguage);
      this.statusBarEl.setText(status ? `${t("status.prefix")}${status}` : "");
    }
  }
}
