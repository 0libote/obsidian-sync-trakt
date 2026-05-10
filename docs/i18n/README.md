# i18n / Translations

Translated copies of the project's top-level documents live here. The
canonical source of truth is the English version at the repo root; these
copies aim to track it.

| Language | README |
|---|---|
| English (default) | [`README.md`](../../README.md) |
| Simplified Chinese / 简体中文 | [`README.zh-CN.md`](README.zh-CN.md) |

## Adding a new translation

1. Copy the latest English `README.md` from the repo root into this folder
   as `README.<lang>.md` (e.g. `README.ja.md`, `README.fr-FR.md`).
2. Translate. Keep all heading anchors aligned so cross-links between
   translations work.
3. Add a row to the language table in the English `README.md` and to the
   table above.
4. Add a top-of-file language switcher row mirroring the existing
   translations:
   ```markdown
   > [English](../../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)
   ```
5. Open a PR.

The plugin's runtime UI (settings tab, command palette, notice popups) is
a separate axis — its strings live in [`src/i18n.ts`](../../src/i18n.ts)
and currently support `en` + `zh-CN` only.
