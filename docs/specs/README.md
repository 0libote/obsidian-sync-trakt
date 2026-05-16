# Design specs

This folder holds the design documents for substantial changes to the
plugin. Each spec captures **why** a change was made, not just **what** —
so a contributor returning months later (or a brand-new contributor
joining) can reconstruct the trade-offs and constraints that shaped the
implementation.

## When to write a spec

Write one before non-trivial work. Rough threshold:

- New persistent data shape (settings field, cache layer, etc.)
- A change to the sync flow's order of operations
- An API contract change (Trakt / TMDB endpoint added or replaced)
- Anything where the obvious solution and the implemented solution diverge

Skip for:

- Bug fixes
- Doc-only changes
- Refactors with no behavior change
- Translations / i18n string additions

## Format

Each spec is a single markdown file under `docs/specs/`. File names use a
zero-padded sequence number plus a slug: `NNNN-short-slug.md`. The
sequence number doesn't strictly correspond to release versions — it just
gives stable, sortable identifiers.

Required front matter:

```markdown
# NNNN — Short title

- **Status**: draft | accepted | implemented | superseded
- **Released in**: N/A | 0.x.y
- **Date**: YYYY-MM-DD (last meaningful update)
- **Authors**: @handle, …
- **Supersedes**: NNNN (if any)
```

Required sections:

1. **Context** — what's the problem, why now, what's the user-visible
   pain or limitation
2. **Goals / Non-goals** — explicit scope. Non-goals matter as much as
   goals: they prevent scope creep mid-implementation
3. **Design** — the actual chosen approach, in enough detail that
   someone could rebuild from it. Include data shapes, function
   signatures, sequence of operations
4. **Alternatives considered** — at least one or two rejected designs,
   with reasons. "I considered X but it would have done Y" is far more
   useful than just describing the chosen path
5. **Migration / backward compatibility** — what happens to users on the
   previous version, what state is preserved or recomputed
6. **Tests** — what scenarios the test suite covers, including edge
   cases that motivated specific design choices
7. **Future work** — what we explicitly punted on, and what would
   trigger us to revisit

## Status lifecycle

```
draft  →  accepted  →  implemented  →  (superseded)
```

- **draft**: design proposal, not necessarily final
- **accepted**: design agreed; implementation may not have started
- **implemented**: code shipped under the listed release version
- **superseded**: a later spec replaces this one — link both ways

## Index

| # | Title | Status | Released |
|---|---|---|---|
| [0001](0001-incremental-sync.md) | Incremental sync (TMDB cache + Trakt history state) | implemented | 0.2.0 |
| [0010](0010-local-runtime-cache.md) | Local runtime cache storage | implemented | 1.1.0 |

## See also

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — current state of the codebase, kept up to date
- [`../CHANGELOG.md`](../CHANGELOG.md) — short release-by-release log
- [`../DEVELOPER.md`](../DEVELOPER.md) — onboarding for new contributors
