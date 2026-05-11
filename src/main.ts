import { Notice, Plugin, normalizePath } from "obsidian";
import {
  DEFAULT_SETTINGS,
  TraktrSettingTab,
  type TraktrSettings,
} from "./settings";
import { AuthModal } from "./trakt-auth";
import { SyncEngine } from "./sync-engine";
import { getTranslator, type UiLanguage } from "./i18n";
import { clearTmdbCache } from "./tmdb-api";

/**
 * [0.4.0] The plugin's folder name changed from `obsidian-sync-trakt`
 * (used 0.1.0 → 0.3.x) to `sync-trakt` (required for Obsidian's official
 * Community Plugins directory — bot rejects ids containing "obsidian").
 * `LEGACY_PLUGIN_ID` is the old folder name we migrate FROM. See
 * spec 0004 for the migration design + edge cases.
 */
const LEGACY_PLUGIN_ID = "obsidian-sync-trakt";

export default class TraktrPlugin extends Plugin {
  settings: TraktrSettings = { ...DEFAULT_SETTINGS };
  private syncEngine!: SyncEngine;
  private autoSyncIntervalId: number | null = null;
  private statusBarEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    console.debug(
      "[Traktr] Plugin loaded. Connected:",
      !!this.settings.accessToken,
    );

    this.syncEngine = new SyncEngine(this.app, this.settings, () =>
      this.saveSettings(),
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
      callback: async () => {
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
      const parsed = JSON.parse(raw) as Partial<TraktrSettings>;

      // Write to the new folder via the standard plugin API.
      await this.saveData(parsed);

      // Surface the migration so the user knows what just happened.
      // Translates to the user's saved UI language if available.
      const lang: UiLanguage = parsed.uiLanguage ?? "en";
      new Notice(
        getTranslator(lang)("notice.migratedFromLegacyFolder"),
        8000,
      );
      console.debug(
        `[Traktr] Migrated data.json from .obsidian/plugins/${LEGACY_PLUGIN_ID}/ ` +
          `→ .obsidian/plugins/sync-trakt/. Old folder left in place; safe to delete manually after confirming.`,
      );
      return parsed;
    } catch (e) {
      console.warn(
        "[Traktr] Legacy-folder migration failed; continuing with defaults:",
        e,
      );
      return null;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * [0.2.0] Re-read data.json from disk and merge into the in-memory
   * `this.settings`. Triggered when Obsidian becomes visible again, so
   * settings + cache state synced from another device (Mac → iPhone via
   * Obsidian Sync, etc.) are picked up without requiring a manual reload
   * of the plugin.
   *
   * In-place mutation is essential — see loadSettings() comment.
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
