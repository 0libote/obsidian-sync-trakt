# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**Transformez votre historique de visionnage [Trakt.tv](https://trakt.tv) en une bibliothèque Markdown richement localisée — avec des horodatages par épisode, des métadonnées dans votre langue et une interface bilingue.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Français** · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ Pourquoi ?

- **Historique de visionnage détaillé** — quel épisode vous avez regardé exactement et quand, y compris les revisionnages, mis à jour à chaque nouvelle session
- **Métadonnées localisées** — traduction des titres / synopsis / accroches / genres via TMDB ; les originaux anglais sont toujours préservés à côté
- **Interface bilingue** — paramètres, commandes et notifications en English ou 简体中文 ; modèles de notes intégrés en en / zh-CN / zh-TW

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

## 🌍 Interface bilingue + modèles traduits

L'onglet des paramètres, la palette de commandes et les notifications parlent **English** et **简体中文**. Les modèles de notes intégrés sont disponibles en anglais, chinois simplifié (`zh-CN`) et chinois traditionnel (`zh-TW` / `zh-HK`) ; les autres codes linguistiques utilisent le modèle anglais comme repli — personnalisez manuellement si vous voulez une autre langue.

<!-- screenshot: bilingual-ui -->

## 🔄 Synchronisation multi-appareils

L'état d'authentification — tokens Trakt, clé TMDB, tous les paramètres — vit dans `<vault>/.obsidian/plugins/obsidian-sync-trakt/data.json` et suit votre couche de synchronisation de vault. Configurez l'authentification une fois sur Mac, partagez-la avec iPhone via Obsidian Sync (avec `Plugin data` activé), Syncthing, iCloud + Advanced Data Protection, ou Cryptomator. **Le plugin ne stocke rien sur un serveur.**

## 🚀 Démarrage rapide

1. Installez via [BRAT](https://github.com/TfTHacker/obsidian42-brat) → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. Paramètres → **Obsidian Sync Trakt** → entrez vos clés API Trakt + TMDB ([guide SETUP](../SETUP.md))
3. Palette de commandes → **Traktr: Sync**

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
- [x] Localisation des métadonnées (TMDB + repli traductions Trakt)
- [x] Interface bilingue (en + zh-CN)
- [x] Modèles de notes par défaut traduits (en + zh-CN + zh-TW)
- [ ] Cache de métadonnées TMDB — éviter de re-télécharger lors d'un changement de langue
- [ ] Soumission au répertoire Community Plugins d'Obsidian
- [ ] Plus de traductions UI (ja / ko / fr / ...) selon la demande

## 🤝 Amont

Ce plugin est un fork de [**sarimabbas/traktr**](https://github.com/sarimabbas/traktr) (licence MIT). Le moteur de synchronisation principal, la structure frontmatter / modèles, et le système tag-note sont tous directement hérités de ce projet. Merci beaucoup à [Sarim Abbas](https://github.com/sarimabbas) pour le travail original.

## 📄 Licence

MIT — voir [LICENSE](../../LICENSE). Le copyright amont (Sarim Abbas) et celui de ce fork (o1xhack) s'appliquent tous deux.

---

Auteur : [o1xhack](https://github.com/o1xhack)
