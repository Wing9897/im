/**
 * Compare leaf i18n keys across zh-Hant / zh-Hans / en for every namespace JSON.
 * zh-Hant is the source of truth (see docs/I18N-GLOSSARY.md).
 *
 * Usage: node scripts/check-i18n-parity.mjs
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LOCALES_DIR = join(ROOT, "web", "src", "i18n", "locales");
const LOCALES = ["zh-Hant", "zh-Hans", "en"];
const SOURCE = "zh-Hant";

/** Keys that must not exist in any locale (retired UI). */
const FORBIDDEN_KEYS = [
  "theme.lightSectionTitle",
  "theme.darkSectionTitle",
  "theme.specialSectionTitle",
  "theme.panelOpacityLabel",
  "theme.panelOpacityHelp",
  "theme.panelOpacityResetDefault",
  "theme.textureDefault",
  "theme.textureCatalogMark",
  "theme.textureStatusDefault",
  "theme.textureStatusNone",
  "theme.textureStatusMotif",
  "shell.systemRootLabel",
  "shell.aiRootLabel",
  "profile",
];

function leafPaths(value, prefix = "") {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  const out = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child != null && typeof child === "object" && !Array.isArray(child)) {
      out.push(...leafPaths(child, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function loadNamespace(locale, fileName) {
  const path = join(LOCALES_DIR, locale, fileName);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const sourceDir = join(LOCALES_DIR, SOURCE);
  if (!existsSync(sourceDir)) {
    console.error(`Missing source locale dir: ${sourceDir}`);
    process.exit(1);
  }

  const namespaces = readdirSync(sourceDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let failed = false;
  const summary = [];

  for (const fileName of namespaces) {
    const ns = fileName.replace(/\.json$/, "");
    const byLocale = {};
    for (const locale of LOCALES) {
      const json = loadNamespace(locale, fileName);
      if (!json) {
        console.error(`[${ns}] missing file for locale ${locale}`);
        failed = true;
        byLocale[locale] = new Set();
        continue;
      }
      byLocale[locale] = new Set(leafPaths(json));
    }

    const sourceKeys = byLocale[SOURCE];
    for (const locale of LOCALES) {
      if (locale === SOURCE) continue;
      const missing = [...sourceKeys].filter((k) => !byLocale[locale].has(k)).sort();
      const extra = [...byLocale[locale]].filter((k) => !sourceKeys.has(k)).sort();
      if (missing.length || extra.length) {
        failed = true;
        console.error(`\n[${ns}] ${locale} vs ${SOURCE}:`);
        if (missing.length) {
          console.error(`  missing (${missing.length}):`);
          for (const k of missing) console.error(`    - ${k}`);
        }
        if (extra.length) {
          console.error(`  extra (${extra.length}):`);
          for (const k of extra) console.error(`    + ${k}`);
        }
      }
    }

    for (const locale of LOCALES) {
      for (const forbidden of FORBIDDEN_KEYS) {
        if (byLocale[locale].has(forbidden)) {
          failed = true;
          console.error(`[${ns}] ${locale} still has retired key: ${forbidden}`);
        }
      }
    }

    summary.push({
      ns,
      keys: sourceKeys.size,
    });
  }

  console.log("\ni18n leaf key counts (zh-Hant):");
  for (const row of summary) {
    console.log(`  ${row.ns.padEnd(14)} ${row.keys}`);
  }

  if (failed) {
    console.error("\ni18n parity check FAILED.");
    process.exit(1);
  }

  console.log("\ni18n parity check OK (all locales aligned with zh-Hant).");
}

main();
