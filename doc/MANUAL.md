# Obsidian Sync Trakt — User Manual

## 1. What it does

This plugin pulls your [Trakt.tv](https://trakt.tv) data and creates one
Markdown note per movie or TV show in your vault. Each note contains:

- **Frontmatter** — structured metadata (title, year, genres, ratings, watch status, Trakt/IMDB/TMDB IDs, poster URL, sync timestamp)
- **Body** — rendered from a customizable template with `{{variable}}` placeholders
- **Tags** — automatically generated from the type, genres, and sync sources (optional)
- **Tag notes** — wikilinks to topic files for building a graph (optional)
- **Watch History** — opt-in section showing per-episode (or per-movie) watch timestamps from Trakt's `/sync/history` endpoint

Movies and shows live in the same folder and are distinguished by the `trakt_type` frontmatter field (`movie` or `show`). Dataview queries can filter by either.

This plugin is forked from [sarimabbas/traktr](https://github.com/sarimabbas/traktr); see the README for attribution and what's added.

---

## 2. Installation

Manual install:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)
2. In your vault, create the folder `.obsidian/plugins/obsidian-sync-trakt/`
3. Copy the three files into that folder
4. Open Obsidian → Settings → Community plugins → enable **Obsidian Sync Trakt**

Or via [BRAT](https://github.com/TfTHacker/obsidian42-brat): add the beta plugin
`o1xhack/obsidian-sync-trakt`.

---

## 3. Initial setup

### 3a. Create a Trakt application

1. Sign in to [trakt.tv](https://trakt.tv) and go to **Settings → Your API Apps → New Application**
2. Give it any name (e.g. "Traktr")
3. For **Redirect URI**, enter `urn:ietf:wg:oauth:2.0:oob`
4. Save. Copy the **Client ID** and **Client Secret**

### 3b. (Optional) Get a TMDB API key

Poster images are fetched from [The Movie Database](https://themoviedb.org). A free API key is sufficient. If you skip this, notes are created without poster images.

1. Create an account at themoviedb.org
2. Go to **Settings → API → Create → Developer**
3. Copy the **API Key (v3 auth)**

---

## 4. Authentication flow

1. Open **Settings → Traktr**
2. Paste your **Trakt Client ID** and **Client Secret**
3. Click **Connect to Trakt** — a modal opens showing a URL and a short device code
4. Visit the URL in a browser, enter the code, and approve access
5. The modal polls Trakt and closes automatically once authorized
6. The Connection status field shows "Connected to Trakt"

To revoke access, click **Disconnect** in the settings tab or run the command **Traktr: Disconnect account**.

Access tokens are refreshed automatically before each sync (no manual re-authentication needed).

---

## 5. Settings reference

### Authentication

| Setting | Description |
|---|---|
| Trakt Client ID | From your Trakt API application. |
| Trakt Client Secret | From the same application page. |
| Connection status | Shows current state; buttons to connect or disconnect. |

### TMDB (poster images)

| Setting | Default | Description |
|---|---|---|
| TMDB API key | _(blank)_ | Optional. Leave blank to skip poster images. |
| Poster size | `w500` | Image width variant fetched from TMDB. Options: w92, w154, w185, w342, w500, w780, original. |

### Localization

Optional. Translate `title`, `overview`, `tagline`, and `genres` in synced notes. Tags and tag-note wikilinks always stay in English so existing Dataview queries keep working.

| Setting | Default | Description |
|---|---|---|
| Metadata language | `Default (English / Trakt original)` | Locale for translated metadata. Selecting `Default` disables localization; existing notes stay byte-identical to the pre-i18n behavior. Presets cover Simplified/Traditional Chinese, Japanese, Korean, English variants, French, German, Spanish (ES/MX), Brazilian Portuguese, Italian, and Russian; pick `Custom` to enter any BCP 47 code (e.g. `tr-TR`). |
| Custom language code | `(blank)` | Only shown when `Custom` is selected above. |

When localization is enabled, sync resolves translations in this order:

1. **TMDB** (preferred) — one combined call per item that returns the localized `title` / `overview` / `tagline` / `genres` plus the poster URL. Requires a TMDB API key.
2. **Trakt `/translations/{lang}`** (fallback) — used when no TMDB API key is configured. Covers `title` / `overview` / `tagline` only; `genres` stay in English.
3. **English original** — used field-by-field when neither API has a translation in the requested language.

### Notes

| Setting | Default | Description |
|---|---|---|
| Notes folder | `trakt` | Vault folder where all notes are created. Created automatically if missing. |
| Filename template | `{{title}} ({{year}})` | Template for note filenames. Variables: `{{title}}`, `{{year}}`, `{{imdb_id}}`, `{{trakt_id}}`. |
| Property prefix | `trakt_` | Prefix for all frontmatter properties written by the plugin (e.g. `trakt_title`, `trakt_watched`). Leave blank for no prefix. |

### Note templates

| Setting | Default | Description |
|---|---|---|
| Movie note template | _(see below)_ | Markdown template for the body of movie notes. Uses `{{variable}}` syntax. |
| TV show note template | _(see below)_ | Markdown template for the body of TV show notes. Uses `{{variable}}` syntax. |

Both templates have a **Reset to default** button.

### Tags

| Setting | Default | Description |
|---|---|---|
| Add tags | on | Add Obsidian tags to frontmatter on each sync (e.g. `#trakt/genre/action`). |
| Tag prefix | `trakt` | Prefix for generated tags (e.g. `trakt` → `#trakt/movie`, `#trakt/genre/action`). |

### Tag notes

Tag notes are topic files you link to from your notes, creating a graph of connections. Use either tags or tag notes — using both is redundant.

| Setting | Default | Description |
|---|---|---|
| Add tag notes to frontmatter | off | Adds a wikilink list property to frontmatter on each sync (e.g. `[[trakt/genre/action]]`). Alternatively, use `{{tag_notes}}` in your template to place links in the note body instead. |
| Create tag notes | off | Automatically create empty tag note files if they don't exist. |
| Tag notes folder | `trakt` | Vault folder for tag note files. Used for frontmatter links, file creation, and the `{{tag_notes}}` template variable. |

### Sync sources

| Setting | Default | Description |
|---|---|---|
| Sync watchlist | on | Items on your Trakt watchlist (things you want to watch). |
| Sync favorites | on | Items you've marked as favorites. |
| Sync watch history | off | Items you've watched. Adds play count and last-watched date per item. Can be a large dataset. |
| Sync watch history (detailed) | off | Layered on top of the toggle above. Pulls Trakt's `/sync/history` endpoint and surfaces per-episode (or per-movie) watch timestamps via the `{{watch_history}}` template variable. **Significantly slower** for active users — each individual watch event is one API entry, paginated at 100/page. Off by default; only shown when "Sync watch history" is on. |
| Sync ratings | off | Items you've rated (1–10). |

### Sync behavior

| Setting | Default | Description |
|---|---|---|
| Sync movies | on | Include movies in the sync. |
| Sync TV shows | on | Include TV shows in the sync. |
| Sync on startup | off | Automatically run a sync when Obsidian loads (5-second delay). |
| Auto-sync | off | Periodically sync in the background. |
| Auto-sync interval | 60 min | How often to auto-sync (5–360 minutes). Visible only when auto-sync is enabled. |
| Overwrite existing note body | off | When **off**, only frontmatter is updated and the note body is preserved. When **on**, the full note is regenerated from the template on every sync — any edits you've made to the note body will be permanently lost. |
| Remove notes for deleted items | off | When **on**, notes for items no longer in any enabled sync source are moved to trash. |

### Reset

**Reset to defaults** restores all settings to their defaults. Authentication credentials and TMDB API key are preserved.

---

## 6. Note format

### Frontmatter fields

All fields below are prefixed with the configured **Property prefix** (default `trakt_`).

| Field | Type | Description |
|---|---|---|
| `trakt_title` | string | Title of the movie or show. |
| `trakt_year` | number | Release year. |
| `trakt_type` | `movie` \| `show` | Content type. |
| `trakt_id` | number | Trakt numeric ID. |
| `trakt_slug` | string | Trakt URL slug. |
| `trakt_imdb_id` | string | IMDB ID (e.g. `tt1234567`). |
| `trakt_tmdb_id` | number | TMDB numeric ID. |
| `trakt_tvdb_id` | number | TVDB ID (shows only). |
| `trakt_genres` | list | Genre list. |
| `trakt_runtime` | number | Runtime in minutes (per episode for shows). |
| `trakt_certification` | string | Age certification (e.g. `PG-13`). |
| `trakt_rating` | number | Trakt community rating (0–10). |
| `trakt_votes` | number | Number of Trakt votes. |
| `trakt_country` | string | Country of origin code. |
| `trakt_language` | string | Primary language code. |
| `trakt_status` | string | Status (e.g. `released`, `ended`, `returning series`). |
| `trakt_overview` | string | Plot summary. |
| `trakt_released` | string | Release date (movies only, YYYY-MM-DD). |
| `trakt_tagline` | string | Tagline (movies only). |
| `trakt_network` | string | Broadcasting network (shows only). |
| `trakt_aired_episodes` | number | Total aired episodes (shows only). |
| `trakt_first_aired` | string | First air date (shows only, YYYY-MM-DD). |
| `trakt_watchlist` | boolean | Present if synced from watchlist. |
| `trakt_watchlist_added_at` | string | ISO timestamp when added to watchlist. |
| `trakt_watched` | boolean | Present if synced from watch history. |
| `trakt_plays` | number | Number of times watched/played. |
| `trakt_last_watched_at` | string | ISO timestamp of last watch. |
| `trakt_episodes_watched` | number | Total episodes watched (shows only). |
| `trakt_favorite` | boolean | Present if synced from favorites. |
| `trakt_favorited_at` | string | ISO timestamp when favorited. |
| `trakt_my_rating` | number | Your personal rating (1–10). |
| `trakt_rated_at` | string | ISO timestamp when rated. |
| `trakt_url` | string | Trakt page URL. |
| `trakt_imdb_url` | string | IMDB page URL. |
| `trakt_poster_url` | string | TMDB poster image URL. |
| `trakt_synced_at` | string | ISO timestamp of last sync. |
| `trakt_tag_notes` | list | Wikilinks to tag note files (when "Add tag notes to frontmatter" is on). |
| `tags` | list | Auto-generated Obsidian tags (when "Add tags" is on). |
| `trakt_original_title` | string | English/source-language title. Only present when **Metadata language** is set. |
| `trakt_original_overview` | string | English/source-language plot summary. Only present when **Metadata language** is set. |
| `trakt_original_tagline` | string | English/source-language tagline (movies only). Only present when **Metadata language** is set. |
| `trakt_original_genres` | list | English/source-language genre list. Only present when **Metadata language** is set. |
| `trakt_metadata_language` | string | The active language code (e.g. `zh-CN`). Only present when **Metadata language** is set. |

### Auto-generated tags

With the default tag prefix `trakt`:

- `#trakt/movie` or `#trakt/show`
- `#trakt/genre/<genre>` for each genre
- `#trakt/watchlist` if on your watchlist
- `#trakt/watched` if you've watched it
- `#trakt/favorite` if favorited
- `#trakt/rated` if you've rated it

### Template variables

The note body template uses `{{variable}}` syntax. Available variables:

| Variable | Description |
|---|---|
| `{{title}}` | Title |
| `{{year}}` | Release year |
| `{{type}}` | `movie` or `show` |
| `{{overview}}` | Plot summary |
| `{{genres}}` | Comma-separated genre list |
| `{{runtime}}` | Runtime in minutes |
| `{{trakt_rating}}` | Community rating |
| `{{trakt_votes}}` | Vote count |
| `{{certification}}` | Age certification |
| `{{country}}` | Country code |
| `{{language}}` | Language code |
| `{{status}}` | Release/air status |
| `{{trakt_id}}` | Trakt numeric ID |
| `{{trakt_slug}}` | Trakt slug |
| `{{imdb_id}}` | IMDB ID |
| `{{tmdb_id}}` | TMDB ID |
| `{{tvdb_id}}` | TVDB ID |
| `{{trakt_url}}` | Trakt URL |
| `{{imdb_url}}` | IMDB URL |
| `{{poster_url}}` | Poster image URL (empty if no TMDB key; line is omitted from output) |
| `{{tag_notes}}` | Comma-separated wikilinks to tag notes (always available regardless of tag notes settings) |
| `{{tagline}}` | Tagline (movies) |
| `{{released}}` | Release date (movies) |
| `{{network}}` | Network (shows) |
| `{{aired_episodes}}` | Aired episode count (shows) |
| `{{first_aired}}` | First air date (shows) |
| `{{watchlist}}` | `true` if on watchlist |
| `{{watchlist_added_at}}` | Watchlist add timestamp |
| `{{watched}}` | `true` if watched |
| `{{plays}}` | Play count |
| `{{last_watched_at}}` | Last watched date |
| `{{episodes_watched}}` | Episodes watched (shows) |
| `{{favorite}}` | `true` if favorited |
| `{{favorited_at}}` | Favorited timestamp |
| `{{my_rating}}` | Your rating (1–10) |
| `{{rated_at}}` | Rated timestamp |
| `{{original_title}}` | English/source-language title. Always available, even when localization is off (then equal to `{{title}}`). |
| `{{original_overview}}` | English/source-language plot summary. Always available. |
| `{{original_tagline}}` | English/source-language tagline (movies). Always available. |
| `{{original_genres}}` | English/source-language genre list, comma-separated. Always available. |
| `{{metadata_language}}` | Active language code, or `""` when localization is off. |
| `{{watch_history}}` | Full **Watch History** section (`## heading` + bullet list) when **Sync watch history (detailed)** is on; empty string otherwise. Heading text follows your **Note template language** setting (English / 简体中文 / 繁體中文). |
| `{{watch_history_list}}` | Same content as `{{watch_history}}` but without the heading line. Use this if you want to render your own heading in your custom template. |

### Watch history rendering

When **Sync watch history (detailed)** is enabled, the body of each watched
note gets a `## Watch History` (or 观看记录 / 觀看紀錄) section listing every
watch event:

For shows — one bullet per episode, with all watch timestamps comma-separated
when an episode was rewatched:

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

For movies — one bullet per watch event:

```markdown
## Watch History
- 2023-12-25 19:00
- 2024-06-10 22:30
- 2025-02-14 20:15
```

Timestamps are formatted in your local timezone (Trakt stores them as UTC,
the renderer converts to local before display). Episodes are sorted by
season then episode number; timestamps within an episode are
chronologically sorted.

---

## 7. Sync behavior

### Create vs. update

- **New item** (no existing note with matching `trakt_type` + `trakt_id`): a note is created using the full template.
- **Existing item**: behavior depends on the **Overwrite existing note body** setting:
  - **Off** (default): only the frontmatter block is updated; everything below `---` is left untouched, so your personal notes are preserved.
  - **On**: the entire note (frontmatter + body) is regenerated from the template — body edits are lost.

### Delete

When **Remove notes for deleted items** is enabled, any note whose composite `type:id` is no longer found in any enabled sync source is moved to the system trash at the end of each sync.

### Changing language

When you switch **Metadata language** and run sync again:

- Frontmatter is rewritten in the new language; `trakt_original_*` fields keep the English values regardless.
- If your **filename template** contains `{{title}}`, every note will be renamed to the new-language title on the next sync. Obsidian's link-update will fix wikilinks automatically, but **back up your vault first**.
- To keep filenames stable across language switches, change the template to `{{original_title}} ({{year}})` *before* changing the language.
- Tags (`#trakt/genre/...`) and tag-note wikilinks (`[[trakt/genre/...]]`) always use the original English genre list, so existing Dataview queries keep working unchanged.
- Switching back to **Default (English / Trakt original)** rewrites frontmatter back to English; on the next sync the `trakt_original_*` and `trakt_metadata_language` fields are no longer written, so they'll persist on existing notes until you remove them or regenerate notes (enable **Overwrite existing note body** for one sync to fully regenerate).

### Running a sync

- **Manual**: command **Traktr: Sync** (accessible via the command palette)
- **On startup**: enable **Sync on startup** in settings (runs 5 seconds after Obsidian loads)
- **Scheduled**: enable **Auto-sync** and set an interval

### Dataview example queries

Filter by type:
```dataview
TABLE trakt_year, trakt_rating, trakt_watched
FROM "trakt"
WHERE trakt_type = "movie"
SORT trakt_rating DESC
```

Show only favorites:
```dataview
TABLE trakt_year, trakt_my_rating
FROM "trakt"
WHERE trakt_favorite = true
SORT trakt_my_rating DESC
```

Show your watchlist:
```dataview
TABLE trakt_year, trakt_type, trakt_genres
FROM "trakt"
WHERE trakt_watchlist = true
SORT trakt_year DESC
```
