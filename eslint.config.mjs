import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        console: "readonly",
        window: "readonly",
        navigator: "readonly",
        document: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      // [0.7.1] Obsidian's submission bot runs `@typescript-eslint/require-await`
      // and rejects callbacks/methods marked `async` that don't actually await
      // anything (PR #12757 was flagged for three such cases on May 11). The
      // base obsidianmd preset doesn't enable this rule, so enforce it locally
      // to catch regressions before the bot does.
      "@typescript-eslint/require-await": "error",
    },
  },
]);
