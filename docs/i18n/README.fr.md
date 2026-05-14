# Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.8.7%2B-7c3aed)](https://obsidian.md)

**Transformez votre historique de visionnage [Trakt.tv](https://trakt.tv) en une bibliothèque Markdown richement localisée — avec des horodatages par épisode, des métadonnées dans 15+ langues, et une synchronisation incrémentale discrète qui ne fait pas trembler votre vault.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Français** · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ Pourquoi ?

- **Historique de visionnage détaillé** — quel épisode vous avez regardé exactement et quand, y compris les revisionnages, mis à jour à chaque nouvelle session
- **Métadonnées dans 15+ langues** — traduction des titres / synopsis / accroches / genres via TMDB. Préréglages intégrés pour le chinois (CN / TW / HK), le japonais, le coréen, le français, l'allemand, l'espagnol (ES / MX), le portugais (BR), l'italien, le russe — plus un mode personnalisé acceptant toute locale prise en charge par TMDB. **Langue primaire stricte + repli défini par l'utilisateur** (p. ex. zh-CN avec repli anglais) — empêche les substitutions silencieuses en zh-TW lorsque la traduction primaire est absente. Les originaux anglais sont toujours préservés dans les champs frontmatter `*_original_*`
- **Les noms de fichiers suivent votre langue** — changez la langue des métadonnées et les notes existantes sont automatiquement renommées lors de la synchronisation suivante pour correspondre au nouveau titre. Les liens internes Obsidian sont mis à jour automatiquement. Bouton ponctuel « Renommer maintenant » dans les paramètres pour les déclenchements manuels
- **Modèles de notes en 11 langues** — modèles intégrés faits main (en + zh-CN + zh-TW + ja + ko + fr + de + it + es + pt-BR + ru). Choisissez dans la liste déroulante de langue de modèle ; changez à tout moment sans perdre vos personnalisations
- **Interface des paramètres en onglets** — Général / Notes / Synchro / Daily Notes. Le dernier onglet consulté est mémorisé par appareil
- **Intégration Daily Notes** — injecte automatiquement une ligne par événement dans votre Daily Note à chaque synchronisation (vu / ajouté à la watchlist / favori / noté), triées chronologiquement, dans la langue de modèle choisie. La zone délimitée par marqueurs est totalement isolée — le contenu en dehors n'est jamais modifié. Un **mode incrémental** optionnel préserve les annotations que vous écrivez à l'intérieur du bloc de marqueurs. Backfill manuel par sélecteur de plage de dates avec préréglages rapides (7 derniers jours / Ce mois-ci / etc.). Voir [spec 0006](../specs/0006-daily-notes-integration.md)
- **Synchronisation incrémentale rapide** — la première synchronisation amorce le cache TMDB local et l'état de l'historique Trakt ; les synchronisations suivantes ne récupèrent que ce qui a changé. Le temps de synchronisation en régime stable passe de quelques minutes à quelques secondes. Voir [spec 0001](../specs/0001-incremental-sync.md)
- **Écritures discrètes** — la synchronisation ne réécrit que les notes dont le contenu a réellement changé. Après avoir regardé un nouvel épisode, une bibliothèque de 1200 entrées écrit une seule note au lieu des 1200 — votre couche de synchronisation inter-appareils (Obsidian Sync / iCloud / Syncthing) arrête de re-téléverser toute la bibliothèque à chaque tour. Voir [spec 0002](../specs/0002-diff-based-write.md)
- **Interrupteur cloud par paramètre** — choisissez quels paramètres se synchronisent entre appareils et lesquels restent locaux. Intervalle d'auto-sync, démarrage automatique, langue de l'interface — chacun peut rester local pour que votre Mac et votre iPhone ne se disputent pas. Voir [spec 0003](../specs/0003-device-local-settings.md)

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

La localisation des métadonnées ci-dessus est un axe ; les surfaces propres au plugin en sont d'autres :

- **L'onglet des paramètres, la palette de commandes et les notifications** parlent **English** et **简体中文**. D'autres langues d'interface à la demande — [ouvrez une issue](https://github.com/o1xhack/obsidian-sync-trakt/issues) si vous souhaitez en proposer une.
- **Modèles de notes intégrés** dans 11 langues — anglais, chinois simplifié (zh-CN), chinois traditionnel (zh-TW / zh-HK), japonais, coréen, français, allemand, italien, espagnol, portugais (BR), russe. Faits main, pas traduits machine ; titres de section, libellés de listes et ponctuation suivent les conventions de chaque langue (deux-points pleine chasse en japonais, deux-points espacés en français, etc.). La liste déroulante de langue de modèle ne propose que ces 11 langues ; les locales hors liste retombent sur l'anglais (plutôt que de choisir silencieusement une locale sœur).

<!-- screenshot: bilingual-ui -->

## 📅 Intégration Daily Notes

Insère automatiquement une ligne par événement dans votre Daily Note à chaque synchronisation — triées chronologiquement, dans la langue de modèle choisie. Couvre les épisodes vus, les ajouts à la watchlist, les favoris et les notes :

```markdown
%% trakt:daily:start %%
10:00 — a regardé Low-IQ Crime (2026) S1E16, S1E17
14:30 — ajouté à la watchlist The Dark Knight (2008)
21:30 — noté 9/10 Reborn (2020)
%% trakt:daily:end %%
```

Chaque type d'événement est conditionné par son interrupteur de source de synchro — si `Sync favorites` est désactivé, les événements de favoris n'apparaîtront pas non plus dans les Daily Notes. Les verbes (`watched` / `看了` / `視聴` / `시청` / `a regardé`…) suivent votre paramètre de **langue de modèle** sur les 11 langues intégrées.

**Contrat de sécurité** : la zone délimitée par les marqueurs est totalement isolée — le contenu en dehors n'est **jamais modifié**. Les jours passés sont en ajout seul par défaut (marqueurs existants préservés) ; le jour actuel est réécrit pour que les événements récents apparaissent lors des synchros suivantes. Un **mode incrémental** optionnel change aussi le comportement du jour en ajout seul, de sorte que toute annotation écrite à l'intérieur du bloc de marqueurs survit à chaque synchronisation.

**Backfill manuel** par sélecteur de plage de dates avec préréglages rapides (7 derniers jours / 30 derniers jours / Ce mois-ci / Mois dernier). Un compteur en direct indique combien de Daily Notes existent réellement dans la plage choisie avant que vous ne confirmiez. Configurez le dossier + le format de nom de fichier (syntaxe Moment.js comme `YYYY-MM-DD` ou `YYYY/YYYY.MM.DD`) dans **Paramètres → Daily Notes**. Voir [spec 0006](../specs/0006-daily-notes-integration.md).

## 🔄 Synchronisation multi-appareils

L'état d'authentification — tokens Trakt, clé TMDB, tous les paramètres — vit dans `<vault>/.obsidian/plugins/sync-trakt/data.json` et suit votre couche de synchronisation de vault. Configurez l'authentification une fois sur Mac, partagez-la avec iPhone via Obsidian Sync (avec `Plugin data` activé), Syncthing, iCloud + Advanced Data Protection, ou Cryptomator. Le plugin ne stocke rien sur un serveur.

**Chaque paramètre peut individuellement se désinscrire de la synchronisation inter-appareils** via une petite icône cloud à côté de lui (actuellement exposée pour `Sync on startup` / `Auto-sync` / `Auto-sync interval` / `Plugin UI language`). Utile par exemple si vous voulez l'auto-sync toutes les 30 min sur Mac mais jamais sur iPhone.

## 📊 Visualisation dans Obsidian Bases

Le champ frontmatter `trakt_poster_url` fonctionne **prêt à l'emploi** avec [Obsidian Bases](https://help.obsidian.md/bases) (Obsidian 1.9.3+) — créez une vue base de données sur votre dossier de synchronisation et les affiches s'affichent en miniatures :

- **Vue cartes** : ouvrez les paramètres Display → définissez **Image property** sur `trakt_poster_url`
- **Vue tableau** (1.9.4+) : ajoutez une colonne formule avec `image(note.trakt_poster_url)`

Filtrer par `trakt_type = "movie"` / `"show"`, trier par `trakt_year` / `trakt_rating` / `trakt_my_rating`, grouper par `trakt_genres` — toutes possibilités. Les propriétés frontmatter qui alimentent les requêtes Dataview alimentent aussi les vues Bases — aucune configuration supplémentaire.

## 🚀 Démarrage rapide

1. Paramètres → Community plugins → **Parcourir** → recherchez **Sync Trakt** → **Installer** → **Activer**
2. Paramètres → **Sync Trakt** → entrez vos clés API Trakt + TMDB ([guide SETUP](../SETUP.md))
3. Palette de commandes → **Sync Trakt: Sync**

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

<details open>
<summary><b>Obsidian Community Plugins (recommandé)</b></summary>

1. Paramètres → Community plugins → **Parcourir**
2. Recherchez **Sync Trakt**
3. Cliquez sur **Installer** → **Activer**

Page du répertoire : https://community.obsidian.md/plugins/sync-trakt

</details>

<details>
<summary><b>Développement (compiler depuis les sources)</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # produit main.js
npm run lint
npm run test:i18n  # tests d'intégration
```

Puis copiez `main.js`, `manifest.json`, `styles.css` dans `<vault>/.obsidian/plugins/sync-trakt/`.

</details>

<details>
<summary><b>Test local (installation manuelle)</b></summary>

1. Téléchargez `main.js`, `manifest.json`, `styles.css` depuis le [dernier release](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)
2. Placez les trois fichiers dans `<votre-vault>/.obsidian/plugins/sync-trakt/`
3. Paramètres → Community plugins → activez **Sync Trakt**

</details>

## 📚 Documentation

| Document | Contenu |
|---|---|
| [SETUP](../SETUP.md) | Création des clés API Trakt + TMDB, configuration initiale, dépannage (anglais) |
| [MANUAL](../MANUAL.md) | Référence complète des paramètres, champs frontmatter, variables de modèle (anglais) |
| [DEVELOPER](../DEVELOPER.md) | Architecture, flux de données, comment étendre (anglais uniquement) |
| [docs/i18n/](.) | Traductions du README en 8 langues supplémentaires |

## 🗺️ Feuille de route

Versions majeures depuis le fork (chronologique) :

- [x] **0.1** — Fork initial. Historique de visionnage détaillé avec horodatages par épisode, localisation des métadonnées via TMDB + chaîne de repli Trakt, interface bilingue (en + zh-CN), modèles de notes traduits (en + zh-CN + zh-TW), id de plugin distinct de l'upstream pour coexistence.
- [x] **0.2** — Synchronisation incrémentale. Cache TMDB persistant (stale-while-revalidate, TTL de 90 jours avec jitter) + curseur d'état d'historique Trakt. Synchro stable passant de minutes à quelques secondes. → [spec 0001](../specs/0001-incremental-sync.md)
- [x] **0.3** — Écritures différentielles. Ne réécrit que les notes dont le frontmatter ou la section de corps gérée a réellement changé ; les couches de synchro inter-appareils cessent de brasser 1200 fichiers par synchro. 0.3.x a aussi ajouté : bouton Test pour la clé TMDB + bannière d'alerte quand la langue de métadonnées est définie sans clé, et désambiguïsation à deux niveaux des noms de fichiers pour les collisions de titres localisés (par ex. 5 séries toutes nommées « 重生 » ne se battent plus pour le même nom de fichier). → [spec 0002](../specs/0002-diff-based-write.md)
- [x] **0.4** — Préparation à la soumission au répertoire. Id de plugin renommé `obsidian-sync-trakt` → `sync-trakt` (le bot du répertoire Obsidian rejette les ids contenant « obsidian »), `minAppVersion` resserré à 1.6.6, et migration automatique transparente des données depuis l'ancien dossier au premier lancement. → [spec 0004](../specs/0004-obsidian-directory-submission.md)
- [x] **0.5** — Paramètres locaux à l'appareil + nettoyage automatique. Interrupteur cloud par paramètre pour que chaque paramètre puisse se désinscrire de la synchro inter-appareils ; nettoyage automatique des fichiers binaires de l'ancien dossier (en gardant data.json comme filet de sécurité) pour que les utilisateurs ne voient pas deux entrées de plugin en double dans leurs paramètres. → [spec 0003](../specs/0003-device-local-settings.md)
- [x] **0.6** — Interface des paramètres en onglets + 11 langues de modèles de notes intégrées. Page des paramètres réorganisée en 4 onglets (Général / Notes / Synchro / Daily Notes). Modèles de notes passés de 3 à 11 langues faites main (+ ja, ko, fr, de, it, es, pt-BR, ru). Liste déroulante de langue de modèle filtrée pour ne montrer que les langues intégrées. → [spec 0005](../specs/0005-settings-ui-tabs.md) + [spec 0007](../specs/0007-template-language-expansion.md)
- [x] **0.7** — Intégration Daily Notes. Insère automatiquement une ligne par événement (vu / watchlist / favori / noté) dans votre Daily Note à chaque synchronisation, triées chronologiquement, dans la langue de modèle choisie. Sécurité en ajout seul pour les jours passés ; le jour actuel est réécrit au fil de la journée. → [spec 0006](../specs/0006-daily-notes-integration.md)
- [x] **0.8** — **Mode de synchronisation incrémentale** pour les Daily Notes. Mode opt-in où la zone des marqueurs du jour est en ajout seul (au lieu d'un remplacement complet), ce qui fait que toute annotation écrite à l'intérieur survit à chaque synchronisation.
- [x] **0.9** — **Repli de langue des métadonnées**. Ajoute une liste déroulante « langue de repli » sous Langue des métadonnées. Une fois définie, la langue primaire devient une correspondance stricte (plus de substitution silencieuse en zh-TW pour zh-CN) et passe par le repli choisi par l'utilisateur avant de retomber sur l'original anglais. → [spec 0008](../specs/0008-metadata-language-fallback.md)
- [x] **1.0** — **Renommage automatique des fichiers + modale « Quoi de neuf » persistante + backfill par plage de dates**. Changer la langue des métadonnées renomme désormais automatiquement les notes existantes lors de la synchronisation suivante (les liens internes Obsidian se mettent à jour automatiquement). Chaque nouvelle release affiche une fois une modale « Quoi de neuf » montrant l'historique des versions depuis votre dernière visite. Le backfill manuel a été remplacé par un sélecteur de plage de dates (début / fin + préréglages rapides). → [spec 0009](../specs/0009-filename-rename.md)
- [ ] **À venir** — Plus de traductions d'interface (actuellement en + zh-CN) à la demande ; langues de modèles intégrées supplémentaires sur demande.

## 🤝 Remerciements

Ce plugin s'est initialement inspiré de [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (licence MIT), dont est issu le squelette initial pour la connexion OAuth à Trakt. Un travail substantiel ultérieur — agrégation détaillée de l'historique de visionnage, localisation des métadonnées avec chaînes de repli de traduction, interface bilingue, récupération concurrente bornée avec rapport de progression en direct, sections de corps gérées par la machine, moteur de templates conscient des traductions, système documentaire multilingue — a remodelé la majeure partie du code source en une architecture fondamentalement différente.

Merci à [Sarim Abbas](https://github.com/sarimabbas) pour le point de départ. L'avis de copyright MIT de l'œuvre originale est préservé textuellement dans [LICENSE](../../LICENSE) aux côtés de celui de ce projet.

## 📄 Licence

MIT — voir [LICENSE](../../LICENSE).

---

Auteur : [o1xhack](https://github.com/o1xhack)
