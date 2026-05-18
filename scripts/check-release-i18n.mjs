#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function listFiles(relativeDir, predicate) {
  return fs
    .readdirSync(path.join(root, relativeDir))
    .filter(predicate)
    .sort()
    .map((file) => path.join(relativeDir, file));
}

function fail(message) {
  failures.push(message);
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function stringLiteralValue(expression) {
  const unwrapped = unwrapExpression(expression);
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }
  return undefined;
}

function findVariable(sourceFile, name) {
  let result;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      result = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return result;
}

function parseSource(relativePath) {
  return ts.createSourceFile(
    relativePath,
    read(relativePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function getArrayStrings(variable) {
  const initializer = variable?.initializer && unwrapExpression(variable.initializer);
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) return [];
  return initializer.elements
    .map((element) => stringLiteralValue(element))
    .filter((value) => typeof value === "string");
}

function checkRuntimeUiStrings() {
  const sourceFile = parseSource("src/i18n.ts");
  const languageVar = findVariable(sourceFile, "UI_LANGUAGES");
  const languages = getArrayStrings(languageVar);
  if (languages.length === 0) {
    fail("src/i18n.ts must declare UI_LANGUAGES with at least one language.");
    return;
  }

  const stringsVar = findVariable(sourceFile, "STRINGS");
  const stringsInitializer =
    stringsVar?.initializer && unwrapExpression(stringsVar.initializer);
  if (!stringsInitializer || !ts.isObjectLiteralExpression(stringsInitializer)) {
    fail("src/i18n.ts must declare STRINGS as an object literal.");
    return;
  }

  let keyCount = 0;
  for (const entry of stringsInitializer.properties) {
    if (!ts.isPropertyAssignment(entry)) continue;
    const key = propertyName(entry.name);
    const value = unwrapExpression(entry.initializer);
    if (!key || !ts.isObjectLiteralExpression(value)) {
      fail(`src/i18n.ts STRINGS entry '${key ?? "<unknown>"}' must be an object.`);
      continue;
    }

    keyCount += 1;
    const values = new Map();
    for (const prop of value.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const lang = propertyName(prop.name);
      const text = stringLiteralValue(prop.initializer);
      if (lang) values.set(lang, text);
    }

    for (const lang of languages) {
      const text = values.get(lang);
      if (!text || !text.trim()) {
        fail(`src/i18n.ts key '${key}' is missing non-empty '${lang}' text.`);
      }
    }
  }

  if (keyCount === 0) {
    fail("src/i18n.ts STRINGS did not expose any keys.");
  }
}

function getObjectStringProperty(objectLiteral, propName) {
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (propertyName(prop.name) !== propName) continue;
    return stringLiteralValue(prop.initializer);
  }
  return undefined;
}

function checkReleaseLog(manifestVersion) {
  const sourceFile = parseSource("src/release-log.ts");
  const releaseLog = findVariable(sourceFile, "RELEASE_LOG");
  const releaseLogInitializer =
    releaseLog?.initializer && unwrapExpression(releaseLog.initializer);

  if (!releaseLogInitializer || !ts.isArrayLiteralExpression(releaseLogInitializer)) {
    fail("src/release-log.ts must declare RELEASE_LOG as an array literal.");
    return;
  }

  const entries = releaseLogInitializer.elements.filter((entry) =>
    ts.isObjectLiteralExpression(entry),
  );
  if (entries.length === 0) {
    fail("src/release-log.ts RELEASE_LOG must contain at least one entry.");
    return;
  }

  const topVersion = getObjectStringProperty(entries[0], "version");
  if (topVersion !== manifestVersion) {
    fail(
      `src/release-log.ts latest version '${topVersion ?? "<missing>"}' does not match manifest version '${manifestVersion}'.`,
    );
  }

  for (const entry of entries) {
    const version = getObjectStringProperty(entry, "version") ?? "<missing>";
    for (const field of ["en", "zh"]) {
      const text = getObjectStringProperty(entry, field);
      if (!text || !text.trim()) {
        fail(`src/release-log.ts RELEASE_LOG ${version} is missing non-empty '${field}'.`);
      }
    }
  }

  const highlights = findVariable(sourceFile, "RECENT_UPDATE_HIGHLIGHTS");
  const highlightsInitializer =
    highlights?.initializer && unwrapExpression(highlights.initializer);
  if (!highlightsInitializer || !ts.isArrayLiteralExpression(highlightsInitializer)) {
    fail("src/release-log.ts must declare RECENT_UPDATE_HIGHLIGHTS as an array literal.");
    return;
  }

  for (const [index, entry] of highlightsInitializer.elements.entries()) {
    if (!ts.isObjectLiteralExpression(entry)) continue;
    for (const field of ["en", "zh"]) {
      const text = getObjectStringProperty(entry, field);
      if (!text || !text.trim()) {
        fail(
          `src/release-log.ts RECENT_UPDATE_HIGHLIGHTS[${index}] is missing non-empty '${field}'.`,
        );
      }
    }
  }
}

function extractSpecLinks(markdown) {
  const links = new Set();
  const regex = /(?:docs\/specs|\.{1,2}\/specs|specs)\/([0-9]{4}[-A-Za-z0-9]+\.md)/g;
  let match;
  while ((match = regex.exec(markdown))) {
    links.add(match[1]);
  }
  return links;
}

function checkLocalizedReadmes() {
  const mainLinks = extractSpecLinks(read("README.md"));
  const readmes = listFiles("docs/i18n", (file) => /^README\..+\.md$/.test(file));
  if (readmes.length === 0) {
    fail("docs/i18n must contain localized README files.");
    return;
  }

  for (const readme of readmes) {
    const localizedLinks = extractSpecLinks(read(readme));
    const missing = [...mainLinks].filter((link) => !localizedLinks.has(link));
    if (missing.length > 0) {
      fail(`${readme} is missing spec link(s): ${missing.join(", ")}.`);
    }
  }
}

function extractSection(markdown, startHeadingRegex, endHeadingRegex) {
  const startMatch = startHeadingRegex.exec(markdown);
  if (!startMatch) return "";
  const start = startMatch.index;
  const rest = markdown.slice(start + startMatch[0].length);
  const endMatch = endHeadingRegex.exec(rest);
  return endMatch ? rest.slice(0, endMatch.index) : rest;
}

function extractTableFirstCells(markdown) {
  const labels = new Set();
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const first = cells[0];
    if (
      !first ||
      /^:?-{3,}:?$/.test(first) ||
      ["Setting", "Default", "Description", "設定", "設定項", "デフォルト", "説明"].includes(first)
    ) {
      continue;
    }
    labels.add(first);
  }
  return labels;
}

function checkLocalizedManuals() {
  const mainSettingsSection = extractSection(
    read("docs/MANUAL.md"),
    /^## 5\. Settings reference/m,
    /^## 6\./m,
  );
  const requiredLabels = extractTableFirstCells(mainSettingsSection);
  if (requiredLabels.size === 0) {
    fail("docs/MANUAL.md has no settings table labels to check.");
    return;
  }

  const manuals = listFiles("docs/i18n", (file) => /^MANUAL\..+\.md$/.test(file));
  if (manuals.length === 0) {
    fail("docs/i18n must contain localized MANUAL files.");
    return;
  }

  for (const manual of manuals) {
    const localizedSection = extractSection(read(manual), /^## 5\./m, /^## 6\./m);
    const localizedLabels = extractTableFirstCells(localizedSection);
    const missing = [...requiredLabels].filter((label) => !localizedLabels.has(label));
    if (missing.length > 0) {
      fail(`${manual} is missing setting row(s): ${missing.join(", ")}.`);
    }
  }
}

function checkChangelog(manifestVersion) {
  const changelog = read("docs/CHANGELOG.md");
  if (!new RegExp(`^## ${manifestVersion.replaceAll(".", "\\.")}\\b`, "m").test(changelog)) {
    fail(`docs/CHANGELOG.md is missing a '${manifestVersion}' release section.`);
  }
}

const manifest = JSON.parse(read("manifest.json"));

checkRuntimeUiStrings();
checkReleaseLog(manifest.version);
checkChangelog(manifest.version);
checkLocalizedReadmes();
checkLocalizedManuals();

if (failures.length > 0) {
  console.error("Release i18n check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Release i18n check passed.");
