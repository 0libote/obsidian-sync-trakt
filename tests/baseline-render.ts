/**
 * Render a movie note with the BASELINE renderer + a fixed timestamp,
 * so we can compare it against the i18n-enabled version (with metadataLanguage="")
 * after the i18n changes are popped back from the stash.
 */
import { buildFrontmatterData, renderNote } from "../src/note-renderer";
import { DEFAULT_SETTINGS } from "../src/settings";
import type { NormalizedItem } from "../src/types";

// Freeze Date.now so synced_at is deterministic
const fixed = new Date("2025-01-01T00:00:00.000Z");
const _origDate = Date;
(globalThis as unknown as { Date: typeof Date }).Date = class extends _origDate {
  constructor(...args: ConstructorParameters<typeof _origDate>) {
    if (args.length === 0) {
      super(fixed.toISOString());
    } else {
      // @ts-expect-error pass-through
      super(...args);
    }
  }
} as unknown as typeof Date;

const item = {
  type: "movie",
  title: "Inception",
  year: 2010,
  ids: {
    trakt: 1,
    slug: "inception-2010",
    imdb: "tt1375666",
    tmdb: 27205,
  },
  overview: "A thief who steals corporate secrets through dream-sharing tech.",
  genres: ["Action", "Sci-Fi"],
  runtime: 148,
  rating: 8.8,
  votes: 99999,
  certification: "PG-13",
  country: "us",
  language: "en",
  status: "released",
  tagline: "Your mind is the scene of the crime.",
  released: "2010-07-16",
  watchlist: true,
  watchlist_added_at: "2024-06-01T00:00:00.000Z",
  // i18n fields — set equal to source values to mimic what sync-engine
  // produces when metadataLanguage="". Baseline (pre-i18n) ignores these.
  originalTitle: "Inception",
  originalOverview: "A thief who steals corporate secrets through dream-sharing tech.",
  originalTagline: "Your mind is the scene of the crime.",
  originalGenres: ["Action", "Sci-Fi"],
} as unknown as NormalizedItem;

const settings = { ...DEFAULT_SETTINGS };
const note = renderNote(item, settings);
const fm = JSON.stringify(buildFrontmatterData(item, settings), null, 2);

import { writeFileSync } from "fs";
writeFileSync(
  process.argv[2] || "tests/.baseline.txt",
  `=== NOTE ===\n${note}\n\n=== FRONTMATTER ===\n${fm}\n`,
);
console.log("Wrote", process.argv[2] || "tests/.baseline.txt");
