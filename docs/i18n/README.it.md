# Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.8.7%2B-7c3aed)](https://obsidian.md)

[![GitHub Sponsors](https://img.shields.io/badge/sponsor-GitHub%20Sponsors-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/o1xhack)

**Trasforma la tua cronologia di visione [Trakt.tv](https://trakt.tv) in una libreria Markdown riccamente localizzata — con timestamp per episodio, metadati in oltre 15 lingue e una sincronizzazione incrementale silenziosa che non agita il tuo vault.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Italiano**

<p align="center">
  <img src="../screenshots/hero_bases_movies_v3_editorial_stack.png" alt="Sync Trakt movie library in Obsidian Bases" width="100%">
</p>

## ✨ Perché?

- **Cronologia di visione dettagliata** — esattamente quale episodio hai visto e quando, comprese le rivisioni, sincronizzato man mano che continui a guardare
- **Metadati in oltre 15 lingue** — traduzione di titoli / sinossi / tagline / generi via TMDB. Preset integrati per cinese (CN / TW / HK), giapponese, coreano, francese, tedesco, spagnolo (ES / MX), portoghese (BR), italiano, russo — più una modalità personalizzata che accetta qualsiasi locale supportato da TMDB. **Lingua primaria rigorosa + ripiego definito dall'utente** (ad es. zh-CN con ripiego in inglese) impedisce sostituzioni silenziose a zh-TW quando manca la traduzione primaria. Gli originali in inglese vengono sempre conservati nei campi frontmatter `*_original_*`
- **I nomi dei file seguono la tua lingua** — cambia la lingua dei metadati e le note esistenti vengono rinominate automaticamente alla successiva sincronizzazione per corrispondere al nuovo titolo. I collegamenti interni di Obsidian si aggiornano automaticamente. Pulsante una tantum «Rinomina ora» nelle impostazioni per attivazioni manuali
- **Modelli di nota in 11 lingue** — modelli integrati curati a mano (en + zh-CN + zh-TW + ja + ko + fr + de + it + es + pt-BR + ru). Scegli dal menu a discesa della lingua del modello; cambia in qualsiasi momento senza perdere le personalizzazioni
- **Interfaccia impostazioni a schede** — Generale / Note / Sync / Daily Notes. L'ultima scheda visualizzata è memorizzata per dispositivo
- **Integrazione con le Daily Notes** — inserisce automaticamente una riga per evento nella tua Daily Note ad ogni sincronizzazione (visto / aggiunto alla watchlist / preferito / valutato), ordinate cronologicamente, nella lingua del modello scelta. La regione delimitata dai marcatori è completamente isolata — il contenuto al di fuori non viene mai modificato. Una **modalità incrementale** opzionale preserva le annotazioni scritte a mano all'interno del blocco dei marcatori. Backfill manuale tramite selettore di intervallo di date con preset rapidi (Ultimi 7 giorni / Questo mese / ecc.). Le Daily Notes possono anche usare un proprio intervallo di auto-sync senza riscrivere note multimediali. Vedi [spec 0006](../specs/0006-daily-notes-integration.md) e [spec 0011](../specs/0011-daily-notes-auto-sync.md)
- **Sincronizzazione incrementale rapida** — la prima sincronizzazione popola la cache TMDB locale e lo stato della cronologia Trakt; le sincronizzazioni successive recuperano solo ciò che è cambiato. Il tempo di sincronizzazione a regime scende da minuti a secondi. Vedi [spec 0001](../specs/0001-incremental-sync.md)
- **Scritture silenziose** — la sincronizzazione riscrive solo le note il cui contenuto è effettivamente cambiato. Dopo aver visto un nuovo episodio, una libreria di 1200 voci scrive una nota invece di tutte le 1200 — il tuo livello di sincronizzazione tra dispositivi (Obsidian Sync / iCloud / Syncthing) smette di ri-caricare l'intera libreria ad ogni esecuzione. Vedi [spec 0002](../specs/0002-diff-based-write.md)
- **Interruttore cloud per singola impostazione** — scegli quali impostazioni si sincronizzano tra dispositivi e quali restano locali. Intervallo di auto-sync, sync all'avvio, lingua dell'interfaccia — ciascuna può essere locale al dispositivo, così Mac e iPhone non si scontrano. Vedi [spec 0003](../specs/0003-device-local-settings.md)

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

<p align="center">
  <img src="../screenshots/episode_watch_history_view.png" alt="Detailed episode watch history in an Obsidian note" width="100%">
</p>

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

<p align="center">
  <img src="../screenshots/movie_note_properties_view.png" alt="Localized Trakt metadata stored as Obsidian note properties" width="100%">
</p>

## 🌍 Interfaccia del plugin + modelli di nota

La localizzazione dei metadati sopra è un asse; le superfici proprie del plugin sono assi separati:

- **La scheda impostazioni, la palette dei comandi e i popup di notifica** parlano **English** e **简体中文**. Altre lingue UI su richiesta — [apri un issue](https://github.com/o1xhack/obsidian-sync-trakt/issues) se vuoi contribuirne una.
- **Modelli di nota integrati** in 11 lingue — inglese, cinese semplificato (zh-CN), cinese tradizionale (zh-TW / zh-HK), giapponese, coreano, francese, tedesco, italiano, spagnolo, portoghese (BR), russo. Curati a mano, non tradotti automaticamente; titoli di sezione, etichette degli elenchi e punteggiatura seguono le convenzioni di ciascuna lingua (due punti a larghezza piena in giapponese, due punti spaziati in francese, ecc.). Il menu a discesa della lingua del modello elenca esattamente queste 11 lingue; i locale al di fuori dell'elenco ripiegano sull'inglese (invece di scegliere silenziosamente un locale fratello).

<p align="center">
  <img src="../screenshots/settings_sync_sources.png" alt="Tabbed Sync Trakt settings with sync source controls" width="100%">
</p>

## 📅 Integrazione con le Daily Notes

Inserisce automaticamente una riga per evento nella tua Daily Note ad ogni sincronizzazione — ordinate cronologicamente, nella lingua del modello scelta. Copre episodi visti, aggiunte alla watchlist, preferiti e valutazioni:

```markdown
%% trakt:daily:start %%
10:00 — visto Low-IQ Crime (2026) S1E16, S1E17
14:30 — aggiunto alla watchlist The Dark Knight (2008)
21:30 — valutato 9/10 Reborn (2020)
%% trakt:daily:end %%
```

Ogni tipo di evento è condizionato dal rispettivo interruttore della fonte di sincronizzazione — se `Sync favorites` è disattivato, gli eventi dei preferiti non appariranno nemmeno nelle Daily Notes. I verbi (`watched` / `看了` / `視聴` / `시청` / `visto`…) seguono l'impostazione **lingua del modello** in tutte le 11 lingue integrate.

**Contratto di sicurezza**: la regione dei marcatori è completamente isolata — il contenuto al di fuori **non viene mai modificato**. I giorni passati sono solo in aggiunta per impostazione predefinita (i marcatori esistenti vengono preservati); il giorno corrente viene riscritto in modo che gli eventi più recenti appaiano nelle sincronizzazioni successive. Una **modalità incrementale** opzionale cambia anche il comportamento di oggi in sola aggiunta, così qualsiasi annotazione scritta all'interno del blocco dei marcatori sopravvive a ogni sincronizzazione.

**Backfill manuale** usa un selettore di intervallo di date con preset rapidi (Ultimi 7 giorni / Ultimi 30 giorni / Questo mese / Mese scorso). Un conteggio in tempo reale mostra quante Daily Notes esistono effettivamente nell'intervallo scelto prima della conferma. Configura la cartella + formato del nome file (sintassi Moment.js come `YYYY-MM-DD` o `YYYY/YYYY.MM.DD`) in **Impostazioni → Daily Notes**. Vedi [spec 0006](../specs/0006-daily-notes-integration.md).

**Auto-sync solo Daily Notes** può essere attivato separatamente dall'auto-sync completo delle note multimediali. Aggiorna i dati Trakt/TMDB necessari per le Daily Notes e i file Daily Note esistenti, ma non crea, rinomina, elimina o riscrive note multimediali. Il timer Daily-only e il timer di sync completo condividono un solo lock; se scattano insieme, un'esecuzione viene saltata invece di scrivere in parallelo.

## 🔄 Sincronizzazione tra dispositivi

Lo stato di autenticazione — token Trakt, chiave TMDB, tutte le impostazioni — risiede in `<vault>/.obsidian/plugins/sync-trakt/data.json` e segue il tuo livello di sincronizzazione del vault. Configura l'autenticazione una volta su Mac, condividila con iPhone tramite Obsidian Sync (con `Plugin data` attivato), Syncthing, iCloud + Advanced Data Protection, o Cryptomator. Il plugin non memorizza nulla su alcun server.

Le grandi cache runtime ricostruibili, inclusi i metadati TMDB e gli aggregati dettagliati della watch history, vivono fuori dal vault nello storage locale di Obsidian su ciascun dispositivo. Non vengono caricate su Obsidian Sync e ogni dispositivo può ricostruirle da Trakt/TMDB se vengono cancellate. Un piccolo coordinatore di refresh completo sincronizzato impedisce a un dispositivo di riscrivere la cronologia dettagliata da una vecchia cache locale dopo che un altro dispositivo ha rilevato eliminazioni su Trakt.

**Qualsiasi singola impostazione può rinunciare alla sincronizzazione tra dispositivi** tramite una piccola icona cloud accanto ad essa (attualmente esposta per `Sync on startup` / `Auto-sync` / `Auto-sync interval` / `Daily Notes auto-sync` / `Daily Notes auto-sync interval` / `Plugin UI language`). Utile quando, ad esempio, vuoi sincronizzare le note multimediali ogni poche ore su Mac, le Daily Notes ogni 15 minuti su Mac e nessun timer automatico su iPhone.

## 📊 Visualizzazione in Obsidian Bases

Il campo frontmatter `trakt_poster_url` funziona **subito** con [Obsidian Bases](https://help.obsidian.md/bases) (Obsidian 1.9.3+) — crea una vista database sulla tua cartella di sincronizzazione e i poster verranno mostrati come miniature:

- **Vista a schede**: apri impostazioni Display → imposta **Image property** su `trakt_poster_url`
- **Vista a tabella** (1.9.4+): aggiungi una colonna formula con `image(note.trakt_poster_url)`

Filtra per `trakt_type = "movie"` / `"show"`, ordina per `trakt_year` / `trakt_rating` / `trakt_my_rating`, raggruppa per `trakt_genres` — tutto possibile. Le proprietà frontmatter che alimentano le query Dataview alimentano anche le viste Bases — nessuna configurazione aggiuntiva.

## 🚀 Avvio rapido

1. Impostazioni → Community plugins → **Sfoglia** → cerca **Sync Trakt** → **Installa** → **Attiva**
2. Impostazioni → **Sync Trakt** → inserisci le tue chiavi API Trakt + TMDB ([guida SETUP](../SETUP.md))
3. Palette dei comandi → **Sync Trakt: Sync**

## 🔑 Chiavi API: cosa sblocca ciascuna

Il plugin usa due API. **Trakt è obbligatoria** — senza, il plugin non può sincronizzare nulla. **TMDB è opzionale** ma sblocca la maggior parte di ciò che rende il plugin interessante. Dettagli:

| Funzionalità | API Trakt<br/>_(richiesta)_ | API TMDB<br/>_(consigliata)_ |
|---|:---:|:---:|
| Sincronizza la tua libreria Trakt (watchlist, watched, favorites, ratings) | ✅ | — |
| Timestamp di visione per episodio | ✅ | — |
| Titolo / sinossi / tagline nella tua lingua | ✅ base | ✅ qualità migliore |
| **Generi nella tua lingua** | ❌ | ✅ |
| **Immagini dei poster incorporate nelle note** | ❌ | ✅ |

Se ti basta il contenuto in inglese e non ti interessano i poster, puoi lasciare TMDB vuoto — Trakt da sola è sufficiente. Per una localizzazione completa non-inglese (inclusi generi e poster), **aggiungi una chiave TMDB** ([registrazione gratuita](https://www.themoviedb.org/settings/api)). Dopo aver incollato la chiave, fai clic sul pulsante **Test** accanto al campo per verificare che funzioni prima della prima sincronizzazione.

→ [Procedura completa per entrambe le chiavi](../SETUP.md)

## 📦 Installazione

<details open>
<summary><b>Obsidian Community Plugins (consigliato)</b></summary>

1. Impostazioni → Community plugins → **Sfoglia**
2. Cerca **Sync Trakt**
3. Clicca **Installa** → **Attiva**

Pagina della directory: https://community.obsidian.md/plugins/sync-trakt

</details>

<details>
<summary><b>Sviluppo (compilare dai sorgenti)</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # produce main.js
npm run lint
npm run test:i18n  # smoke test
```

Quindi copia `main.js`, `manifest.json`, `styles.css` in `<vault>/.obsidian/plugins/sync-trakt/`.

</details>

<details>
<summary><b>Test locale (installazione manuale)</b></summary>

1. Scarica `main.js`, `manifest.json`, `styles.css` dalla [release più recente](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)
2. Posiziona tutti e tre i file in `<tuo-vault>/.obsidian/plugins/sync-trakt/`
3. Impostazioni → Community plugins → attiva **Sync Trakt**

</details>

## 📚 Documentazione

| Documento | Contenuto |
|---|---|
| [SETUP](../SETUP.md) | Creazione chiavi API Trakt + TMDB, configurazione iniziale, risoluzione problemi (inglese) |
| [MANUAL](../MANUAL.md) | Riferimento completo delle impostazioni, campi frontmatter, variabili template (inglese) |
| [DEVELOPER](../DEVELOPER.md) | Architettura, flusso dati, come estendere (solo inglese) |
| [docs/i18n/](.) | Traduzioni del README in 8 lingue aggiuntive |

## 🗺️ Roadmap

Versioni principali dal fork (cronologiche):

- [x] **0.1** — Fork iniziale. Cronologia di visione dettagliata con timestamp per episodio, localizzazione metadati tramite TMDB + catena di fallback Trakt, interfaccia bilingue (en + zh-CN), modelli di nota tradotti (en + zh-CN + zh-TW), id plugin distinto dall'upstream per consentire la coesistenza.
- [x] **0.2** — Sincronizzazione incrementale. Cache TMDB persistente (stale-while-revalidate, TTL di 90 giorni con jitter) + cursore di stato della cronologia Trakt. La sincronizzazione a regime scende da minuti a pochi secondi. → [spec 0001](../specs/0001-incremental-sync.md)
- [x] **0.3** — Scritture differenziali. Riscrive solo le note il cui frontmatter o sezione di corpo gestita è effettivamente cambiato; i livelli di sincronizzazione tra dispositivi smettono di spostare 1200 file per sincronizzazione. La 0.3.x ha anche aggiunto: pulsante Test per la chiave API TMDB + banner di avviso quando la lingua dei metadati è impostata senza chiave, e disambiguazione del nome file a due livelli per le collisioni di titoli localizzati (es. 5 serie tutte chiamate «重生» non si contendono più lo stesso nome di file). → [spec 0002](../specs/0002-diff-based-write.md)
- [x] **0.4** — Preparazione all'invio nella directory. Id plugin rinominato `obsidian-sync-trakt` → `sync-trakt` (il bot della directory Obsidian rifiuta gli id contenenti «obsidian»), `minAppVersion` portato a 1.6.6 e migrazione automatica trasparente dei dati dalla vecchia cartella al primo avvio. → [spec 0004](../specs/0004-obsidian-directory-submission.md)
- [x] **0.5** — Impostazioni locali al dispositivo + pulizia automatica. Interruttore icona cloud per ciascuna impostazione, così ogni impostazione può rinunciare alla sincronizzazione tra dispositivi; pulizia automatica dei file binari della vecchia cartella (mantenendo data.json come rete di sicurezza) per evitare che gli utenti vedano due voci duplicate del plugin nelle loro impostazioni. → [spec 0003](../specs/0003-device-local-settings.md)
- [x] **0.6** — Interfaccia impostazioni a schede + 11 lingue di modelli di nota integrate. Pagina delle impostazioni riorganizzata in 4 schede (Generale / Note / Sync / Daily Notes). Modelli di nota espansi da 3 a 11 lingue curate a mano (+ ja, ko, fr, de, it, es, pt-BR, ru). Menu a discesa della lingua del modello filtrato per mostrare solo le lingue integrate. → [spec 0005](../specs/0005-settings-ui-tabs.md) + [spec 0007](../specs/0007-template-language-expansion.md)
- [x] **0.7** — Integrazione con le Daily Notes. Inserisce automaticamente una riga per evento (visto / watchlist / preferito / valutato) nella tua Daily Note ad ogni sincronizzazione, ordinate cronologicamente, nella lingua del modello scelta. Sicurezza in sola aggiunta per i giorni passati; il giorno corrente viene riscritto man mano che avanza. → [spec 0006](../specs/0006-daily-notes-integration.md)
- [x] **0.8** — **Modalità di sincronizzazione incrementale** per le Daily Notes. Modalità opt-in in cui la regione dei marcatori di oggi è in sola aggiunta (invece di sostituzione completa), così qualsiasi annotazione scritta all'interno sopravvive a ogni sincronizzazione.
- [x] **0.9** — **Ripiego della lingua dei metadati**. Aggiunge un menu a discesa «lingua di ripiego» sotto Lingua dei metadati. Quando impostata, la primaria diventa una corrispondenza rigorosa (niente più sostituzione silenziosa a zh-TW per zh-CN) e ricade sul ripiego scelto dall'utente prima di tornare all'originale in inglese. → [spec 0008](../specs/0008-metadata-language-fallback.md)
- [x] **1.0** — **Rinominazione automatica dei file + modale persistente «Novità» + backfill per intervallo di date**. Modificare la lingua dei metadati ora rinomina automaticamente le note esistenti alla successiva sincronizzazione (i collegamenti interni di Obsidian si aggiornano automaticamente). Ogni nuova release mostra una sola volta una modale «Novità» con la cronologia delle versioni dall'ultima visita. Il backfill manuale è stato sostituito da un selettore di intervallo di date (inizio / fine + preset rapidi). → [spec 0009](../specs/0009-filename-rename.md)
- [x] **1.1** — **Architettura di cache runtime leggera per il vault**. Le grandi cache TMDB e della cronologia dettagliata sono state spostate fuori dal vault, mantenendo `data.json` piccolo per Obsidian Sync e preservando la ricostruzione multi-dispositivo. → [spec 0010](../specs/0010-local-runtime-cache.md)
- [x] **1.2** — **Auto-sync solo Daily Notes**. Le Daily Notes possono aggiornarsi con un proprio intervallo senza scritture di note multimediali, condividendo lo stesso percorso dati Trakt/TMDB e lo stesso lock di sync della sincronizzazione completa. → [spec 0011](../specs/0011-daily-notes-auto-sync.md)
- [ ] **Futuro** — Altre traduzioni UI del plugin (attualmente en + zh-CN) su richiesta; ulteriori lingue di modelli integrate su richiesta.

## 🤝 Ringraziamenti

Questo plugin è stato inizialmente ispirato da [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (licenza MIT), da cui proviene l'impalcatura iniziale per la connessione OAuth a Trakt. Il lavoro sostanziale successivo — aggregazione dettagliata della cronologia di visione, localizzazione dei metadati con catene di fallback di traduzione, interfaccia bilingue, fetching a concorrenza limitata con report di avanzamento in tempo reale, sezioni di corpo gestite dalla macchina, motore di template consapevole delle traduzioni, sistema documentale multilingue — ha rimodellato la maggior parte del codice in un'architettura fondamentalmente diversa.

Grazie a [Sarim Abbas](https://github.com/sarimabbas) per il punto di partenza. L'avviso di copyright MIT dell'opera originale è preservato testualmente in [LICENSE](../../LICENSE) insieme all'avviso di questo progetto.

## 📄 Licenza

MIT — vedi [LICENSE](../../LICENSE).

---

Autore: [o1xhack](https://github.com/o1xhack)
