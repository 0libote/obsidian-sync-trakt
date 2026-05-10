# Obsidian Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.4.0%2B-7c3aed)](https://obsidian.md)

**Convierte tu historial de visualización de [Trakt.tv](https://trakt.tv) en una biblioteca Markdown ricamente localizada — con marcas de tiempo por episodio, metadatos en más de 15 idiomas y una sincronización incremental silenciosa que no agita tu vault.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Español** · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ ¿Por qué?

- **Historial de visualización detallado** — exactamente qué episodio viste y cuándo, incluyendo revisualizaciones, sincronizado mientras sigues viendo
- **Metadatos en más de 15 idiomas** — traduce títulos / sinopsis / lemas / géneros vía TMDB. Predefinidos integrados para chino (CN / TW / HK), japonés, coreano, francés, alemán, español (ES / MX), portugués (BR), italiano, ruso — más un modo personalizado que acepta cualquier código de localización BCP-47 admitido por TMDB. Los originales en inglés siempre se preservan en los campos frontmatter `*_original_*`
- **Sincronización incremental** _(0.2.0)_ — la primera sincronización siembra la caché TMDB local y el estado del historial Trakt; las sincronizaciones posteriores solo obtienen lo que cambió. El tiempo de sincronización en estado estable cae de minutos a segundos. Ver [spec 0001](../specs/0001-incremental-sync.md)
- **Escrituras silenciosas** _(0.3.0)_ — la sincronización solo reescribe las notas cuyo contenido realmente cambió. Tras ver un episodio nuevo, una biblioteca de 1200 entradas escribe una nota en lugar de las 1200 — tu capa de sincronización entre dispositivos (Obsidian Sync / iCloud / Syncthing) deja de re-subir la biblioteca entera en cada ejecución. Ver [spec 0002](../specs/0002-diff-based-write.md)

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

## 🌍 Interfaz del plugin + plantillas de notas

La localización de metadatos arriba cubre muchos idiomas; la **interfaz propia del plugin** es un eje separado y más pequeño. **La pestaña de ajustes, la paleta de comandos y los popups de notificación** actualmente hablan **English** y **简体中文**. **Las plantillas de notas integradas** vienen en inglés, chino simplificado (`zh-CN`) y chino tradicional (`zh-TW` / `zh-HK`); otros códigos de idioma de plantilla usan la plantilla en inglés como respaldo — personaliza manualmente por ahora, o [abre un issue](https://github.com/o1xhack/obsidian-sync-trakt/issues) para solicitar una traducción integrada. Más idiomas de interfaz bajo demanda.

<!-- screenshot: bilingual-ui -->

## 🔄 Sincronización entre dispositivos

El estado de autenticación — tokens Trakt, clave TMDB, todos los ajustes — vive en `<vault>/.obsidian/plugins/obsidian-sync-trakt/data.json` y sigue tu capa de sincronización del vault. Configura la autenticación una vez en Mac, compártela con iPhone vía Obsidian Sync (con `Plugin data` activado), Syncthing, iCloud + Advanced Data Protection, o Cryptomator. **El plugin no almacena nada en ningún servidor.**

## 📊 Visualización en Obsidian Bases

El campo frontmatter `trakt_poster_url` funciona **listo para usar** con [Obsidian Bases](https://help.obsidian.md/bases) (Obsidian 1.9.3+) — crea una vista de base de datos sobre tu carpeta de sincronización y los pósters se mostrarán como miniaturas:

- **Vista de tarjetas**: abre los ajustes Display → configura **Image property** como `trakt_poster_url`
- **Vista de tabla** (1.9.4+): añade una columna fórmula con `image(note.trakt_poster_url)`

Filtra por `trakt_type = "movie"` / `"show"`, ordena por `trakt_year` / `trakt_rating` / `trakt_my_rating`, agrupa por `trakt_genres` — todo posible. Las propiedades frontmatter que alimentan consultas Dataview también alimentan vistas Bases — sin configuración adicional.

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
- [x] Localización de metadatos en más de 15 idiomas predefinidos + cualquier código de localización admitido por TMDB vía modo personalizado
- [x] Interfaz bilingüe del plugin (en + zh-CN); más idiomas bajo demanda
- [x] Plantillas de notas predeterminadas traducidas (en + zh-CN + zh-TW)
- [x] Caché de metadatos TMDB (0.2.0) — evitar re-descargas al cambiar de idioma, sincronización estable en segundos
- [x] Obtención incremental del historial Trakt (0.2.0) — solo recupera nuevos eventos de visualización desde la última sincronización
- [x] Escrituras diferenciales (0.3.0) — solo reescribe notas realmente modificadas, sin tormenta de sincronización entre dispositivos
- [ ] Envío al directorio de Community Plugins de Obsidian
- [ ] Más traducciones de UI (ja / ko / fr / ...) según demanda

## 🤝 Agradecimientos

Este plugin se inspiró originalmente en [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (licencia MIT), del cual proviene el andamiaje inicial para la conexión OAuth a Trakt. El trabajo sustancial posterior — agregación detallada de historial de visualización, localización de metadatos con cadenas de respaldo de traducción, interfaz bilingüe, fetching con concurrencia limitada e informe de progreso en vivo, secciones de cuerpo gestionadas por máquina, motor de plantillas con conocimiento de traducciones, sistema de documentación multilingüe — ha remodelado la mayor parte de la base de código en una arquitectura fundamentalmente diferente.

Gracias a [Sarim Abbas](https://github.com/sarimabbas) por el punto de partida. El aviso de copyright MIT del trabajo original se conserva textualmente en [LICENSE](../../LICENSE) junto con el aviso propio de este proyecto.

## 📄 Licencia

MIT — ver [LICENSE](../../LICENSE).

---

Autor: [o1xhack](https://github.com/o1xhack)
