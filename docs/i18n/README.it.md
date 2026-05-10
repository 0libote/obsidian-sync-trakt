# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**Trasforma la tua cronologia di visione [Trakt.tv](https://trakt.tv) in una libreria Markdown riccamente localizzata — con timestamp per episodio, metadati nella tua lingua e un'interfaccia bilingue.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Italiano**

<!-- screenshot: hero -->

## ✨ Perché?

- **Cronologia di visione dettagliata** — esattamente quale episodio hai visto e quando, comprese le rivisioni, sincronizzato man mano che continui a guardare
- **Metadati localizzati** — traduzione di titoli / sinossi / tagline / generi via TMDB; gli originali in inglese vengono sempre conservati a fianco
- **Interfaccia bilingue** — impostazioni, comandi e notifiche in English o 简体中文; modelli di nota integrati in en / zh-CN / zh-TW

## 🎬 Cronologia di visione dettagliata

Quando **Sync watch history (detailed)** è attivato, il plugin interroga l'endpoint `/sync/history` di Trakt e inserisce timestamp per episodio (o per film) direttamente nel corpo della nota — e mantiene quel blocco aggiornato man mano che guardi nuovi episodi:

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

Le rivisioni vengono elencate separate da virgole; gli episodi sono ordinati per stagione e poi per numero di episodio. Il blocco è racchiuso in marcatori `%% trakt:watch-history %%` — il plugin aggiorna solo il contenuto tra i marcatori, quindi **le note scritte a mano altrove nel corpo non vengono mai toccate**.

<!-- screenshot: watch-history -->

## 🌐 Localizzazione metadati

Imposta **Metadata language** sulla tua lingua preferita e le note sincronizzate otterranno titolo, sinossi, tagline e generi tradotti via TMDB (con l'endpoint di traduzione di Trakt come ripiego se non è configurata una chiave TMDB). Gli originali in inglese rimangono nei campi frontmatter `trakt_original_*`:

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

I tag e i percorsi tag-note rimangono sempre in inglese — le tue query Dataview esistenti continuano a funzionare invariate.

<!-- screenshot: metadata-localization -->

## 🌍 Interfaccia bilingue + modelli tradotti

La scheda impostazioni, la palette dei comandi e i popup di notifica parlano sia **English** che **简体中文**. I modelli di nota integrati sono disponibili in inglese, cinese semplificato (`zh-CN`) e cinese tradizionale (`zh-TW` / `zh-HK`); gli altri codici lingua ricadono sul modello inglese — personalizza manualmente se desideri un'altra lingua.

<!-- screenshot: bilingual-ui -->

## 🔄 Sincronizzazione tra dispositivi

Lo stato di autenticazione — token Trakt, chiave TMDB, tutte le impostazioni — risiede in `<vault>/.obsidian/plugins/obsidian-sync-trakt/data.json` e segue il tuo livello di sincronizzazione del vault. Configura l'autenticazione una volta su Mac, condividila con iPhone tramite Obsidian Sync (con `Plugin data` attivato), Syncthing, iCloud + Advanced Data Protection, o Cryptomator. **Il plugin non memorizza nulla su alcun server.**

## 📊 Visualizzazione in Obsidian Bases

Il campo frontmatter `trakt_poster_url` funziona **subito** con [Obsidian Bases](https://help.obsidian.md/bases) (Obsidian 1.9.3+) — crea una vista database sulla tua cartella di sincronizzazione e i poster verranno mostrati come miniature:

- **Vista a schede**: apri impostazioni Display → imposta **Image property** su `trakt_poster_url`
- **Vista a tabella** (1.9.4+): aggiungi una colonna formula con `image(note.trakt_poster_url)`

Filtra per `trakt_type = "movie"` / `"show"`, ordina per `trakt_year` / `trakt_rating` / `trakt_my_rating`, raggruppa per `trakt_genres` — tutto possibile. Le proprietà frontmatter che alimentano le query Dataview alimentano anche le viste Bases — nessuna configurazione aggiuntiva.

## 🚀 Avvio rapido

1. Installa tramite [BRAT](https://github.com/TfTHacker/obsidian42-brat) → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. Impostazioni → **Obsidian Sync Trakt** → inserisci le tue chiavi API Trakt + TMDB ([guida SETUP](../SETUP.md))
3. Palette dei comandi → **Traktr: Sync**

## 📦 Installazione

<details>
<summary><b>BRAT (consigliato)</b></summary>

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installa e aggiorna automaticamente i plugin da qualsiasi repository GitHub.

1. Installa **Obsidian42 - BRAT** dai Community Plugins
2. Impostazioni → BRAT → **Add a beta plugin for testing**
3. Incolla:
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. **Add Plugin** → attiva in Impostazioni → Community plugins

BRAT controllerà gli aggiornamenti a ogni avvio di Obsidian e scaricherà automaticamente le nuove release.

</details>

<details>
<summary><b>Manuale</b></summary>

1. Scarica `main.js`, `manifest.json`, `styles.css` dalla [release più recente](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)
2. Posiziona tutti e tre i file in `<tuo-vault>/.obsidian/plugins/obsidian-sync-trakt/`
3. Impostazioni → Community plugins → attiva **Obsidian Sync Trakt**

</details>

<details>
<summary><b>Obsidian Community Plugins (in attesa)</b></summary>

> ⚠️ Non ancora elencato nella directory ufficiale dei Community Plugins di Obsidian. Una volta accettato, questo sarà il percorso consigliato. Fino ad allora, usa BRAT sopra.

</details>

<details>
<summary><b>Compilare dai sorgenti</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # produce main.js
npm run lint
npm run test:i18n  # smoke test
```

Quindi copia `main.js`, `manifest.json`, `styles.css` in `<vault>/.obsidian/plugins/obsidian-sync-trakt/`.

</details>

## 📚 Documentazione

| Documento | Contenuto |
|---|---|
| [SETUP](../SETUP.md) | Creazione chiavi API Trakt + TMDB, configurazione iniziale, risoluzione problemi (inglese) |
| [MANUAL](../MANUAL.md) | Riferimento completo delle impostazioni, campi frontmatter, variabili template (inglese) |
| [DEVELOPER](../DEVELOPER.md) | Architettura, flusso dati, come estendere (solo inglese) |
| [docs/i18n/](.) | Traduzioni del README in 8 lingue aggiuntive |

## 🗺️ Roadmap

- [x] Sincronizzazione dettagliata della cronologia per episodio
- [x] Localizzazione metadati (TMDB + ripiego traduzioni Trakt)
- [x] Interfaccia plugin bilingue (en + zh-CN)
- [x] Modelli di nota predefiniti tradotti (en + zh-CN + zh-TW)
- [ ] Cache metadati TMDB — evitare re-download al cambio di lingua
- [ ] Invio alla directory Community Plugins di Obsidian
- [ ] Altre traduzioni UI (ja / ko / fr / ...) su richiesta

## 🤝 Ringraziamenti

Questo plugin è stato inizialmente ispirato da [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (licenza MIT), da cui proviene l'impalcatura iniziale per la connessione OAuth a Trakt. Il lavoro sostanziale successivo — aggregazione dettagliata della cronologia di visione, localizzazione dei metadati con catene di fallback di traduzione, interfaccia bilingue, fetching a concorrenza limitata con report di avanzamento in tempo reale, sezioni di corpo gestite dalla macchina, motore di template consapevole delle traduzioni, sistema documentale multilingue — ha rimodellato la maggior parte del codice in un'architettura fondamentalmente diversa.

Grazie a [Sarim Abbas](https://github.com/sarimabbas) per il punto di partenza. L'avviso di copyright MIT dell'opera originale è preservato testualmente in [LICENSE](../../LICENSE) insieme all'avviso di questo progetto.

## 📄 Licenza

MIT — vedi [LICENSE](../../LICENSE).

---

Autore: [o1xhack](https://github.com/o1xhack)
