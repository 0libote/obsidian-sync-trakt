# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**Transformez votre historique de visionnage [Trakt.tv](https://trakt.tv) en une bibliothèque Markdown richement localisée — avec des horodatages par épisode, des métadonnées dans 15+ langues, et une synchronisation incrémentale discrète qui ne fait pas trembler votre vault.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Français** · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ Pourquoi ?

- **Historique de visionnage détaillé** — quel épisode vous avez regardé exactement et quand, y compris les revisionnages, mis à jour à chaque nouvelle session
- **Métadonnées dans 15+ langues** — traduction des titres / synopsis / accroches / genres via TMDB. Préréglages intégrés pour le chinois (CN / TW / HK), le japonais, le coréen, le français, l'allemand, l'espagnol (ES / MX), le portugais (BR), l'italien, le russe — plus un mode personnalisé acceptant tout code de locale BCP-47 pris en charge par TMDB. Les originaux anglais sont toujours préservés dans les champs frontmatter `*_original_*`
- **Synchronisation incrémentale** _(0.2.0)_ — la première synchronisation amorce le cache TMDB local et l'état de l'historique Trakt ; les synchronisations suivantes ne récupèrent que ce qui a changé. Le temps de synchronisation en régime stable passe de quelques minutes à quelques secondes. Voir [spec 0001](../specs/0001-incremental-sync.md)
- **Écritures discrètes** _(0.3.0)_ — la synchronisation ne réécrit que les notes dont le contenu a réellement changé. Après avoir regardé un nouvel épisode, une bibliothèque de 1200 entrées écrit une seule note au lieu des 1200 — votre couche de synchronisation inter-appareils (Obsidian Sync / iCloud / Syncthing) arrête de re-téléverser toute la bibliothèque à chaque tour. Voir [spec 0002](../specs/0002-diff-based-write.md)

## 🎬 Historique de visionnage détaillé

Lorsque **Sync watch history (detailed)** est activé, le plugin interroge l'endpoint `/sync/history` de Trakt et insère les horodatages par épisode (ou par film) directement dans le corps de la note — et garde ce bloc à jour au fil des nouveaux visionnages :

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

Les revisionnages sont listés séparés par des virgules ; les épisodes sont triés par saison puis par numéro d'épisode. Le bloc est entouré de marqueurs `%% trakt:watch-history %%` — le plugin ne met à jour que ce qui se trouve entre les marqueurs, donc **vos notes manuscrites ailleurs dans le corps ne sont jamais touchées**.

<!-- screenshot: watch-history -->

## 🌐 Localisation des métadonnées

Réglez **Metadata language** sur la langue de votre choix : les notes synchronisées obtiennent leur titre, synopsis, accroche et genres traduits via TMDB (avec l'endpoint de traduction de Trakt en repli si aucune clé TMDB n'est configurée). Les originaux anglais restent dans les champs frontmatter `trakt_original_*` :

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

Les tags et chemins tag-note restent toujours en anglais — vos requêtes Dataview existantes continuent de fonctionner sans modification.

<!-- screenshot: metadata-localization -->

## 🌍 Interface du plugin + modèles de notes

La localisation des métadonnées ci-dessus couvre de nombreuses langues ; l'**interface propre au plugin** est un axe distinct et plus modeste. **L'onglet des paramètres, la palette de commandes et les notifications** parlent actuellement **English** et **简体中文**. **Les modèles de notes intégrés** sont fournis en anglais, chinois simplifié (`zh-CN`) et chinois traditionnel (`zh-TW` / `zh-HK`) ; les autres codes de langue de modèle utilisent l'anglais comme repli — personnalisez manuellement pour l'instant, ou [ouvrez une issue](https://github.com/o1xhack/obsidian-sync-trakt/issues) pour demander une traduction intégrée. D'autres langues d'interface seront ajoutées à la demande.

<!-- screenshot: bilingual-ui -->

## 🔄 Synchronisation multi-appareils

L'état d'authentification — tokens Trakt, clé TMDB, tous les paramètres — vit dans `<vault>/.obsidian/plugins/obsidian-sync-trakt/data.json` et suit votre couche de synchronisation de vault. Configurez l'authentification une fois sur Mac, partagez-la avec iPhone via Obsidian Sync (avec `Plugin data` activé), Syncthing, iCloud + Advanced Data Protection, ou Cryptomator. **Le plugin ne stocke rien sur un serveur.**

## 📊 Visualisation dans Obsidian Bases

Le champ frontmatter `trakt_poster_url` fonctionne **prêt à l'emploi** avec [Obsidian Bases](https://help.obsidian.md/bases) (Obsidian 1.9.3+) — créez une vue base de données sur votre dossier de synchronisation et les affiches s'affichent en miniatures :

- **Vue cartes** : ouvrez les paramètres Display → définissez **Image property** sur `trakt_poster_url`
- **Vue tableau** (1.9.4+) : ajoutez une colonne formule avec `image(note.trakt_poster_url)`

Filtrer par `trakt_type = "movie"` / `"show"`, trier par `trakt_year` / `trakt_rating` / `trakt_my_rating`, grouper par `trakt_genres` — toutes possibilités. Les propriétés frontmatter qui alimentent les requêtes Dataview alimentent aussi les vues Bases — aucune configuration supplémentaire.

## 🚀 Démarrage rapide

1. Installez via [BRAT](https://github.com/TfTHacker/obsidian42-brat) → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. Paramètres → **Obsidian Sync Trakt** → entrez vos clés API Trakt + TMDB ([guide SETUP](../SETUP.md))
3. Palette de commandes → **Traktr: Sync**

## 🔑 Clés API : ce que chacune déverrouille

Le plugin utilise deux API. **Trakt est obligatoire** — sans elle, le plugin ne peut rien synchroniser. **TMDB est optionnelle** mais déverrouille la majorité de ce qui rend le plugin intéressant. Détails :

| Fonctionnalité | API Trakt<br/>_(requise)_ | API TMDB<br/>_(recommandée)_ |
|---|:---:|:---:|
| Synchroniser votre bibliothèque Trakt (watchlist, watched, favorites, ratings) | ✅ | — |
| Horodatages de visionnage par épisode | ✅ | — |
| Titre / synopsis / accroche dans votre langue | ✅ basique | ✅ qualité supérieure |
| **Genres dans votre langue** | ❌ | ✅ |
| **Images d'affiches intégrées aux notes** | ❌ | ✅ |

Si vous vous contentez du contenu en anglais et ne voulez pas d'affiches, laissez TMDB vide — Trakt seul suffit. Pour une localisation complète non-anglaise (incluant genres et affiches), **ajoutez une clé TMDB** ([inscription gratuite](https://www.themoviedb.org/settings/api)). Après avoir collé votre clé, cliquez sur le bouton **Test** à côté du champ pour vérifier qu'elle fonctionne avant votre première synchronisation.

→ [Procédure complète pour les deux clés](../SETUP.md)

## 📦 Installation

<details>
<summary><b>BRAT (recommandé)</b></summary>

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installe et met à jour automatiquement les plugins depuis n'importe quel dépôt GitHub.

1. Installez **Obsidian42 - BRAT** depuis Community Plugins
2. Paramètres → BRAT → **Add a beta plugin for testing**
3. Collez :
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. **Add Plugin** → activez dans Paramètres → Community plugins

BRAT vérifiera les mises à jour à chaque lancement d'Obsidian et récupérera automatiquement les nouveaux releases.

</details>

<details>
<summary><b>Manuel</b></summary>

1. Téléchargez `main.js`, `manifest.json`, `styles.css` depuis le [dernier release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)
2. Placez les trois fichiers dans `<votre-vault>/.obsidian/plugins/obsidian-sync-trakt/`
3. Paramètres → Community plugins → activez **Obsidian Sync Trakt**

</details>

<details>
<summary><b>Obsidian Community Plugins (en attente)</b></summary>

> ⚠️ Pas encore listé dans le répertoire officiel des Community Plugins d'Obsidian. Une fois accepté, ce sera le chemin recommandé. En attendant, utilisez BRAT ci-dessus.

</details>

<details>
<summary><b>Compiler depuis les sources</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # produit main.js
npm run lint
npm run test:i18n  # tests d'intégration
```

Puis copiez `main.js`, `manifest.json`, `styles.css` dans `<vault>/.obsidian/plugins/obsidian-sync-trakt/`.

</details>

## 📚 Documentation

| Document | Contenu |
|---|---|
| [SETUP](../SETUP.md) | Création des clés API Trakt + TMDB, configuration initiale, dépannage (anglais) |
| [MANUAL](../MANUAL.md) | Référence complète des paramètres, champs frontmatter, variables de modèle (anglais) |
| [DEVELOPER](../DEVELOPER.md) | Architecture, flux de données, comment étendre (anglais uniquement) |
| [docs/i18n/](.) | Traductions du README en 8 langues supplémentaires |

## 🗺️ Feuille de route

- [x] Synchronisation détaillée de l'historique par épisode
- [x] Localisation des métadonnées sur 15+ langues préréglées + tout code de locale pris en charge par TMDB via le mode personnalisé
- [x] Interface bilingue (en + zh-CN) ; d'autres langues à la demande
- [x] Modèles de notes par défaut traduits (en + zh-CN + zh-TW)
- [x] Cache de métadonnées TMDB (0.2.0) — éviter de re-télécharger lors d'un changement de langue, synchro stable en quelques secondes
- [x] Récupération incrémentale de l'historique Trakt (0.2.0) — ne récupère que les nouveaux événements depuis la dernière synchro
- [x] Écritures différentielles (0.3.0) — ne réécrit que les notes réellement modifiées, plus de tempête de synchro inter-appareils
- [ ] Soumission au répertoire Community Plugins d'Obsidian
- [ ] Plus de traductions UI (ja / ko / fr / ...) selon la demande

## 🤝 Remerciements

Ce plugin s'est initialement inspiré de [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (licence MIT), dont est issu le squelette initial pour la connexion OAuth à Trakt. Un travail substantiel ultérieur — agrégation détaillée de l'historique de visionnage, localisation des métadonnées avec chaînes de repli de traduction, interface bilingue, récupération concurrente bornée avec rapport de progression en direct, sections de corps gérées par la machine, moteur de templates conscient des traductions, système documentaire multilingue — a remodelé la majeure partie du code source en une architecture fondamentalement différente.

Merci à [Sarim Abbas](https://github.com/sarimabbas) pour le point de départ. L'avis de copyright MIT de l'œuvre originale est préservé textuellement dans [LICENSE](../../LICENSE) aux côtés de celui de ce projet.

## 📄 Licence

MIT — voir [LICENSE](../../LICENSE).

---

Auteur : [o1xhack](https://github.com/o1xhack)
