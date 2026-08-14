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

/**
 * Keys that must not exist (retired UI).
 * Bare paths apply to every namespace; `ns:leaf.path` scopes to one JSON file.
 */
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
  // Stamp 32: no is_default / make-default; assistant is a global slot, not staff.
  "profiles.setDefault",
  "profiles.defaultLabel",
  "profiles.defaultHelp",
  "profiles.defaultBadge",
  "profiles.setDefaultSuccess",
  "profiles.cannotDeleteDefault",
  "profiles.staffClass.assistant",
  // Assistant page: per-session LLM profile picker retired — global slot only.
  "llmProfile.label",
  "llmProfile.followStaff",
  "llmProfile.placeholder",
  "llmProfile.loading",
  "llmProfile.empty",
  "llmProfile.slotUnbound",
  "llmProfile.slotCta",
  "llmProfile.allIncomplete",
  "llmProfile.createCta",
  "llmProfile.defaultBadge",
  "llmProfile.incompleteBadge",
  // Settings → General: LAN bind toggle retired (always 0.0.0.0).
  "general.lanAccessLabel",
  "general.lanAccessHelp",
  "general.lanAccessEnabled",
  "general.lanAccessDisabled",
  "general.lanAccessRestarting",
  // Items chrome: category hub / finance omit redundant page titles (nav labels the page).
  "items:pageTitle",
  "items:finance.pageTitle",
];

function forbiddenMatches(ns, leafPath, forbidden) {
  const colon = forbidden.indexOf(":");
  if (colon === -1) return leafPath === forbidden;
  return ns === forbidden.slice(0, colon) && leafPath === forbidden.slice(colon + 1);
}

/**
 * i18next CLDR plural suffixes. `key`, `key_one`, `key_other`, ... form one
 * "plural family" identified by the base key: zh locales keep the bare key
 * (Chinese has a single plural category) while en may expand into
 * `_one`/`_other`. Parity compares collapsed base keys, not raw leaves.
 */
const PLURAL_SUFFIXES = new Set(["zero", "one", "two", "few", "many", "other"]);

function collapsePluralLeaf(leafPath) {
  const underscore = leafPath.lastIndexOf("_");
  if (underscore === -1) return null;
  const suffix = leafPath.slice(underscore + 1);
  if (!PLURAL_SUFFIXES.has(suffix)) return null;
  return leafPath.slice(0, underscore);
}

/** Collapse plural families to base keys; flag families missing `_other`. */
function normalizePluralFamilies(ns, locale, rawLeaves) {
  const keys = new Set();
  const suffixesByBase = new Map();
  for (const leaf of rawLeaves) {
    const base = collapsePluralLeaf(leaf);
    if (base == null) {
      keys.add(leaf);
      continue;
    }
    keys.add(base);
    if (!suffixesByBase.has(base)) suffixesByBase.set(base, new Set());
    suffixesByBase.get(base).add(leaf.slice(base.length + 1));
  }
  const errors = [];
  for (const [base, suffixes] of suffixesByBase) {
    if (!suffixes.has("other")) {
      errors.push(`[${ns}] ${locale} plural family "${base}" has _${[...suffixes].sort().join("/_")} but no _other`);
    }
  }
  return { keys, errors };
}

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
      const { keys, errors } = normalizePluralFamilies(ns, locale, leafPaths(json));
      byLocale[locale] = keys;
      for (const err of errors) {
        failed = true;
        console.error(err);
      }
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
        for (const leaf of byLocale[locale]) {
          if (forbiddenMatches(ns, leaf, forbidden)) {
            failed = true;
            console.error(`[${ns}] ${locale} still has retired key: ${forbidden}`);
          }
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
