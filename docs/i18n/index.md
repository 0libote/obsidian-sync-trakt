# i18n / Translations

Translated copies of the project's user-facing documents live here. The
canonical source of truth is the English version at the repo root /
`docs/`; these copies aim to track it.

## Coverage matrix

| Doc | en | zh-CN | zh-TW | ja | ko | fr | de | es | it |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| [README](../../README.md) | ✓ | [✓](README.zh-CN.md) | [✓](README.zh-TW.md) | [✓](README.ja.md) | [✓](README.ko.md) | [✓](README.fr.md) | [✓](README.de.md) | [✓](README.es.md) | [✓](README.it.md) |
| [SETUP](../SETUP.md) | ✓ | [✓](SETUP.zh-CN.md) | [✓](SETUP.zh-TW.md) | [✓](SETUP.ja.md) | — | — | — | — | — |
| [MANUAL](../MANUAL.md) | ✓ | [✓](MANUAL.zh-CN.md) | [✓](MANUAL.zh-TW.md) | [✓](MANUAL.ja.md) | — | — | — | — | — |
| [DEVELOPER](../DEVELOPER.md) | ✓ | — | — | — | — | — | — | — | — |

**Why the asymmetry?** README is the entry point — broad language coverage helps people find the project. SETUP and MANUAL are deeper docs; we translate to languages where there's both maintainer fluency and reasonable demand. DEVELOPER is for people reading the source, who already operate in English.

## Conventions

- File naming: `<DOC>.<lang>.md` where `<lang>` is a BCP 47 code (e.g. `README.zh-CN.md`, `SETUP.ja.md`)
- Each translation starts with the same language switcher row at the top
- Headings, code blocks, frontmatter examples, and file paths stay verbatim — only prose gets translated
- The plugin-runtime UI (settings tab, commands, notices) is a separate axis — its strings live in [`src/i18n.ts`](../../src/i18n.ts) and currently support `en` + `zh-CN` only

## Adding a new translation

1. Copy the latest English source from the repo root (`README.md`) or `docs/` (`SETUP.md`, `MANUAL.md`) into this folder as `<DOC>.<lang>.md`.
2. Translate the prose; keep heading anchors, code blocks, paths, and examples untouched.
3. Add a row to the language-switcher line at the top of every existing translation of the same doc, so navigation works in both directions.
4. Add a column / cell to the Coverage matrix above.
5. Open a PR.

## Plugin runtime UI translations

The plugin's settings tab, commands, and notices currently translate to:

- English (`en`) — default
- Simplified Chinese (`zh-CN`)

Other languages would require translating the ~90 string keys in
[`src/i18n.ts`](../../src/i18n.ts) and adding the language code to the Plugin
UI language dropdown in `src/settings.ts`. Drop a PR or open an issue if you
want a specific language added.
