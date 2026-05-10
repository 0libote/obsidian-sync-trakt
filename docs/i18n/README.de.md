# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**Verwandle deinen [Trakt.tv](https://trakt.tv) Sehverlauf in eine reichhaltig lokalisierte Markdown-Bibliothek — mit episodengenauen Zeitstempeln, Metadaten in deiner Sprache und einer zweisprachigen Oberfläche.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · **Deutsch** · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ Warum?

- **Detaillierter Sehverlauf** — genau welche Episode du wann gesehen hast, einschließlich erneuter Visionierungen, synchron gehalten beim Weiterschauen
- **Lokalisierte Metadaten** — Übersetzung von Titeln / Beschreibungen / Taglines / Genres über TMDB; englische Originale werden immer parallel beibehalten
- **Zweisprachige Oberfläche** — Einstellungen, Befehle und Hinweise in English oder 简体中文; mitgelieferte Notiz-Vorlagen in en / zh-CN / zh-TW

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

## 🌍 Zweisprachige Oberfläche + übersetzte Vorlagen

Die Einstellungsregisterkarte, die Befehlspalette und Hinweis-Popups sprechen sowohl **English** als auch **简体中文**. Mitgelieferte Notiz-Vorlagen gibt es in Englisch, vereinfachtem Chinesisch (`zh-CN`) und traditionellem Chinesisch (`zh-TW` / `zh-HK`); andere Sprachcodes greifen auf die englische Vorlage zurück — passe sie manuell an, wenn du eine andere Sprache möchtest.

<!-- screenshot: bilingual-ui -->

## 🔄 Geräte­übergreifende Synchronisation

Der Authentifizierungsstatus — Trakt-Token, TMDB-Schlüssel, alle Einstellungen — befindet sich in `<vault>/.obsidian/plugins/obsidian-sync-trakt/data.json` und folgt deiner Vault-Sync-Schicht. Konfiguriere die Authentifizierung einmal auf dem Mac und teile sie mit dem iPhone über Obsidian Sync (mit aktiviertem `Plugin data`), Syncthing, iCloud + Advanced Data Protection oder Cryptomator. **Das Plugin speichert nichts auf einem Server.**

## 🚀 Schnellstart

1. Installiere über [BRAT](https://github.com/TfTHacker/obsidian42-brat) → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. Einstellungen → **Obsidian Sync Trakt** → trage deine Trakt + TMDB API-Schlüssel ein ([SETUP-Anleitung](../SETUP.md))
3. Befehlspalette → **Traktr: Sync**

## 📦 Installation

<details>
<summary><b>BRAT (empfohlen)</b></summary>

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installiert und aktualisiert Plugins automatisch von beliebigen GitHub-Repositories.

1. Installiere **Obsidian42 - BRAT** aus den Community Plugins
2. Einstellungen → BRAT → **Add a beta plugin for testing**
3. Füge ein:
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. **Add Plugin** → aktiviere unter Einstellungen → Community plugins

BRAT prüft bei jedem Obsidian-Start auf Updates und zieht neue Releases automatisch.

</details>

<details>
<summary><b>Manuell</b></summary>

1. Lade `main.js`, `manifest.json`, `styles.css` aus dem [neuesten Release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest) herunter
2. Platziere alle drei Dateien in `<dein-vault>/.obsidian/plugins/obsidian-sync-trakt/`
3. Einstellungen → Community plugins → aktiviere **Obsidian Sync Trakt**

</details>

<details>
<summary><b>Obsidian Community Plugins (ausstehend)</b></summary>

> ⚠️ Noch nicht im offiziellen Community Plugins-Verzeichnis von Obsidian gelistet. Sobald akzeptiert, wird dies der empfohlene Pfad. Verwende bis dahin BRAT oben.

</details>

<details>
<summary><b>Aus Quellcode bauen</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # erzeugt main.js
npm run lint
npm run test:i18n  # Smoke-Tests
```

Dann kopiere `main.js`, `manifest.json`, `styles.css` nach `<vault>/.obsidian/plugins/obsidian-sync-trakt/`.

</details>

## 📚 Dokumentation

| Dokument | Inhalt |
|---|---|
| [SETUP](../SETUP.md) | Erstellung der Trakt + TMDB API-Schlüssel, Erstkonfiguration, Fehlerbehebung (Englisch) |
| [MANUAL](../MANUAL.md) | Vollständige Einstellungsreferenz, Frontmatter-Felder, Vorlagenvariablen (Englisch) |
| [DEVELOPER](../DEVELOPER.md) | Architektur, Datenfluss, Erweiterungs­anleitung (nur Englisch) |
| [docs/i18n/](.) | README-Übersetzungen in 8 weiteren Sprachen |

## 🗺️ Roadmap

- [x] Detaillierte Sehverlaufs-Synchronisation pro Episode
- [x] Metadaten-Lokalisierung (TMDB + Trakt-Übersetzungs-Rückfall)
- [x] Zweisprachige Plugin-Oberfläche (en + zh-CN)
- [x] Übersetzte Standard-Notiz-Vorlagen (en + zh-CN + zh-TW)
- [ ] TMDB-Metadaten-Cache — Sprachwechsel ohne erneutes API-Abfragen
- [ ] Einreichung beim Obsidian Community Plugins-Verzeichnis
- [ ] Weitere UI-Übersetzungen (ja / ko / fr / ...) auf Anfrage

## 🤝 Upstream

Dieses Plugin ist ein Fork von [**sarimabbas/traktr**](https://github.com/sarimabbas/traktr) (MIT-lizenziert). Die Kern-Synchronisations-Engine, die Frontmatter- / Vorlagenstruktur und das Tag-Note-System wurden alle direkt von diesem Projekt übernommen. Großer Dank an [Sarim Abbas](https://github.com/sarimabbas) für die ursprüngliche Arbeit.

## 📄 Lizenz

MIT — siehe [LICENSE](../../LICENSE). Das Upstream-Copyright (Sarim Abbas) und das Copyright dieses Forks (o1xhack) gelten beide.

---

Autor: [o1xhack](https://github.com/o1xhack)
