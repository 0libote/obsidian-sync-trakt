# Setup guide

> 🌐 **English** · [简体中文](i18n/SETUP.zh-CN.md) · [繁體中文](i18n/SETUP.zh-TW.md) · [日本語](i18n/SETUP.ja.md)

Walk-through for getting Obsidian Sync Trakt connected: creating a Trakt
OAuth application, getting a TMDB API key, configuring the plugin, and
running your first sync.

## 1. Trakt — create an OAuth application

Required so the plugin can authorize against your Trakt account.

1. Sign in at [trakt.tv](https://trakt.tv) (free account is fine)
2. Open <https://trakt.tv/oauth/applications> → **New Application**
3. Fill the form:
   - **Name** — anything, e.g. `Obsidian Sync Trakt`
   - **Redirect URI** — must be **exactly** `urn:ietf:wg:oauth:2.0:oob` ⚠️ — this
     is the device-flow magic string. One character off and Connect will fail
     with a 401
   - **Description / Website / Permissions** — optional / leave defaults
4. Save. The app page now shows your **Client ID** and **Client Secret** (click
   the eye icon next to Secret to reveal it)

Both values stay accessible at <https://trakt.tv/oauth/applications> later —
click your app to view them again.

## 2. TMDB — get a v3 API key

Required for **poster images** and strongly recommended for **metadata
localization**. Without a TMDB key, the plugin can still localize via Trakt's
translation endpoint, but coverage is narrower (no genre translations).

1. Sign up at <https://www.themoviedb.org/signup> (free)
2. **Verify your email** — you can't request an API key until your email is
   verified. Check your inbox / spam folder
3. Open <https://www.themoviedb.org/settings/api> → **Create** → choose
   **Developer**
4. Accept the terms, then fill the form:
   - **Application Name** — e.g. `Obsidian personal`
   - **Application URL** — any valid URL, e.g. `https://github.com/your-username`
     or `https://obsidian.md`. Cannot be left blank
   - **Application Summary** — one line, e.g. *"Personal use: enrich Obsidian
     notes with TMDB metadata and posters"*
   - Contact info — real email
5. Submit. The page now shows two values:
   - **API Key (v3 auth)** — 32 hex characters. **This is what the plugin
     needs**
   - **API Read Access Token (v4 auth)** — JWT. Not used by this plugin; ignore

The v3 key stays accessible at <https://www.themoviedb.org/settings/api>.

## 3. Configure the plugin

After installing the plugin (see [README → Install](../README.md#-install)),
open **Settings → Obsidian Sync Trakt**.

### Authentication

1. Paste **Trakt client ID** and **Trakt client secret** from step 1
2. Click **Connect** — a modal pops up showing a verification URL
   (`trakt.tv/activate`) and an 8-character user code
3. Visit the URL in any browser, log in to Trakt, paste the code, click
   **Continue**
4. The modal closes automatically; the **Connection status** field changes
   to **Traktr connected**

### TMDB

5. Paste **API key (v3 auth)** from step 2
6. Pick a **Poster size** — `w500` is a good default

### Localization (optional)

7. **Metadata language** — pick a preset (e.g. `Chinese (Simplified, China)`
   for `zh-CN`) or **Custom** to enter any BCP 47 code. Leave on `Default`
   to keep everything in English
8. **Plugin UI language** — `English` or `简体中文`. Affects the settings
   tab, command palette, notice popups
9. **Note template language** — picks the bundled default templates' language
   for the **Reset to default** button. If your current template is unmodified,
   switching this auto-rewrites it

### Sync sources — pick what to sync

10. **Sync watchlist** — items you want to watch *(default ON)*
11. **Sync favorites** — items you've marked as favorites *(default ON)*
12. **Sync watch history** — items you've watched, with play count and last
    watched timestamp *(default OFF; can be a large dataset)*
13. **Sync watch history (detailed)** — adds per-episode (or per-movie) watch
    timestamps to the note body via `{{watch_history}}`. Only shown when **Sync
    watch history** is on. *(default OFF; significantly slower for large
    libraries — Trakt's `/sync/history` endpoint paginates at 100 watch events
    per page)*
14. **Sync ratings** — items you've rated 1–10 *(default OFF)*

### Run the first sync

15. Command palette (Ctrl/Cmd+P) → **Traktr: Sync**

For a quick first test, leave only **Sync watchlist** on — most users have
< 100 items in their watchlist, so it finishes fast.

## Troubleshooting

### Connect fails with 401

Almost always the Redirect URI in your Trakt OAuth app. It must be exactly
`urn:ietf:wg:oauth:2.0:oob`. Open <https://trakt.tv/oauth/applications>, click
your app, fix the field, save, and try Connect again.

### TMDB rejects the API key request

Common causes:

- Email not verified — check inbox / spam
- Application URL field left blank — TMDB requires a URL even for personal apps
- The rejection email usually states the specific reason — read it

### Sync takes a long time

For accounts with thousands of items, the first sync can take several minutes.
Subsequent syncs re-fetch all data (no incremental fetch on the API side); the
work is dominated by API requests, not file IO.

If **Sync watch history (detailed)** is on, expect more API time — Trakt's
history endpoint returns one entry per individual watch event, paginated 100
per page.

### Coexisting with the upstream `sarimabbas/traktr` plugin

Distinct plugin id (`obsidian-sync-trakt` vs `traktr`) means they install in
different folders and don't conflict at the OS level. **But** both default to
the same `Notes folder` (`trakt`) and `Property prefix` (`trakt_`), so they'll
fight over the same notes if both run. To run both safely, change one of them
to use a different `Notes folder` in its settings.

### Where to find your tokens later

| Token | URL |
|---|---|
| Trakt client ID + secret | <https://trakt.tv/oauth/applications> → click your app |
| TMDB API key (v3 auth) | <https://www.themoviedb.org/settings/api> |

Trakt access tokens auto-refresh; you don't need to do anything. TMDB API keys
don't expire.
