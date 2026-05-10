# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**Convierte tu historial de visualización de [Trakt.tv](https://trakt.tv) en una biblioteca Markdown ricamente localizada — con marcas de tiempo por episodio, metadatos en tu idioma y una interfaz bilingüe.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Español** · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ ¿Por qué?

- **Historial de visualización detallado** — exactamente qué episodio viste y cuándo, incluyendo revisualizaciones, sincronizado mientras sigues viendo
- **Metadatos localizados** — traduce títulos / sinopsis / lemas / géneros vía TMDB; los originales en inglés siempre se preservan a su lado
- **Interfaz bilingüe** — ajustes, comandos y notificaciones en English o 简体中文; plantillas de notas integradas en en / zh-CN / zh-TW

## 🎬 Historial de visualización detallado

Cuando **Sync watch history (detailed)** está activado, el plugin consulta el endpoint `/sync/history` de Trakt e inserta marcas de tiempo por episodio (o por película) directamente en el cuerpo de la nota — y mantiene ese bloque actualizado a medida que ves nuevos episodios:

```markdown
## Watch History
- S1E1 — 2024-01-15 21:30, 2024-03-22 19:00
- S1E2 — 2024-01-16 22:00
- S1E3 — 2024-01-17 21:45
- S2E1 — 2024-04-02 20:00
```

Las revisualizaciones se listan separadas por comas; los episodios se ordenan por temporada y luego por número de episodio. El bloque está envuelto en marcadores `%% trakt:watch-history %%` — el plugin solo actualiza lo que está entre los marcadores, así que **las notas escritas a mano en otras partes del cuerpo nunca se modifican**.

<!-- screenshot: watch-history -->

## 🌐 Localización de metadatos

Configura **Metadata language** a tu idioma preferido y las notas sincronizadas obtendrán título, sinopsis, lema y géneros traducidos vía TMDB (con el endpoint de traducción de Trakt como respaldo cuando no hay clave TMDB configurada). Los originales en inglés permanecen en los campos frontmatter `trakt_original_*`:

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

Las etiquetas y rutas tag-note siempre permanecen en inglés — tus consultas Dataview existentes siguen funcionando sin cambios.

<!-- screenshot: metadata-localization -->

## 🌍 Interfaz bilingüe + plantillas traducidas

La pestaña de ajustes, la paleta de comandos y los popups de notificación hablan tanto **English** como **简体中文**. Las plantillas de notas integradas vienen en inglés, chino simplificado (`zh-CN`) y chino tradicional (`zh-TW` / `zh-HK`); otros códigos de idioma usan la plantilla en inglés como respaldo — personaliza manualmente si quieres otro idioma.

<!-- screenshot: bilingual-ui -->

## 🔄 Sincronización entre dispositivos

El estado de autenticación — tokens Trakt, clave TMDB, todos los ajustes — vive en `<vault>/.obsidian/plugins/obsidian-sync-trakt/data.json` y sigue tu capa de sincronización del vault. Configura la autenticación una vez en Mac, compártela con iPhone vía Obsidian Sync (con `Plugin data` activado), Syncthing, iCloud + Advanced Data Protection, o Cryptomator. **El plugin no almacena nada en ningún servidor.**

## 🚀 Inicio rápido

1. Instala vía [BRAT](https://github.com/TfTHacker/obsidian42-brat) → **Add a beta plugin for testing** → `o1xhack/obsidian-sync-trakt`
2. Ajustes → **Obsidian Sync Trakt** → introduce tus claves API de Trakt + TMDB ([guía SETUP](../SETUP.md))
3. Paleta de comandos → **Traktr: Sync**

## 📦 Instalación

<details>
<summary><b>BRAT (recomendado)</b></summary>

[BRAT](https://github.com/TfTHacker/obsidian42-brat) instala y actualiza automáticamente plugins desde cualquier repositorio de GitHub.

1. Instala **Obsidian42 - BRAT** desde Community Plugins
2. Ajustes → BRAT → **Add a beta plugin for testing**
3. Pega:
   ```
   o1xhack/obsidian-sync-trakt
   ```
4. **Add Plugin** → activa en Ajustes → Community plugins

BRAT comprobará actualizaciones cada vez que se inicie Obsidian y descargará nuevos releases automáticamente.

</details>

<details>
<summary><b>Manual</b></summary>

1. Descarga `main.js`, `manifest.json`, `styles.css` desde el [release más reciente](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)
2. Coloca los tres archivos en `<tu-vault>/.obsidian/plugins/obsidian-sync-trakt/`
3. Ajustes → Community plugins → activa **Obsidian Sync Trakt**

</details>

<details>
<summary><b>Obsidian Community Plugins (pendiente)</b></summary>

> ⚠️ Aún no listado en el directorio oficial de Community Plugins de Obsidian. Una vez aceptado, esta será la ruta recomendada. Mientras tanto, usa BRAT arriba.

</details>

<details>
<summary><b>Construir desde el código fuente</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # produce main.js
npm run lint
npm run test:i18n  # pruebas de humo
```

Luego copia `main.js`, `manifest.json`, `styles.css` a `<vault>/.obsidian/plugins/obsidian-sync-trakt/`.

</details>

## 📚 Documentación

| Documento | Contenido |
|---|---|
| [SETUP](../SETUP.md) | Creación de claves API Trakt + TMDB, configuración inicial, resolución de problemas (inglés) |
| [MANUAL](../MANUAL.md) | Referencia completa de ajustes, campos frontmatter, variables de plantilla (inglés) |
| [DEVELOPER](../DEVELOPER.md) | Arquitectura, flujo de datos, cómo extender (solo inglés) |
| [docs/i18n/](.) | Traducciones del README en 8 idiomas adicionales |

## 🗺️ Hoja de ruta

- [x] Sincronización detallada de historial por episodio
- [x] Localización de metadatos (TMDB + respaldo de traducciones Trakt)
- [x] Interfaz bilingüe del plugin (en + zh-CN)
- [x] Plantillas de notas predeterminadas traducidas (en + zh-CN + zh-TW)
- [ ] Caché de metadatos TMDB — evitar re-descargas al cambiar de idioma
- [ ] Envío al directorio de Community Plugins de Obsidian
- [ ] Más traducciones de UI (ja / ko / fr / ...) según demanda

## 🤝 Upstream

Este plugin es un fork de [**sarimabbas/traktr**](https://github.com/sarimabbas/traktr) (licencia MIT). El motor de sincronización principal, la estructura frontmatter / plantilla, y el sistema tag-note se heredan directamente de ese proyecto. Gracias profundas a [Sarim Abbas](https://github.com/sarimabbas) por el trabajo original.

## 📄 Licencia

MIT — ver [LICENSE](../../LICENSE). Tanto el copyright upstream (Sarim Abbas) como el copyright de este fork (o1xhack) aplican.

---

Autor: [o1xhack](https://github.com/o1xhack)
