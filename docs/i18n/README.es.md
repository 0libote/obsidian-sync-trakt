# Sync Trakt

[![Latest release](https://img.shields.io/github/v/release/o1xhack/obsidian-sync-trakt?include_prereleases&label=release&color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![Total downloads](https://img.shields.io/github/downloads/o1xhack/obsidian-sync-trakt/total?color=7c3aed)](https://github.com/o1xhack/obsidian-sync-trakt/releases)
[![License](https://img.shields.io/github/license/o1xhack/obsidian-sync-trakt?color=7c3aed)](../../LICENSE)
[![Min Obsidian version](https://img.shields.io/badge/obsidian-1.8.7%2B-7c3aed)](https://obsidian.md)

**Convierte tu historial de visualización de [Trakt.tv](https://trakt.tv) en una biblioteca Markdown ricamente localizada — con marcas de tiempo por episodio, metadatos en más de 15 idiomas y una sincronización incremental silenciosa que no agita tu vault.**

> 🌐 [English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Español** · [Italiano](README.it.md)

<!-- screenshot: hero -->

## ✨ ¿Por qué?

- **Historial de visualización detallado** — exactamente qué episodio viste y cuándo, incluyendo revisualizaciones, sincronizado mientras sigues viendo
- **Metadatos en más de 15 idiomas** — traduce títulos / sinopsis / lemas / géneros vía TMDB. Predefinidos integrados para chino (CN / TW / HK), japonés, coreano, francés, alemán, español (ES / MX), portugués (BR), italiano, ruso — más un modo personalizado que acepta cualquier localización admitida por TMDB. **Idioma principal estricto + respaldo definido por el usuario** (p. ej. zh-CN con respaldo en inglés) impide sustituciones silenciosas a zh-TW cuando falta la traducción principal. Los originales en inglés siempre se preservan en los campos frontmatter `*_original_*`
- **Los nombres de archivo siguen tu idioma** — cambia el idioma de los metadatos y las notas existentes se renombran automáticamente en la siguiente sincronización para coincidir con el nuevo título. Los enlaces internos de Obsidian se actualizan automáticamente. Botón puntual «Renombrar ahora» en los ajustes para activaciones manuales
- **Plantillas de notas en 11 idiomas** — plantillas integradas curadas a mano (en + zh-CN + zh-TW + ja + ko + fr + de + it + es + pt-BR + ru). Elige desde el menú desplegable de idioma de plantilla; cambia en cualquier momento sin perder personalizaciones
- **Interfaz de ajustes en pestañas** — General / Notas / Sync / Daily Notes. La última pestaña vista se recuerda por dispositivo
- **Integración con Daily Notes** — inyecta automáticamente una línea por evento en tu Daily Note en cada sincronización (visto / añadido a watchlist / favorito / valorado), ordenadas cronológicamente, en tu idioma de plantilla elegido. La región delimitada por marcadores está totalmente aislada — el contenido fuera de ella nunca se modifica. Un **modo incremental** opcional preserva las anotaciones que escribes a mano dentro del bloque de marcadores. Backfill manual mediante selector de rango de fechas con preajustes rápidos (Últimos 7 días / Este mes / etc.). Ver [spec 0006](../specs/0006-daily-notes-integration.md)
- **Sincronización incremental rápida** — la primera sincronización siembra la caché TMDB local y el estado del historial Trakt; las sincronizaciones posteriores solo obtienen lo que cambió. El tiempo de sincronización en estado estable cae de minutos a segundos. Ver [spec 0001](../specs/0001-incremental-sync.md)
- **Escrituras silenciosas** — la sincronización solo reescribe las notas cuyo contenido realmente cambió. Tras ver un episodio nuevo, una biblioteca de 1200 entradas escribe una nota en lugar de las 1200 — tu capa de sincronización entre dispositivos (Obsidian Sync / iCloud / Syncthing) deja de re-subir la biblioteca entera en cada ejecución. Ver [spec 0002](../specs/0002-diff-based-write.md)
- **Interruptor de nube por ajuste** — elige qué ajustes se sincronizan entre dispositivos y cuáles permanecen locales. Intervalo de auto-sync, sync al iniciar, idioma de la interfaz — cada uno puede ser local del dispositivo para que tu Mac y tu iPhone no peleen entre sí. Ver [spec 0003](../specs/0003-device-local-settings.md)

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

La localización de metadatos arriba es un eje; las superficies propias del plugin son ejes separados:

- **La pestaña de ajustes, la paleta de comandos y los popups de notificación** hablan **English** y **简体中文**. Más idiomas de interfaz bajo demanda — [abre un issue](https://github.com/o1xhack/obsidian-sync-trakt/issues) si quieres contribuir con uno.
- **Plantillas de notas integradas** en 11 idiomas — inglés, chino simplificado (zh-CN), chino tradicional (zh-TW / zh-HK), japonés, coreano, francés, alemán, italiano, español, portugués (BR), ruso. Curadas a mano, no traducidas automáticamente; los títulos de sección, las etiquetas de listas y la puntuación siguen las convenciones de cada idioma (dos puntos de ancho completo en japonés, dos puntos con espacio en francés, etc.). El menú desplegable de idioma de plantilla lista exactamente estos 11; las localizaciones fuera de la lista recurren al inglés (en lugar de elegir silenciosamente una localización hermana).

<!-- screenshot: bilingual-ui -->

## 📅 Integración con Daily Notes

Inserta automáticamente una línea por evento en tu Daily Note en cada sincronización — ordenadas cronológicamente, en tu idioma de plantilla elegido. Cubre episodios vistos, añadidos a watchlist, favoritos y valoraciones:

```markdown
%% trakt:daily:start %%
10:00 — vio Low-IQ Crime (2026) S1E16, S1E17
14:30 — añadió a watchlist The Dark Knight (2008)
21:30 — valoró 9/10 Reborn (2020)
%% trakt:daily:end %%
```

Cada tipo de evento está condicionado por su interruptor de fuente de sincronización correspondiente — si `Sync favorites` está desactivado, los eventos de favoritos tampoco aparecerán en las Daily Notes. Los verbos (`watched` / `看了` / `視聴` / `시청` / `vio`…) siguen tu configuración de **idioma de plantilla** en los 11 idiomas integrados.

**Contrato de seguridad**: la región de marcadores está totalmente aislada — el contenido fuera de ella **nunca se modifica**. Los días pasados son solo de agregar por defecto (los marcadores existentes se preservan); el día actual se reescribe para que los eventos más recientes aparezcan en las sincronizaciones posteriores. Un **modo incremental** opcional cambia también el comportamiento de hoy a solo añadir, de modo que cualquier anotación que escribas dentro del bloque de marcadores sobreviva a cada sincronización.

**Backfill manual** usa un selector de rango de fechas con preajustes rápidos (Últimos 7 días / Últimos 30 días / Este mes / Mes pasado). Un contador en vivo muestra cuántas Daily Notes existen realmente en el rango elegido antes de que confirmes. Configura la carpeta + formato de nombre de archivo (sintaxis Moment.js como `YYYY-MM-DD` o `YYYY/YYYY.MM.DD`) en **Ajustes → Daily Notes**. Ver [spec 0006](../specs/0006-daily-notes-integration.md).

## 🔄 Sincronización entre dispositivos

El estado de autenticación — tokens Trakt, clave TMDB, todos los ajustes — vive en `<vault>/.obsidian/plugins/sync-trakt/data.json` y sigue tu capa de sincronización del vault. Configura la autenticación una vez en Mac, compártela con iPhone vía Obsidian Sync (con `Plugin data` activado), Syncthing, iCloud + Advanced Data Protection, o Cryptomator. El plugin no almacena nada en ningún servidor.

**Cualquier ajuste individual puede desactivar la sincronización entre dispositivos** mediante un pequeño icono de nube junto a él (actualmente expuesto para `Sync on startup` / `Auto-sync` / `Auto-sync interval` / `Plugin UI language`). Útil cuando, por ejemplo, quieres auto-sync cada 30 min en Mac pero nunca en iPhone.

## 📊 Visualización en Obsidian Bases

El campo frontmatter `trakt_poster_url` funciona **listo para usar** con [Obsidian Bases](https://help.obsidian.md/bases) (Obsidian 1.9.3+) — crea una vista de base de datos sobre tu carpeta de sincronización y los pósters se mostrarán como miniaturas:

- **Vista de tarjetas**: abre los ajustes Display → configura **Image property** como `trakt_poster_url`
- **Vista de tabla** (1.9.4+): añade una columna fórmula con `image(note.trakt_poster_url)`

Filtra por `trakt_type = "movie"` / `"show"`, ordena por `trakt_year` / `trakt_rating` / `trakt_my_rating`, agrupa por `trakt_genres` — todo posible. Las propiedades frontmatter que alimentan consultas Dataview también alimentan vistas Bases — sin configuración adicional.

## 🚀 Inicio rápido

1. Ajustes → Community plugins → **Examinar** → busca **Sync Trakt** → **Instalar** → **Activar**
2. Ajustes → **Sync Trakt** → introduce tus claves API de Trakt + TMDB ([guía SETUP](../SETUP.md))
3. Paleta de comandos → **Sync Trakt: Sync**

## 🔑 Claves API: qué desbloquea cada una

El plugin usa dos API. **Trakt es obligatoria** — sin ella el plugin no puede sincronizar nada. **TMDB es opcional** pero desbloquea la mayor parte de lo que hace que valga la pena instalarlo. Detalles:

| Función | API Trakt<br/>_(requerida)_ | API TMDB<br/>_(recomendada)_ |
|---|:---:|:---:|
| Sincronizar tu biblioteca Trakt (watchlist, watched, favorites, ratings) | ✅ | — |
| Marcas de tiempo de visualización por episodio | ✅ | — |
| Título / sinopsis / lema en tu idioma | ✅ básico | ✅ mayor calidad |
| **Géneros en tu idioma** | ❌ | ✅ |
| **Imágenes de pósters incrustadas en las notas** | ❌ | ✅ |

Si solo quieres contenido en inglés y no te interesan los pósters, deja TMDB en blanco — Trakt sola basta. Para una localización completa no-inglesa (incluyendo géneros y pósters), **añade una clave TMDB** ([registro gratuito](https://www.themoviedb.org/settings/api)). Después de pegar tu clave, haz clic en el botón **Test** junto al campo para verificar que funciona antes de tu primera sincronización.

→ [Procedimiento completo para ambas claves](../SETUP.md)

## 📦 Instalación

<details open>
<summary><b>Obsidian Community Plugins (recomendado)</b></summary>

1. Ajustes → Community plugins → **Examinar**
2. Busca **Sync Trakt**
3. Haz clic en **Instalar** → **Activar**

Página del directorio: https://community.obsidian.md/plugins/sync-trakt

</details>

<details>
<summary><b>Desarrollo (construir desde el código fuente)</b></summary>

```bash
git clone https://github.com/o1xhack/obsidian-sync-trakt.git
cd obsidian-sync-trakt
npm install
npm run build      # produce main.js
npm run lint
npm run test:i18n  # pruebas de humo
```

Luego copia `main.js`, `manifest.json`, `styles.css` a `<vault>/.obsidian/plugins/sync-trakt/`.

</details>

<details>
<summary><b>Prueba local (instalación manual)</b></summary>

1. Descarga `main.js`, `manifest.json`, `styles.css` desde el [release más reciente](https://github.com/o1xhack/obsidian-sync-trakt/releases/latest)
2. Coloca los tres archivos en `<tu-vault>/.obsidian/plugins/sync-trakt/`
3. Ajustes → Community plugins → activa **Sync Trakt**

</details>

## 📚 Documentación

| Documento | Contenido |
|---|---|
| [SETUP](../SETUP.md) | Creación de claves API Trakt + TMDB, configuración inicial, resolución de problemas (inglés) |
| [MANUAL](../MANUAL.md) | Referencia completa de ajustes, campos frontmatter, variables de plantilla (inglés) |
| [DEVELOPER](../DEVELOPER.md) | Arquitectura, flujo de datos, cómo extender (solo inglés) |
| [docs/i18n/](.) | Traducciones del README en 8 idiomas adicionales |

## 🗺️ Hoja de ruta

Versiones principales desde el fork (cronológicas):

- [x] **0.1** — Fork inicial. Historial de visualización detallado con marcas de tiempo por episodio, localización de metadatos vía TMDB + cadena de respaldo Trakt, interfaz bilingüe (en + zh-CN), plantillas de notas traducidas (en + zh-CN + zh-TW), id de plugin distinto del upstream para coexistencia.
- [x] **0.2** — Sincronización incremental. Caché TMDB persistente (stale-while-revalidate, TTL de 90 días con jitter) + cursor de estado del historial Trakt. La sincronización en estado estable cae de minutos a segundos. → [spec 0001](../specs/0001-incremental-sync.md)
- [x] **0.3** — Escrituras diferenciales. Solo reescribe notas cuyo frontmatter o sección de cuerpo gestionada realmente cambió; las capas de sincronización entre dispositivos dejan de mover 1200 archivos por sincronización. 0.3.x también añadió: botón Test para clave API TMDB + banner de advertencia cuando se configura idioma de metadatos sin clave, y desambiguación de nombre de archivo en dos niveles para colisiones de títulos localizados (p. ej., 5 series todas llamadas «重生» ya no pelean por el mismo nombre de archivo). → [spec 0002](../specs/0002-diff-based-write.md)
- [x] **0.4** — Preparación para envío al directorio. Id de plugin renombrado `obsidian-sync-trakt` → `sync-trakt` (el bot del directorio Obsidian rechaza ids que contengan «obsidian»), `minAppVersion` ajustado a 1.6.6, y migración automática transparente de datos desde la carpeta antigua al primer inicio. → [spec 0004](../specs/0004-obsidian-directory-submission.md)
- [x] **0.5** — Ajustes locales del dispositivo + limpieza automática. Interruptor de icono de nube por ajuste para que cada ajuste pueda desactivar la sincronización entre dispositivos; limpieza automática de los archivos binarios de la carpeta antigua (manteniendo data.json como red de seguridad) para que los usuarios no vean dos entradas duplicadas de plugin en sus ajustes. → [spec 0003](../specs/0003-device-local-settings.md)
- [x] **0.6** — Interfaz de ajustes en pestañas + 11 idiomas de plantillas de notas integradas. Página de ajustes reorganizada en 4 pestañas (General / Notas / Sync / Daily Notes). Plantillas de notas ampliadas de 3 a 11 idiomas curados a mano (+ ja, ko, fr, de, it, es, pt-BR, ru). Menú desplegable de idioma de plantilla filtrado para mostrar solo idiomas integrados. → [spec 0005](../specs/0005-settings-ui-tabs.md) + [spec 0007](../specs/0007-template-language-expansion.md)
- [x] **0.7** — Integración con Daily Notes. Inserta automáticamente una línea por evento (visto / watchlist / favorito / valorado) en tu Daily Note en cada sincronización, ordenadas cronológicamente, en tu idioma de plantilla elegido. Seguridad de solo agregar para días pasados; el día actual se reescribe a medida que avanza. → [spec 0006](../specs/0006-daily-notes-integration.md)
- [x] **0.8** — **Modo de sincronización incremental** para Daily Notes. Modo opt-in en el que la región de marcadores de hoy es solo de añadir (en lugar de reemplazo completo), de modo que cualquier anotación que escribas dentro sobrevive a cada sincronización.
- [x] **0.9** — **Respaldo de idioma de metadatos**. Añade un menú desplegable «idioma de respaldo» bajo Idioma de metadatos. Cuando se establece, el idioma principal pasa a ser coincidencia estricta (sin sustitución silenciosa a zh-TW para zh-CN) y cae al respaldo elegido por el usuario antes de quedarse con el original en inglés. → [spec 0008](../specs/0008-metadata-language-fallback.md)
- [x] **1.0** — **Renombrado automático de archivos + modal persistente «Novedades» + backfill por rango de fechas**. Cambiar el idioma de metadatos ahora renombra automáticamente las notas existentes en la siguiente sincronización (los enlaces internos de Obsidian se actualizan automáticamente). Cada nueva release muestra una sola vez un modal «Novedades» con el historial de versiones desde la última vez. El backfill manual se reemplazó por un selector de rango de fechas (inicio / fin + preajustes rápidos). → [spec 0009](../specs/0009-filename-rename.md)
- [ ] **Futuro** — Más traducciones de UI del plugin (actualmente en + zh-CN) según demanda; idiomas de plantillas integradas adicionales bajo petición.

## 🤝 Agradecimientos

Este plugin se inspiró originalmente en [sarimabbas/traktr](https://github.com/sarimabbas/traktr) (licencia MIT), del cual proviene el andamiaje inicial para la conexión OAuth a Trakt. El trabajo sustancial posterior — agregación detallada de historial de visualización, localización de metadatos con cadenas de respaldo de traducción, interfaz bilingüe, fetching con concurrencia limitada e informe de progreso en vivo, secciones de cuerpo gestionadas por máquina, motor de plantillas con conocimiento de traducciones, sistema de documentación multilingüe — ha remodelado la mayor parte de la base de código en una arquitectura fundamentalmente diferente.

Gracias a [Sarim Abbas](https://github.com/sarimabbas) por el punto de partida. El aviso de copyright MIT del trabajo original se conserva textualmente en [LICENSE](../../LICENSE) junto con el aviso propio de este proyecto.

## 📄 Licencia

MIT — ver [LICENSE](../../LICENSE).

---

Autor: [o1xhack](https://github.com/o1xhack)
