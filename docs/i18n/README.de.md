# Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.8.7%2B-7c3aed)](https://obsidian.md)

**Verwandle deinen [Trakt.tv](https://trakt.tv) Sehverlauf in eine reichhaltig lokalisierte Markdown-Bibliothek — mit episodengenauen Zeitstempeln, Metadaten in 15+ Sprachen und einer leisen inkrementellen Synchronisation, die deinen Vault nicht in Bewegung versetzt.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · **Deutsch** · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ Warum?

- **Detaillierter Sehverlauf** — genau welche Episode du wann gesehen hast, einschließlich erneuter Visionierungen, synchron gehalten beim Weiterschauen
- **Metadaten in 15+ Sprachen** — Übersetzung von Titeln / Beschreibungen / Taglines / Genres über TMDB. Integrierte Voreinstellungen für Chinesisch (CN / TW / HK), Japanisch, Koreanisch, Französisch, Deutsch, Spanisch (ES / MX), Portugiesisch (BR), Italienisch, Russisch — plus ein benutzerdefinierter Modus, der jede von TMDB unterstützte Locale akzeptiert. **Strikte Primärsprache + benutzerdefinierter Fallback** (z. B. zh-CN mit englischem Fallback) verhindert stille zh-TW-Substitutionen, wenn die primäre Übersetzung fehlt. Englische Originale werden immer in `*_original_*` Frontmatter-Feldern beibehalten
- **Dateinamen folgen deiner Sprache** — wechsle die Metadatensprache und vorhandene Notizen werden bei der nächsten Synchronisation automatisch auf den neuen Titel umbenannt. Obsidians interne Links werden automatisch aktualisiert. Ein einmaliger „Jetzt umbenennen"-Button in den Einstellungen für manuelle Auslöser
- **Notiz-Vorlagen in 11 Sprachen** — handgepflegte mitgelieferte Vorlagen (en + zh-CN + zh-TW + ja + ko + fr + de + it + es + pt-BR + ru). Wähle aus dem Vorlagensprache-Dropdown; wechsle jederzeit ohne Anpassungen zu verlieren
- **Tab-basierte Einstellungsoberfläche** — Allgemein / Notizen / Sync / Daily Notes. Der zuletzt angezeigte Tab wird pro Gerät gemerkt
- **Daily Notes-Integration** — fügt bei jeder Synchronisation pro Ereignis eine Zeile in deine Daily Note ein (gesehen / zur Watchlist hinzugefügt / favorisiert / bewertet), chronologisch sortiert, in deiner gewählten Vorlagensprache. Der markerbegrenzte Bereich ist vollständig isoliert — Inhalte außerhalb werden nie verändert. Ein optionaler **inkrementeller Modus** bewahrt deine handschriftlichen Anmerkungen innerhalb des Markerblocks. Manueller Backfill per Datumsbereich mit Schnellvoreinstellungen (Letzte 7 Tage / Dieser Monat / usw.). Siehe [spec 0006](../specs/0006-daily-notes-integration.md)
- **Schnelle inkrementelle Synchronisation** — die erste Synchronisation füllt den lokalen TMDB-Cache und den Trakt-Verlaufszustand; nachfolgende Synchronisationen rufen nur Änderungen ab. Die Sync-Zeit im eingeschwungenen Zustand sinkt von Minuten auf wenige Sekunden. Siehe [spec 0001](../specs/0001-incremental-sync.md)
- **Leise Schreibvorgänge** — Sync schreibt nur Notizen neu, deren Inhalt sich tatsächlich geändert hat. Nach dem Ansehen einer neuen Episode schreibt eine 1200-Eintrag-Bibliothek eine Notiz statt aller 1200 — deine geräteübergreifende Sync-Schicht (Obsidian Sync / iCloud / Syncthing) hört auf, die gesamte Bibliothek bei jedem Lauf erneut hochzuladen. Siehe [spec 0002](../specs/0002-diff-based-write.md)
- **Cloud-Schalter pro Einstellung** — wähle, welche Einstellungen zwischen Geräten synchronisieren und welche lokal bleiben. Auto-Sync-Intervall, Startup-Sync-Schalter, UI-Sprache — jede kann gerätelokal sein, damit dein Mac und dein iPhone sich nicht darum streiten. Siehe [spec 0003](../specs/0003-device-local-settings.md)

## 🎬 Detaillierter Sehverlauf

Wenn **Sync watch history (detailed)** aktiviert ist, fragt das Plugin den `/sync/history`-Endpunkt von Trakt ab und fügt episodengenaue (oder filmgenaue) Zeitstempel direkt in den Notiztext ein — und hält diesen Block aktuell, während du neue Episoden schaust:

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

Erneute Visionierungen werden kommagetrennt aufgelistet; Episoden sortieren nach Staffel und Episodennummer. Der Block ist von `%% trakt:watch-history %%`-Markern umschlossen — das Plugin aktualisiert nur den Inhalt zwischen den Markern, sodass **handgeschriebene Notizen anderswo im Text niemals berührt werden**.

<!-- screenshot: watch-history -->

## 🌐 Metadaten-Lokalisierung

Stelle **Metadata language** auf deine Sprache ein, und synchronisierte Notizen erhalten Titel, Beschreibung, Tagline und Genres über TMDB übersetzt (mit Trakts Übersetzungs-Endpunkt als Rückfall, wenn kein TMDB-Schlüssel konfiguriert ist). Englische Originale bleiben in den `trakt_original_*`-Frontmatter-Feldern:

```yaml
trakt_title: 黑暗骑士
trakt_original_title: The Dark Knight
trakt_genres:
  - 动作
  - 犯罪
  - 剧情
trakt_original_genres:
  - Action
  - Crime
  - Drama
trakt_metadata_language: zh-CN
```

Tags und Tag-Note-Pfade bleiben immer auf Englisch — deine bestehenden Dataview-Abfragen funktionieren unverändert weiter.

<!-- screenshot: metadata-localization -->

## 🌍 Plugin-Oberfläche + Notiz-Vorlagen

Die Metadaten-Lokalisierung oben ist eine Achse; die eigenen Oberflächen des Plugins sind separate Achsen:

- **Die Einstellungsregisterkarte, die Befehlspalette und Hinweis-Popups** sprechen **English** und **简体中文**. Weitere UI-Sprachen auf Anfrage — [öffne ein Issue](https://github.com/o1xhack/obsidian-sync-trakt/issues), wenn du eine beitragen möchtest.
- **Mitgelieferte Notiz-Vorlagen** in 11 Sprachen — Englisch, vereinfachtes Chinesisch (zh-CN), traditionelles Chinesisch (zh-TW / zh-HK), Japanisch, Koreanisch, Französisch, Deutsch, Italienisch, Spanisch, Portugiesisch (BR), Russisch. Handgepflegt, nicht maschinell übersetzt; Abschnittsüberschriften, Listenbeschriftungen und Zeichensetzung folgen den Konventionen jeder Sprache (Vollbreite-Doppelpunkte im Japanischen, Doppelpunkte mit Leerzeichen im Französischen usw.). Das Vorlagensprache-Dropdown listet nur diese 11 Sprachen; Locales außerhalb der Liste fallen auf Englisch zurück (anstatt stillschweigend eine verwandte Schwesterlokalisierung auszuwählen).

<!-- screenshot: bilingual-ui -->

## 📅 Daily Notes-Integration

Fügt bei jeder Synchronisation pro Ereignis automatisch eine Zeile in deine Daily Note ein — chronologisch sortiert, in deiner gewählten Vorlagensprache. Deckt gesehene Episoden, Watchlist-Zugänge, Favoriten und Bewertungen ab:

```markdown
%% trakt:daily:start %%
10:00 — gesehen Low-IQ Crime (2026) S1E16, S1E17
14:30 — zur Watchlist hinzugefügt The Dark Knight (2008)
21:30 — bewertet 9/10 Reborn (2020)
%% trakt:daily:end %%
```

Jeder Ereignistyp ist durch seinen entsprechenden Sync-Quellschalter gesteuert — wenn `Sync favorites` aus ist, erscheinen Favoriten-Ereignisse auch nicht in den Daily Notes. Verben (`watched` / `看了` / `視聴` / `시청` / `gesehen`…) folgen deiner **Vorlagensprache** über alle 11 mitgelieferten Sprachen hinweg.

**Sicherheitsvertrag**: Der Markerbereich ist vollständig isoliert — Inhalte außerhalb werden **nie verändert**. Vergangene Tage sind standardmäßig nur erweiterbar (vorhandene Marker bleiben erhalten); der heutige Tag wird überschrieben, damit neuere Ereignisse bei späteren Synchronisationen erscheinen. Ein optionaler **inkrementeller Modus** stellt auch das heutige Verhalten auf nur-anhängen um, sodass Anmerkungen, die du innerhalb des Markerblocks schreibst, jede Synchronisation überleben.

**Manueller Backfill** verwendet einen Datumsbereich-Picker mit Schnellvoreinstellungen (Letzte 7 Tage / Letzte 30 Tage / Dieser Monat / Letzter Monat). Eine Live-Zählung zeigt vor der Bestätigung, wie viele Daily Notes im gewählten Bereich tatsächlich existieren. Konfiguriere Ordner + Dateinamenformat (Moment.js-Syntax wie `YYYY-MM-DD` oder `YYYY/YYYY.MM.DD`) in **Einstellungen → Daily Notes**. Siehe [spec 0006](../specs/0006-daily-notes-integration.md).

## 🔄 Geräte­übergreifende Synchronisation

Der Authentifizierungsstatus — Trakt-Token, TMDB-Schlüssel, alle Einstellungen — befindet sich in `<vault>/.obsidian/plugins/sync-trakt/data.json` und folgt deiner Vault-Sync-Schicht. Konfiguriere die Authentifizierung einmal auf dem Mac und teile sie mit dem iPhone über Obsidian Sync (mit aktiviertem `Plugin data`), Syncthing, iCloud + Advanced Data Protection oder Cryptomator. Das Plugin speichert nichts auf einem Server.

**Jede einzelne Einstellung kann sich von der geräteübergreifenden Synchronisation abmelden** über ein kleines Cloud-Symbol daneben (derzeit verfügbar für `Sync on startup` / `Auto-sync` / `Auto-sync interval` / `Plugin UI language`). Nützlich, wenn du z. B. Auto-Sync alle 30 Min auf Mac, aber nie auf dem iPhone möchtest.

## 📊 Bibliothek in Obsidian Bases anzeigen

Das Frontmatter-Feld `trakt_poster_url` funktioniert **out-of-the-box** mit [Obsidian Bases](https://help.obsidian.md/bases) (Obsidian 1.9.3+) — erstelle eine Datenbank-Ansicht über deinem Sync-Ordner und Poster werden als Thumbnails angezeigt:

- **Karten-Ansicht**: Display-Einstellungen öffnen → **Image property** auf `trakt_poster_url` setzen
- **Tabellen-Ansicht** (1.9.4+): Formel-Spalte mit `image(note.trakt_poster_url)` hinzufügen

Filtere nach `trakt_type = "movie"` / `"show"`, sortiere nach `trakt_year` / `trakt_rating` / `trakt_my_rating`, gruppiere nach `trakt_genres` — alles möglich. Die Frontmatter-Eigenschaften, die Dataview-Abfragen antreiben, treiben auch Bases-Ansichten an — keine zusätzliche Konfiguration nötig.

## 🚀 Schnellstart

1. Einstellungen → Community plugins → **Durchsuchen** → suche nach **Sync Trakt** → **Installieren** → **Aktivieren**
2. Einstellungen → **Sync Trakt** → trage deine Trakt + TMDB API-Schlüssel ein ([SETUP-Anleitung](../SETUP.md))
3. Befehlspalette → **Sync Trakt: Sync**

## 🔑 API-Schlüssel: was jeder freischaltet

Das Plugin verwendet zwei APIs. **Trakt ist Pflicht** — ohne sie kann das Plugin nichts synchronisieren. **TMDB ist optional**, schaltet aber das frei, weshalb die meisten Nutzer das Plugin überhaupt installieren. Hier die Aufschlüsselung:

| Funktion | Trakt API<br/>_(erforderlich)_ | TMDB API<br/>_(empfohlen)_ |
|---|:---:|:---:|
| Trakt-Bibliothek synchronisieren (watchlist, watched, favorites, ratings) | ✅ | — |
| Episodengenaue Sehzeit-Stempel | ✅ | — |
| Titel / Beschreibung / Tagline in deiner Sprache | ✅ einfach | ✅ höhere Qualität |
| **Genres in deiner Sprache** | ❌ | ✅ |
| **In Notizen eingebettete Poster-Bilder** | ❌ | ✅ |

Wenn dir englische Inhalte ohne Poster reichen, lass TMDB leer — Trakt allein genügt. Für vollständige nicht-englische Lokalisierung (inkl. Genres und Poster) **trage einen TMDB-Schlüssel ein** ([kostenlose Anmeldung](https://www.themoviedb.org/settings/api)). Klicke nach dem Einfügen auf den **Test**-Button neben dem Eingabefeld, um zu prüfen, ob der Schlüssel funktioniert, bevor du die erste Synchronisation startest.

→ [Vollständige Anleitung für beide Schlüssel](../SETUP.md)

## 📦 Installation

<details open>
<summary><b>Obsidian Community Plugins (empfohlen)</b></summary>

1. Einstellungen → Community plugins → **Durchsuchen**
2. Suche nach **Sync Trakt**
3. Klicke auf **Installieren** → **Aktivieren**

Verzeichnis-Seite: https://community.obsidian.md/plugins/sync-trakt

</details>

<details>
<summary><b>Entwicklung (aus Quellcode bauen)</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # erzeugt main.js
npm run lint
npm run test:i18n  # Smoke-Tests
```

Dann kopiere `main.js`, `manifest.json`, `styles.css` nach `<vault>/.obsidian/plugins/sync-trakt/`.

</details>

<details>
<summary><b>Lokaler Test (manuelle Installation)</b></summary>

1. Lade `main.js`, `manifest.json`, `styles.css` aus dem [neuesten Release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) herunter
2. Platziere alle drei Dateien in `<dein-vault>/.obsidian/plugins/sync-trakt/`
3. Einstellungen → Community plugins → aktiviere **Sync Trakt**

</details>

## 📚 Dokumentation

| Dokument | Inhalt |
|---|---|
| [SETUP](../SETUP.md) | Erstellung der Trakt + TMDB API-Schlüssel, Erstkonfiguration, Fehlerbehebung (Englisch) |
| [MANUAL](../MANUAL.md) | Vollständige Einstellungsreferenz, Frontmatter-Felder, Vorlagenvariablen (Englisch) |
| [DEVELOPER](../DEVELOPER.md) | Architektur, Datenfluss, Erweiterungs­anleitung (nur Englisch) |
| [docs/i18n/](.) | README-Übersetzungen in 8 weiteren Sprachen |

## 🗺️ Roadmap

Größere Versionen seit dem Fork (chronologisch):

- [x] **0.1** — Erster Fork. Detaillierter Sehverlauf mit episodengenauen Zeitstempeln, Metadaten-Lokalisierung über TMDB + Trakt-Fallback-Kette, zweisprachige Oberfläche (en + zh-CN), übersetzte Notiz-Vorlagen (en + zh-CN + zh-TW), eigene Plugin-ID separat vom Upstream zur Koexistenz.
- [x] **0.2** — Inkrementelle Synchronisation. Persistenter TMDB-Cache (stale-while-revalidate, 90-Tage-TTL mit Jitter) + Trakt-Verlaufszustands-Cursor. Sync im eingeschwungenen Zustand fällt von Minuten auf wenige Sekunden. → [spec 0001](../specs/0001-incremental-sync.md)
- [x] **0.3** — Diff-basierte Schreibvorgänge. Nur Notizen neu schreiben, deren Frontmatter oder verwaltete Body-Sektion sich tatsächlich geändert hat; geräteübergreifende Sync-Schichten hören auf, 1200 Dateien pro Sync zu verschieben. 0.3.x ergänzte zudem: TMDB-API-Schlüssel-Test-Button + Warnbanner, wenn die Metadatensprache ohne Schlüssel gesetzt ist, und zweistufige Dateinamen-Disambiguierung für lokalisierte Titelkollisionen (z. B. 5 Serien alle namens „重生" streiten sich nicht mehr um denselben Dateinamen). → [spec 0002](../specs/0002-diff-based-write.md)
- [x] **0.4** — Vorbereitung zur Einreichung im Verzeichnis. Plugin-ID umbenannt `obsidian-sync-trakt` → `sync-trakt` (der Bot des Obsidian-Verzeichnisses lehnt IDs ab, die „obsidian" enthalten), `minAppVersion` auf 1.6.6 angezogen, und transparente automatische Datenmigration aus dem alten Ordner beim ersten Start. → [spec 0004](../specs/0004-obsidian-directory-submission.md)
- [x] **0.5** — Gerätelokale Einstellungen + automatische Bereinigung. Cloud-Symbol-Schalter pro Einstellung, sodass jede Einstellung sich von der geräteübergreifenden Synchronisation abmelden kann; automatische Bereinigung der Binärdateien des alten Ordners (data.json bleibt als Sicherheitsnetz erhalten), damit Benutzer keine doppelten Plugin-Einträge in ihren Einstellungen sehen. → [spec 0003](../specs/0003-device-local-settings.md)
- [x] **0.6** — Tab-basierte Einstellungsoberfläche + 11 mitgelieferte Notiz-Vorlagensprachen. Einstellungsseite in 4 Tabs umstrukturiert (Allgemein / Notizen / Sync / Daily Notes). Notiz-Vorlagen von 3 auf 11 handgepflegte Sprachen erweitert (+ ja, ko, fr, de, it, es, pt-BR, ru). Vorlagensprache-Dropdown gefiltert, um nur mitgelieferte Sprachen anzuzeigen. → [spec 0005](../specs/0005-settings-ui-tabs.md) + [spec 0007](../specs/0007-template-language-expansion.md)
- [x] **0.7** — Daily Notes-Integration. Fügt pro Ereignis (gesehen / Watchlist / favorisiert / bewertet) eine Zeile in deine Daily Note ein bei jeder Synchronisation, chronologisch sortiert, in deiner gewählten Vorlagensprache. Nur-erweiterbare Sicherheit für vergangene Tage; der heutige Tag wird im Tagesverlauf überschrieben. → [spec 0006](../specs/0006-daily-notes-integration.md)
- [x] **0.8** — **Inkrementeller Synchronisationsmodus** für Daily Notes. Opt-in-Modus, in dem der heutige Markerbereich nur-anhängend ist (statt komplett ersetzt zu werden), sodass alle innerhalb geschriebenen Anmerkungen jede Synchronisation überleben.
- [x] **0.9** — **Metadaten-Sprachfallback**. Fügt unter Metadatensprache ein „Fallback-Sprache"-Dropdown hinzu. Wenn gesetzt, wird die Primärsprache zur strengen Übereinstimmung (keine stille zh-TW-Substitution für zh-CN) und fällt vor dem englischen Original auf den vom Benutzer gewählten Fallback durch. → [spec 0008](../specs/0008-metadata-language-fallback.md)
- [x] **1.0** — **Automatisches Umbenennen von Dateinamen + persistentes „Was ist neu"-Modal + Backfill nach Datumsbereich**. Eine Änderung der Metadatensprache benennt nun vorhandene Notizen bei der nächsten Synchronisation automatisch um (interne Obsidian-Links aktualisieren sich automatisch). Jede neue Release zeigt einmalig ein „Was ist neu"-Modal mit der Versionshistorie seit dem letzten Aufruf. Manueller Backfill wurde durch einen Datumsbereich-Picker ersetzt (Start / Ende + Schnellvoreinstellungen). → [spec 0009](../specs/0009-filename-rename.md)
- [ ] **Zukunft** — Weitere Plugin-UI-Übersetzungen (derzeit en + zh-CN) auf Anfrage; weitere mitgelieferte Vorlagensprachen auf Wunsch.

## 🤝 Danksagung

Dieses Plugin wurde ursprünglich von [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (MIT-lizenziert) inspiriert, das das anfängliche Gerüst für die Trakt-OAuth-Anbindung lieferte. Erhebliche nachfolgende Arbeit — detaillierte Sehverlauf-Aggregation, Metadaten-Lokalisierung mit Übersetzungs-Fallback-Ketten, zweisprachige Oberfläche, nebenläufigkeits-begrenztes Abrufen mit Live-Fortschrittsmeldung, maschinell verwaltete Body-Sektionen, übersetzungs-bewusster Template-Renderer, mehrsprachiges Dokumentations-System — hat den Großteil der Codebasis in eine grundlegend andere Architektur umgestaltet.

Dank an [Sarim Abbas](https://github.com/sarimabbas) für den Ausgangspunkt. Der MIT-Copyright-Hinweis des Originalwerks bleibt wörtlich in [LICENSE](../../LICENSE) neben dem eigenen Hinweis dieses Projekts erhalten.

## 📄 Lizenz

MIT — siehe [LICENSE](../../LICENSE).

---

Autor: [o1xhack](https://github.com/o1xhack)
