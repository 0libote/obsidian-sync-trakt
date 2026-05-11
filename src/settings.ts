import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type TraktrPlugin from "./main";
import { getTranslator, type UiLanguage } from "./i18n";
import {
  EMPTY_HISTORY_STATE,
  type HistoryState,
  type TmdbCache,
} from "./types";
import { clearTmdbCache, tmdbCacheStats, verifyTmdbApiKey } from "./tmdb-api";
import { clearHistoryState, historyStateStats } from "./history-state";

export const POSTER_SIZES = [
  "w92",
  "w154",
  "w185",
  "w342",
  "w500",
  "w780",
  "original",
] as const;

export type PosterSize = (typeof POSTER_SIZES)[number];

/**
 * [0.5.0] Settings that can be marked as "device-local" per spec 0003.
 *
 * These are the settings whose semantics make per-device divergence
 * legitimate — auto-sync timing varies by device, UI language can vary
 * by user-of-device, etc. Everything else (auth tokens, sync content
 * toggles, metadata language, templates, etc.) always lives in data.json
 * and follows vault sync.
 *
 * Each device independently records WHICH of these keys are local on it
 * (the `_localKeys` array in localStorage). This means Mac can have
 * `uiLanguage` local while iPhone keeps it synced — the metadata about
 * who's local is itself device-local, not synced.
 */
export const LOCAL_ELIGIBLE_KEYS = [
  "syncOnStartup",
  "autoSyncEnabled",
  "autoSyncIntervalMinutes",
  "uiLanguage",
] as const;
export type LocalEligibleKey = (typeof LOCAL_ELIGIBLE_KEYS)[number];

/**
 * [0.5.0] On first 0.5.0 launch (no `_localKeys` in localStorage yet),
 * these keys default to local on that device. The auto-sync trio fits
 * here because cross-device sync of these settings causes redundant
 * syncs / Trakt API traffic for zero user benefit (each device should
 * pick its own cadence). `uiLanguage` defaults to SYNCED — most users
 * want the same UI language everywhere — but it remains togglable via
 * the cloud icon.
 */
export const DEFAULT_LOCAL_KEYS: ReadonlyArray<LocalEligibleKey> = [
  "syncOnStartup",
  "autoSyncEnabled",
  "autoSyncIntervalMinutes",
];

/**
 * Namespace prefix for all localStorage keys this plugin owns. Obsidian's
 * `app.loadLocalStorage` / `saveLocalStorage` are vault-scoped, but the
 * prefix lets us coexist with other plugins (and our own future keys)
 * within the same vault's local storage.
 */
export const LOCAL_STORAGE_PREFIX = "sync-trakt:";

/** Key under which the list of currently-local setting keys is stored. */
export const LOCAL_KEYS_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}_localKeys`;

/** Preset language options shown in the Localization (metadata) dropdown.
 * The Note template language dropdown reuses this same list for symmetry,
 * even though the plugin only ships translated default templates for English
 * and Simplified/Traditional Chinese (other codes resolve to the English
 * default — users can still customize manually). */
export const METADATA_LANGUAGE_PRESETS: ReadonlyArray<readonly [string, string]> = [
  ["", "Default (English / Trakt original)"],
  ["zh-CN", "Chinese (Simplified, China)"],
  ["zh-TW", "Chinese (Traditional, Taiwan)"],
  ["zh-HK", "Chinese (Traditional, Hong Kong)"],
  ["ja-JP", "Japanese"],
  ["ko-KR", "Korean"],
  ["en-US", "English (United States)"],
  ["en-GB", "English (United Kingdom)"],
  ["fr-FR", "French"],
  ["de-DE", "German"],
  ["es-ES", "Spanish (Spain)"],
  ["es-MX", "Spanish (Mexico)"],
  ["pt-BR", "Portuguese (Brazil)"],
  ["it-IT", "Italian"],
  ["ru-RU", "Russian"],
];

const PRESET_LANGUAGE_VALUES: ReadonlySet<string> = new Set(
  METADATA_LANGUAGE_PRESETS.map(([v]) => v),
);

/**
 * Resolve the effective language code to use for translation requests.
 * Returns "" when localization is disabled (no preset selected, or "custom"
 * with no code typed).
 */
export function getEffectiveMetadataLanguage(settings: TraktrSettings): string {
  const dropdown = (settings.metadataLanguage || "").trim();
  if (dropdown === "custom") {
    return (settings.customMetadataLanguage || "").trim();
  }
  return dropdown;
}

/** True when the saved metadata-language dropdown value is "custom". */
function isCustomLanguageMode(settings: TraktrSettings): boolean {
  return (settings.metadataLanguage || "").trim() === "custom";
}

/**
 * Resolve the effective language code for picking a default note template.
 * Mirrors getEffectiveMetadataLanguage but for the templateLanguage field.
 */
export function getEffectiveTemplateLanguage(
  settings: TraktrSettings,
): string {
  const dropdown = (settings.templateLanguage || "").trim();
  if (dropdown === "custom") {
    return (settings.customTemplateLanguage || "").trim();
  }
  return dropdown;
}

/** True when the template-language dropdown is set to "custom". */
function isCustomTemplateLanguageMode(settings: TraktrSettings): boolean {
  return (settings.templateLanguage || "").trim() === "custom";
}

export interface TraktrSettings {
  // Authentication
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;

  // TMDB
  tmdbApiKey: string;
  posterSize: PosterSize;

  // Localization (i18n)
  // metadataLanguage: dropdown value — "" (disabled), one of the presets, or
  //   the literal string "custom".
  // customMetadataLanguage: user-typed code, only consulted when
  //   metadataLanguage === "custom".
  // uiLanguage: language of the plugin's settings tab, command names, and
  //   notice popups. Independent from metadataLanguage. Limited to en/zh-CN.
  // templateLanguage: language used by the bundled default Movie / Show note
  //   templates. Same dropdown shape as metadataLanguage (preset codes +
  //   "custom"). The "Reset to default" button on each template applies this.
  // customTemplateLanguage: user-typed code, only consulted when
  //   templateLanguage === "custom".
  metadataLanguage: string;
  customMetadataLanguage: string;
  uiLanguage: UiLanguage;
  templateLanguage: string;
  customTemplateLanguage: string;

  // Property namespace
  propertyPrefix: string;

  // Folders & file naming
  folder: string;
  filenameTemplate: string;

  // Note templates
  movieNoteTemplate: string;
  showNoteTemplate: string;

  // Tags
  addTags: boolean;
  tagPrefix: string;

  // Tag notes
  addTagNotes: boolean;
  createTagNotes: boolean;
  tagNotesFolder: string;

  // Sync sources
  // syncWatched: pulls /sync/watched/* — provides plays count + last
  //   watched timestamp per item.
  // syncWatchedDetail: layered on top, additionally pulls /sync/history to
  //   render per-watch timestamps in the note body via {{watch_history}}.
  //   This endpoint can be very large; off by default.
  syncWatchlist: boolean;
  syncFavorites: boolean;
  syncWatched: boolean;
  syncWatchedDetail: boolean;
  syncRatings: boolean;

  // Sync behavior
  syncMovies: boolean;
  syncShows: boolean;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  syncOnStartup: boolean;
  overwriteExisting: boolean;
  deleteRemovedItems: boolean;

  // ── [0.2.0] TMDB cache ──
  // Persistent across syncs and across devices (lives in data.json which
  // follows the user's vault sync layer). Keyed by
  // `${type}:${tmdbId}:${language || 'default'}` so each (item, language)
  // combination has its own slot.
  tmdbCache: TmdbCache;
  // 0 = never expire. Otherwise the configured days, ±5 days jitter per
  // entry to avoid 1000+ entries all expiring on the same day.
  tmdbCacheTtlDays: number;

  // ── [0.2.0] History state for incremental Trakt history sync ──
  // Only meaningful when syncWatchedDetail is on. Stores aggregated
  // watch events plus the set of every event id we've already seen,
  // letting subsequent syncs do `?start_at=lastIncrementalSyncAt`
  // instead of pulling the full history every time.
  historyState: HistoryState;
  // Periodic full refresh to catch deletions on Trakt's side that an
  // incremental fetch can't see. Default 7 days.
  historyFullRefreshIntervalDays: number;
}

export const DEFAULT_MOVIE_TEMPLATE_EN = `![poster]({{poster_url}})

> {{tagline}}

## Overview
{{overview}}

## Details
- **Runtime**: {{runtime}} min
- **Genres**: {{genres}}
- **Rating**: {{trakt_rating}}/10 ({{trakt_votes}} votes)
- **Certification**: {{certification}}
- **Released**: {{released}}

## Trakt Status
- **Watchlist**: {{watchlist}}
- **Watched**: {{watched}} ({{plays}} plays, last: {{last_watched_at}})
- **Favorite**: {{favorite}}
- **My Rating**: {{my_rating}}/10

{{watch_history}}

## Links
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## My Notes

`;

export const DEFAULT_SHOW_TEMPLATE_EN = `![poster]({{poster_url}})

## Overview
{{overview}}

## Details
- **Network**: {{network}}
- **Runtime**: {{runtime}} min per episode
- **Episodes**: {{aired_episodes}} aired
- **Genres**: {{genres}}
- **Rating**: {{trakt_rating}}/10 ({{trakt_votes}} votes)
- **Certification**: {{certification}}
- **Status**: {{status}}
- **First Aired**: {{first_aired}}

## Trakt Status
- **Watchlist**: {{watchlist}}
- **Watched**: {{watched}} ({{plays}} plays, last: {{last_watched_at}})
- **Favorite**: {{favorite}}
- **My Rating**: {{my_rating}}/10

{{watch_history}}

## Links
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## My Notes

`;

export const DEFAULT_MOVIE_TEMPLATE_ZH_CN = `![poster]({{poster_url}})

> {{tagline}}

## 剧情简介
{{overview}}

## 详情
- **片长**：{{runtime}} 分钟
- **类型**：{{genres}}
- **评分**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **分级**：{{certification}}
- **上映**：{{released}}

## Trakt 状态
- **想看**：{{watchlist}}
- **看过**：{{watched}}（共 {{plays}} 次，最近：{{last_watched_at}}）
- **收藏**：{{favorite}}
- **我的评分**：{{my_rating}}/10

{{watch_history}}

## 链接
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 我的笔记

`;

export const DEFAULT_SHOW_TEMPLATE_ZH_CN = `![poster]({{poster_url}})

## 剧情简介
{{overview}}

## 详情
- **平台**：{{network}}
- **片长**：每集 {{runtime}} 分钟
- **集数**：{{aired_episodes}} 集已播出
- **类型**：{{genres}}
- **评分**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **分级**：{{certification}}
- **状态**：{{status}}
- **首播**：{{first_aired}}

## Trakt 状态
- **想看**：{{watchlist}}
- **看过**：{{watched}}（共 {{plays}} 次，最近：{{last_watched_at}}）
- **收藏**：{{favorite}}
- **我的评分**：{{my_rating}}/10

{{watch_history}}

## 链接
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 我的笔记

`;

export const DEFAULT_MOVIE_TEMPLATE_ZH_TW = `![poster]({{poster_url}})

> {{tagline}}

## 劇情簡介
{{overview}}

## 詳情
- **片長**：{{runtime}} 分鐘
- **類型**：{{genres}}
- **評分**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **分級**：{{certification}}
- **上映**：{{released}}

## Trakt 狀態
- **想看**：{{watchlist}}
- **看過**：{{watched}}（共 {{plays}} 次，最近：{{last_watched_at}}）
- **收藏**：{{favorite}}
- **我的評分**：{{my_rating}}/10

{{watch_history}}

## 連結
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 我的筆記

`;

export const DEFAULT_SHOW_TEMPLATE_ZH_TW = `![poster]({{poster_url}})

## 劇情簡介
{{overview}}

## 詳情
- **平台**：{{network}}
- **片長**：每集 {{runtime}} 分鐘
- **集數**：{{aired_episodes}} 集已播出
- **類型**：{{genres}}
- **評分**：{{trakt_rating}}/10（{{trakt_votes}} 票）
- **分級**：{{certification}}
- **狀態**：{{status}}
- **首播**：{{first_aired}}

## Trakt 狀態
- **想看**：{{watchlist}}
- **看過**：{{watched}}（共 {{plays}} 次，最近：{{last_watched_at}}）
- **收藏**：{{favorite}}
- **我的評分**：{{my_rating}}/10

{{watch_history}}

## 連結
- [Trakt]({{trakt_url}})
- [IMDB]({{imdb_url}})

## 我的筆記

`;

/**
 * Pick the bundled default movie template for a language code. Languages
 * without a bundled translation fall back to English — the user can still
 * customize the template by hand or pick a different `templateLanguage`.
 */
export function getDefaultMovieTemplate(lang: string): string {
  const code = (lang || "").trim();
  if (code === "zh-CN") return DEFAULT_MOVIE_TEMPLATE_ZH_CN;
  if (code === "zh-TW" || code === "zh-HK") return DEFAULT_MOVIE_TEMPLATE_ZH_TW;
  return DEFAULT_MOVIE_TEMPLATE_EN;
}

export function getDefaultShowTemplate(lang: string): string {
  const code = (lang || "").trim();
  if (code === "zh-CN") return DEFAULT_SHOW_TEMPLATE_ZH_CN;
  if (code === "zh-TW" || code === "zh-HK") return DEFAULT_SHOW_TEMPLATE_ZH_TW;
  return DEFAULT_SHOW_TEMPLATE_EN;
}

/** Backward-compat aliases — anything that imported the old constant names
 * still sees the English defaults. */
export const DEFAULT_MOVIE_TEMPLATE = DEFAULT_MOVIE_TEMPLATE_EN;
export const DEFAULT_SHOW_TEMPLATE = DEFAULT_SHOW_TEMPLATE_EN;

/** All known default templates across (lang × type). Used to detect whether a
 * user's saved template still equals one of the defaults — if so, switching
 * templateLanguage rewrites it; if not (= user-customized), we leave it
 * alone. */
const ALL_DEFAULT_TEMPLATES: ReadonlyArray<string> = [
  DEFAULT_MOVIE_TEMPLATE_EN,
  DEFAULT_MOVIE_TEMPLATE_ZH_CN,
  DEFAULT_MOVIE_TEMPLATE_ZH_TW,
  DEFAULT_SHOW_TEMPLATE_EN,
  DEFAULT_SHOW_TEMPLATE_ZH_CN,
  DEFAULT_SHOW_TEMPLATE_ZH_TW,
];

function isDefaultTemplate(value: string): boolean {
  return ALL_DEFAULT_TEMPLATES.includes(value);
}

export const DEFAULT_SETTINGS: TraktrSettings = {
  clientId: "",
  clientSecret: "",
  accessToken: "",
  refreshToken: "",
  tokenExpiresAt: 0,

  tmdbApiKey: "",
  posterSize: "w500",

  metadataLanguage: "",
  customMetadataLanguage: "",
  uiLanguage: "en",
  templateLanguage: "",
  customTemplateLanguage: "",

  propertyPrefix: "trakt_",

  folder: "trakt",
  filenameTemplate: "{{title}} ({{year}})",

  movieNoteTemplate: DEFAULT_MOVIE_TEMPLATE_EN,
  showNoteTemplate: DEFAULT_SHOW_TEMPLATE_EN,

  addTags: true,
  tagPrefix: "trakt",

  addTagNotes: false,
  createTagNotes: false,
  tagNotesFolder: "trakt",

  syncWatchlist: true,
  syncFavorites: true,
  syncWatched: false,
  syncWatchedDetail: false,
  syncRatings: false,

  syncMovies: true,
  syncShows: true,
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: 60,
  syncOnStartup: false,
  overwriteExisting: false,
  deleteRemovedItems: false,

  // [0.2.0] TMDB cache + history state defaults
  tmdbCache: {},
  tmdbCacheTtlDays: 90,
  historyState: { ...EMPTY_HISTORY_STATE },
  historyFullRefreshIntervalDays: 7,
};

export class TraktrSettingTab extends PluginSettingTab {
  plugin: TraktrPlugin;

  constructor(app: App, plugin: TraktrPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * [0.5.0] Attach the per-setting cloud icon to a Setting row. The icon
   * shows whether this key is currently synced (cloud) or device-local
   * (cloud-off). Clicking toggles the state and re-renders the tab so
   * any dependent UI updates accordingly. See spec 0003.
   */
  private addLocalToggle(setting: Setting, key: LocalEligibleKey): Setting {
    const t = getTranslator(this.plugin.settings.uiLanguage);
    return setting.addExtraButton((btn) => {
      const isLocal = this.plugin.localKeys.has(key);
      btn
        .setIcon(isLocal ? "cloud-off" : "cloud")
        .setTooltip(
          isLocal
            ? t("settings.cloud.local.tooltip")
            : t("settings.cloud.synced.tooltip"),
        )
        .onClick(async () => {
          await this.plugin.setKeyIsLocal(key, !isLocal);
          this.display();
        });
    });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const t = getTranslator(this.plugin.settings.uiLanguage);

    // ── Authentication ──
    new Setting(containerEl).setName(t("auth.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("auth.clientId.name"))
      .setDesc(t("auth.clientId.desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("auth.clientId.name"))
          .setValue(this.plugin.settings.clientId)
          .onChange(async (value) => {
            this.plugin.settings.clientId = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("auth.clientSecret.name"))
      .setDesc(t("auth.clientSecret.desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("auth.clientSecret.name"))
          .setValue(this.plugin.settings.clientSecret)
          .onChange(async (value) => {
            this.plugin.settings.clientSecret = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    const connectionSetting = new Setting(containerEl).setName(
      t("auth.connection.name"),
    );

    if (this.plugin.settings.accessToken) {
      connectionSetting.setDesc(t("auth.connection.connected"));
      connectionSetting.addButton((btn) =>
        btn
          .setButtonText(t("auth.connection.disconnect"))
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.accessToken = "";
            this.plugin.settings.refreshToken = "";
            this.plugin.settings.tokenExpiresAt = 0;
            await this.plugin.saveSettings();
            new Notice(t("auth.connection.disconnectedNotice"));
            this.display();
          }),
      );
    } else {
      connectionSetting.setDesc(t("auth.connection.notConnected"));
      connectionSetting.addButton((btn) =>
        btn
          .setButtonText(t("auth.connection.connect"))
          .setCta()
          .onClick(async () => {
            if (
              !this.plugin.settings.clientId ||
              !this.plugin.settings.clientSecret
            ) {
              new Notice(t("auth.connection.needCredentialsNotice"));
              return;
            }
            this.plugin.startAuth();
            this.display();
          }),
      );
    }

    // Cross-device sync info — purely informational. The plugin doesn't
    // implement any sync itself; it relies on whatever vault-sync layer the
    // user already has (Obsidian Sync, Syncthing, iCloud, etc.). Surfacing
    // this here saves users the question "do I need to log in on every
    // device separately?".
    new Setting(containerEl)
      .setName(t("auth.sync.name"))
      .setDesc(t("auth.sync.desc"));

    // ── TMDB (poster images) ──
    new Setting(containerEl).setName(t("tmdb.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("tmdb.apiKey.name"))
      .setDesc(t("tmdb.apiKey.desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("tmdb.apiKey.placeholder"))
          .setValue(this.plugin.settings.tmdbApiKey)
          .onChange(async (value) => {
            this.plugin.settings.tmdbApiKey = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    // [0.3.2] Test button — verify the key works before relying on it
    // in a real sync. Result line lives directly under the button and is
    // re-rendered on each click. Empty input short-circuits without a
    // network call (verifyTmdbApiKey handles that case explicitly).
    const testSetting = new Setting(containerEl)
      .setName(t("tmdb.apiKey.test.name"))
      .setDesc(t("tmdb.apiKey.test.desc"));
    const testResultEl = testSetting.descEl.createDiv({
      cls: "trakt-test-result",
    });
    testSetting.addButton((btn) =>
      btn.setButtonText(t("tmdb.apiKey.test.button")).onClick(async () => {
        btn.setButtonText(t("tmdb.apiKey.test.testing")).setDisabled(true);
        testResultEl.empty();
        // Reset color modifier classes from any previous click
        testResultEl.classList.remove("is-ok", "is-error", "is-muted");
        try {
          const result = await verifyTmdbApiKey(this.plugin.settings.tmdbApiKey);
          if (result.ok) {
            testResultEl.classList.add("is-ok");
            testResultEl.setText(t("tmdb.apiKey.test.ok"));
          } else {
            testResultEl.classList.add(
              result.reason === "empty" ? "is-muted" : "is-error",
            );
            const key =
              result.reason === "empty"
                ? "tmdb.apiKey.test.empty"
                : result.reason === "unauthorized"
                  ? "tmdb.apiKey.test.unauthorized"
                  : "tmdb.apiKey.test.network";
            const base = t(key);
            testResultEl.setText(
              result.detail ? `${base} (${result.detail})` : base,
            );
          }
        } finally {
          btn.setButtonText(t("tmdb.apiKey.test.button")).setDisabled(false);
        }
      }),
    );

    new Setting(containerEl)
      .setName(t("tmdb.posterSize.name"))
      .setDesc(t("tmdb.posterSize.desc"))
      .addDropdown((dd) => {
        for (const size of POSTER_SIZES) {
          dd.addOption(size, size);
        }
        dd.setValue(this.plugin.settings.posterSize);
        dd.onChange(async (value) => {
          this.plugin.settings.posterSize = value as PosterSize;
          await this.plugin.saveSettings();
        });
      });

    // [0.2.0] TMDB cache controls — TTL dropdown + manual clear button.
    // Implemented to address the "every sync re-fetches all 1000+ items"
    // bottleneck reported by users. See spec 0001 §A for design.
    const cacheStats = tmdbCacheStats(this.plugin.settings.tmdbCache);
    const cacheStatsLabel = t("tmdb.cache.entries", {
      count: cacheStats.entries,
    });

    new Setting(containerEl)
      .setName(t("tmdb.cache.ttl.name"))
      .setDesc(t("tmdb.cache.ttl.desc"))
      .addDropdown((dd) => {
        dd.addOption("0", t("tmdb.cache.ttl.never"));
        dd.addOption("7", t("tmdb.cache.ttl.7"));
        dd.addOption("30", t("tmdb.cache.ttl.30"));
        dd.addOption("90", t("tmdb.cache.ttl.90"));
        dd.addOption("365", t("tmdb.cache.ttl.365"));
        dd.setValue(String(this.plugin.settings.tmdbCacheTtlDays));
        dd.onChange(async (value) => {
          this.plugin.settings.tmdbCacheTtlDays = parseInt(value, 10) || 0;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t("tmdb.cache.clear.name"))
      .setDesc(`${cacheStatsLabel}\n\n${t("tmdb.cache.clear.desc")}`)
      .addButton((btn) =>
        btn
          .setButtonText(t("tmdb.cache.clear.button"))
          .setWarning()
          .onClick(async () => {
            clearTmdbCache(this.plugin.settings.tmdbCache);
            await this.plugin.saveSettings();
            new Notice(t("tmdb.cache.clear.notice"));
            this.display();
          }),
      );

    // ── Localization ──
    new Setting(containerEl).setName(t("loc.heading")).setHeading();

    const dropdownValue = isCustomLanguageMode(this.plugin.settings)
      ? "custom"
      : PRESET_LANGUAGE_VALUES.has(this.plugin.settings.metadataLanguage)
        ? this.plugin.settings.metadataLanguage
        : this.plugin.settings.metadataLanguage === ""
          ? ""
          : "custom";

    new Setting(containerEl)
      .setName(t("loc.metadataLanguage.name"))
      .setDesc(t("loc.metadataLanguage.desc"))
      .addDropdown((dd) => {
        for (const [value, label] of METADATA_LANGUAGE_PRESETS) {
          // The "" preset's label is localized via t(); other preset labels
          // stay in English (they ARE language names in their own language by
          // convention — "Chinese (Simplified)" reads fine on a Chinese UI).
          const localizedLabel =
            value === "" ? t("loc.metadataLanguage.default") : label;
          dd.addOption(value, localizedLabel);
        }
        dd.addOption("custom", t("loc.metadataLanguage.custom"));
        dd.setValue(dropdownValue);
        dd.onChange(async (value) => {
          if (value === "custom") {
            const previous = this.plugin.settings.metadataLanguage;
            if (
              previous &&
              previous !== "custom" &&
              !PRESET_LANGUAGE_VALUES.has(previous)
            ) {
              this.plugin.settings.customMetadataLanguage = previous;
            }
            this.plugin.settings.metadataLanguage = "custom";
          } else {
            this.plugin.settings.metadataLanguage = value;
          }
          await this.plugin.saveSettings();
          this.display();
        });
      });

    // [0.3.2] Inline warning when metadataLanguage is set but TMDB key is
    // missing. Surfaces what the user is actually getting from the Trakt
    // fallback (partial translation) vs what TMDB would unlock (full
    // translation + posters). Non-blocking — just informational.
    const langActive =
      this.plugin.settings.metadataLanguage !== "" &&
      this.plugin.settings.metadataLanguage !== undefined;
    const tmdbMissing = !this.plugin.settings.tmdbApiKey.trim();
    if (langActive && tmdbMissing) {
      const warningEl = containerEl.createDiv({ cls: "trakt-tmdb-warning" });
      warningEl.setText(t("loc.noTmdbWarning"));
    }

    if (dropdownValue === "custom") {
      new Setting(containerEl)
        .setName(t("loc.customLanguage.name"))
        .setDesc(t("loc.customLanguage.desc"))
        .addText((text) =>
          text
            .setPlaceholder(t("loc.customLanguage.placeholder"))
            .setValue(this.plugin.settings.customMetadataLanguage)
            .onChange(async (value) => {
              this.plugin.settings.customMetadataLanguage = value.trim();
              await this.plugin.saveSettings();
            }),
        );
    }

    // Plugin UI language
    this.addLocalToggle(
      new Setting(containerEl)
        .setName(t("loc.uiLanguage.name"))
        .setDesc(t("loc.uiLanguage.desc"))
        .addDropdown((dd) => {
          dd.addOption("en", "English");
          dd.addOption("zh-CN", "简体中文");
          dd.setValue(this.plugin.settings.uiLanguage);
          dd.onChange(async (value) => {
            this.plugin.settings.uiLanguage = value as UiLanguage;
            await this.plugin.saveSettings();
            this.display();
          });
        }),
      "uiLanguage",
    );

    // Note template language — same dropdown shape as Metadata language
    // (preset codes + Custom). Auto-rewrites unmodified default templates
    // when the language changes; customized templates are preserved.
    const tplDropdownValue = isCustomTemplateLanguageMode(this.plugin.settings)
      ? "custom"
      : PRESET_LANGUAGE_VALUES.has(this.plugin.settings.templateLanguage)
        ? this.plugin.settings.templateLanguage
        : this.plugin.settings.templateLanguage === ""
          ? ""
          : "custom";

    const applyTemplateLanguageChange = async (newLang: string) => {
      // Only rewrite a saved template when it still matches one of the
      // bundled defaults — i.e. the user hasn't customized it. We resolve
      // through getDefault*Template() so a code without a bundled translation
      // (e.g. ja-JP, ko-KR, fr-FR, custom code) falls back to English.
      const movieDefault = getDefaultMovieTemplate(
        newLang === "custom"
          ? this.plugin.settings.customTemplateLanguage
          : newLang,
      );
      const showDefault = getDefaultShowTemplate(
        newLang === "custom"
          ? this.plugin.settings.customTemplateLanguage
          : newLang,
      );
      if (isDefaultTemplate(this.plugin.settings.movieNoteTemplate)) {
        this.plugin.settings.movieNoteTemplate = movieDefault;
      }
      if (isDefaultTemplate(this.plugin.settings.showNoteTemplate)) {
        this.plugin.settings.showNoteTemplate = showDefault;
      }
    };

    new Setting(containerEl)
      .setName(t("loc.templateLanguage.name"))
      .setDesc(t("loc.templateLanguage.desc"))
      .addDropdown((dd) => {
        for (const [value, label] of METADATA_LANGUAGE_PRESETS) {
          const localizedLabel =
            value === "" ? t("loc.metadataLanguage.default") : label;
          dd.addOption(value, localizedLabel);
        }
        dd.addOption("custom", t("loc.metadataLanguage.custom"));
        dd.setValue(tplDropdownValue);
        dd.onChange(async (value) => {
          if (value === "custom") {
            const previous = this.plugin.settings.templateLanguage;
            if (
              previous &&
              previous !== "custom" &&
              !PRESET_LANGUAGE_VALUES.has(previous)
            ) {
              this.plugin.settings.customTemplateLanguage = previous;
            }
            this.plugin.settings.templateLanguage = "custom";
          } else {
            this.plugin.settings.templateLanguage = value;
          }
          await applyTemplateLanguageChange(
            this.plugin.settings.templateLanguage,
          );
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if (tplDropdownValue === "custom") {
      new Setting(containerEl)
        .setName(t("loc.customLanguage.name"))
        .setDesc(t("loc.customLanguage.desc"))
        .addText((text) =>
          text
            .setPlaceholder(t("loc.customLanguage.placeholder"))
            .setValue(this.plugin.settings.customTemplateLanguage)
            .onChange(async (value) => {
              this.plugin.settings.customTemplateLanguage = value.trim();
              // Re-resolve templates against the typed code on the fly, so
              // that picking e.g. "zh-TW" via custom field does the same
              // thing as picking it from the preset list.
              await applyTemplateLanguageChange("custom");
              await this.plugin.saveSettings();
            }),
        );
    }

    // ── Notes ──
    new Setting(containerEl).setName(t("notes.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("notes.folder.name"))
      .setDesc(t("notes.folder.desc"))
      .addText((text) =>
        text
          .setPlaceholder("Trakt")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("notes.filename.name"))
      .setDesc(t("notes.filename.desc"))
      .addText((text) =>
        text
          .setPlaceholder("{{title}} ({{year}})")
          .setValue(this.plugin.settings.filenameTemplate)
          .onChange(async (value) => {
            this.plugin.settings.filenameTemplate = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("notes.prefix.name"))
      .setDesc(t("notes.prefix.desc"))
      .addText((text) =>
        text
          .setPlaceholder("Trakt_")
          .setValue(this.plugin.settings.propertyPrefix)
          .onChange(async (value) => {
            this.plugin.settings.propertyPrefix = value;
            await this.plugin.saveSettings();
          }),
      );

    // ── Note templates ──
    new Setting(containerEl).setName(t("templates.heading")).setHeading();

    const movieTemplateSetting = new Setting(containerEl)
      .setName(t("templates.movie.name"))
      .setDesc(t("templates.movie.desc"));
    movieTemplateSetting.addTextArea((ta) => {
      ta.inputEl.rows = 12;
      ta.inputEl.cols = 60;
      ta.setValue(this.plugin.settings.movieNoteTemplate).onChange(
        async (value) => {
          this.plugin.settings.movieNoteTemplate = value;
          await this.plugin.saveSettings();
        },
      );
    });
    movieTemplateSetting.addButton((btn) =>
      btn.setButtonText(t("templates.reset")).onClick(async () => {
        this.plugin.settings.movieNoteTemplate = getDefaultMovieTemplate(
          this.plugin.settings.templateLanguage,
        );
        await this.plugin.saveSettings();
        this.display();
      }),
    );

    const showTemplateSetting = new Setting(containerEl)
      .setName(t("templates.show.name"))
      .setDesc(t("templates.show.desc"));
    showTemplateSetting.addTextArea((ta) => {
      ta.inputEl.rows = 12;
      ta.inputEl.cols = 60;
      ta.setValue(this.plugin.settings.showNoteTemplate).onChange(
        async (value) => {
          this.plugin.settings.showNoteTemplate = value;
          await this.plugin.saveSettings();
        },
      );
    });
    showTemplateSetting.addButton((btn) =>
      btn.setButtonText(t("templates.reset")).onClick(async () => {
        this.plugin.settings.showNoteTemplate = getDefaultShowTemplate(
          this.plugin.settings.templateLanguage,
        );
        await this.plugin.saveSettings();
        this.display();
      }),
    );

    // ── Tags ──
    new Setting(containerEl).setName(t("tags.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("tags.add.name"))
      .setDesc(t("tags.add.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.addTags)
          .onChange(async (value) => {
            this.plugin.settings.addTags = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("tags.prefix.name"))
      .setDesc(t("tags.prefix.desc"))
      .addText((text) =>
        text
          .setPlaceholder("Trakt")
          .setValue(this.plugin.settings.tagPrefix)
          .onChange(async (value) => {
            this.plugin.settings.tagPrefix = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    // ── Tag notes ──
    new Setting(containerEl)
      .setName(t("tagNotes.heading"))
      .setDesc(t("tagNotes.heading.desc"))
      .setHeading();

    new Setting(containerEl)
      .setName(t("tagNotes.add.name"))
      .setDesc(t("tagNotes.add.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.addTagNotes)
          .onChange(async (value) => {
            this.plugin.settings.addTagNotes = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("tagNotes.create.name"))
      .setDesc(t("tagNotes.create.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.createTagNotes)
          .onChange(async (value) => {
            this.plugin.settings.createTagNotes = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("tagNotes.folder.name"))
      .setDesc(t("tagNotes.folder.desc"))
      .addText((text) =>
        text
          .setPlaceholder("Trakt")
          .setValue(this.plugin.settings.tagNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.tagNotesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    // ── Sync sources ──
    new Setting(containerEl).setName(t("syncSources.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("syncSources.watchlist.name"))
      .setDesc(t("syncSources.watchlist.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncWatchlist)
          .onChange(async (value) => {
            this.plugin.settings.syncWatchlist = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("syncSources.favorites.name"))
      .setDesc(t("syncSources.favorites.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncFavorites)
          .onChange(async (value) => {
            this.plugin.settings.syncFavorites = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("syncSources.watched.name"))
      .setDesc(t("syncSources.watched.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncWatched)
          .onChange(async (value) => {
            this.plugin.settings.syncWatched = value;
            // syncWatchedDetail is meaningless without syncWatched, so clear
            // it when the parent flips off — keeps settings consistent and
            // avoids surprise behavior next time syncWatched is re-enabled.
            if (!value) this.plugin.settings.syncWatchedDetail = false;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    if (this.plugin.settings.syncWatched) {
      new Setting(containerEl)
        .setName(t("syncSources.watchedDetail.name"))
        .setDesc(t("syncSources.watchedDetail.desc"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.syncWatchedDetail)
            .onChange(async (value) => {
              this.plugin.settings.syncWatchedDetail = value;
              await this.plugin.saveSettings();
              this.display();
            }),
        );

      // [0.2.0] Detailed-history controls — only meaningful when detail
      // sync is on. Lets the user tune how often the plugin re-pulls the
      // full history (to detect deletions on Trakt's side that an
      // incremental fetch can't see), and shows current state stats +
      // a manual clear button.
      if (this.plugin.settings.syncWatchedDetail) {
        const historyStats = historyStateStats(
          this.plugin.settings.historyState,
        );
        const historyStatsLabel = t("history.state.stats", {
          movies: historyStats.movies,
          shows: historyStats.shows,
          events: historyStats.events,
        });

        new Setting(containerEl)
          .setName(t("history.fullRefreshInterval.name"))
          .setDesc(t("history.fullRefreshInterval.desc"))
          .addSlider((slider) =>
            slider
              .setLimits(1, 30, 1)
              .setValue(this.plugin.settings.historyFullRefreshIntervalDays)
              .setDynamicTooltip()
              .onChange(async (value) => {
                this.plugin.settings.historyFullRefreshIntervalDays = value;
                await this.plugin.saveSettings();
              }),
          );

        new Setting(containerEl)
          .setName(t("history.state.clear.name"))
          .setDesc(`${historyStatsLabel}\n\n${t("history.state.clear.desc")}`)
          .addButton((btn) =>
            btn
              .setButtonText(t("history.state.clear.button"))
              .setWarning()
              .onClick(async () => {
                clearHistoryState(this.plugin.settings.historyState);
                await this.plugin.saveSettings();
                new Notice(t("history.state.clear.notice"));
                this.display();
              }),
          );
      }
    }

    new Setting(containerEl)
      .setName(t("syncSources.ratings.name"))
      .setDesc(t("syncSources.ratings.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncRatings)
          .onChange(async (value) => {
            this.plugin.settings.syncRatings = value;
            await this.plugin.saveSettings();
          }),
      );

    // ── Sync behavior ──
    new Setting(containerEl).setName(t("syncBehavior.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("syncBehavior.movies.name"))
      .setDesc(t("syncBehavior.movies.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncMovies)
          .onChange(async (value) => {
            this.plugin.settings.syncMovies = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("syncBehavior.shows.name"))
      .setDesc(t("syncBehavior.shows.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncShows)
          .onChange(async (value) => {
            this.plugin.settings.syncShows = value;
            await this.plugin.saveSettings();
          }),
      );

    this.addLocalToggle(
      new Setting(containerEl)
        .setName(t("syncBehavior.startup.name"))
        .setDesc(t("syncBehavior.startup.desc"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.syncOnStartup)
            .onChange(async (value) => {
              this.plugin.settings.syncOnStartup = value;
              await this.plugin.saveSettings();
            }),
        ),
      "syncOnStartup",
    );

    this.addLocalToggle(
      new Setting(containerEl)
        .setName(t("syncBehavior.autoSync.name"))
        .setDesc(t("syncBehavior.autoSync.desc"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.autoSyncEnabled)
            .onChange(async (value) => {
              this.plugin.settings.autoSyncEnabled = value;
              await this.plugin.saveSettings();
              this.plugin.configureAutoSync();
              this.display();
            }),
        ),
      "autoSyncEnabled",
    );

    if (this.plugin.settings.autoSyncEnabled) {
      this.addLocalToggle(
        new Setting(containerEl)
          .setName(t("syncBehavior.interval.name"))
          .setDesc(t("syncBehavior.interval.desc"))
          .addSlider((slider) =>
            slider
              .setLimits(5, 360, 5)
              .setValue(this.plugin.settings.autoSyncIntervalMinutes)
              .setDynamicTooltip()
              .onChange(async (value) => {
                this.plugin.settings.autoSyncIntervalMinutes = value;
                await this.plugin.saveSettings();
                this.plugin.configureAutoSync();
              }),
          ),
        "autoSyncIntervalMinutes",
      );
    }

    new Setting(containerEl)
      .setName(t("syncBehavior.overwrite.name"))
      .setDesc(t("syncBehavior.overwrite.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.overwriteExisting)
          .onChange(async (value) => {
            this.plugin.settings.overwriteExisting = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("syncBehavior.delete.name"))
      .setDesc(t("syncBehavior.delete.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.deleteRemovedItems)
          .onChange(async (value) => {
            this.plugin.settings.deleteRemovedItems = value;
            await this.plugin.saveSettings();
          }),
      );

    // ── Reset ──
    new Setting(containerEl).setName(t("reset.heading")).setHeading();

    new Setting(containerEl)
      .setName(t("reset.button.name"))
      .setDesc(t("reset.button.desc"))
      .addButton((btn) =>
        btn
          .setButtonText(t("reset.button.name"))
          .setWarning()
          .onClick(async () => {
            const {
              accessToken,
              refreshToken,
              clientId,
              clientSecret,
              tokenExpiresAt,
              tmdbApiKey,
              uiLanguage,
            } = this.plugin.settings;
            // Preserve auth + UI language across reset; everything else
            // goes back to its default.
            Object.assign(this.plugin.settings, DEFAULT_SETTINGS, {
              accessToken,
              refreshToken,
              clientId,
              clientSecret,
              tokenExpiresAt,
              tmdbApiKey,
              uiLanguage,
            });
            await this.plugin.saveSettings();
            this.plugin.configureAutoSync();
            new Notice(t("reset.notice"));
            this.display();
          }),
      );
  }
}
