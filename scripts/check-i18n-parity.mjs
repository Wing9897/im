/**
 * Compare leaf i18n keys across zh-Hant / zh-Hans / en for every namespace JSON,
 * then fail if zh-Hant keys have no t() / quoted-literal reference (unless allowlisted).
 * zh-Hant is the source of truth (see docs/I18N-GLOSSARY.md).
 *
 * Usage: node scripts/check-i18n-parity.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname, relative } from "node:path";
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
  "timeline:userEvent.parentItemAria",
  "timeline:userEvent.parentItemNone",
  "timeline:userEvent.parentItemHint",
];

/**
 * Unused-key exceptions (`ns:leaf` or `ns:prefix.*`).
 * Dynamic `t(\`prefix${}\`)` is auto-covered; list keys the scanner cannot prove
 * (open catalogs, FORBIDDEN siblings kept for enum lookup). One-line reason each.
 */
const UNUSED_ALLOWLIST = [
  {
    key: "common:errors.*",
    reason: "Resolved via errors.${code} / i18n.exists from API error_code",
  },
  {
    key: "items:seed.*",
    reason: "t(`seed.${cat.slug}`, { defaultValue }); slugs come from category records",
  },
  {
    key: "logs:category.*",
    reason: "t(`category.${entry.category}`, { defaultValue }); categories from backend",
  },
  {
    key: "settings:theme.textureMotif.*",
    reason: "t(`theme.textureMotif.${motif}`, { defaultValue: motif }); ids from texture catalog",
  },
  {
    key: "settings:profiles.staffClass.*",
    reason: "t(`profiles.staffClass.${staffClass}`); assistant counterpart is FORBIDDEN",
  },
  {
    key: "tasks:presets.*",
    reason: "localizeTaskPreset: tasks:presets.${id}.*; ids from shared/task_presets.json",
  },
  {
    key: "tasks:modes.*",
    reason: "getTaskFormAnalysisModeMeta: tasks:modes.${analysisMode}.*",
  },
  {
    key: "tasks:employees.*",
    reason: "t(`tasks:employees.${employeeId}.name|blurb`)",
  },
];

const SCAN_ROOTS = [
  join(ROOT, "web", "src"),
  join(ROOT, "desktop"),
  join(ROOT, "server"),
  join(ROOT, "tests"),
  join(ROOT, "scripts"),
];
const SCAN_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".py"]);
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  "release",
  ".venv",
  "__pycache__",
  "locales",
  "generated",
]);
const SKIP_FILE_RE = /(?:^|[/\\])check-i18n-parity\.mjs$/;

function forbiddenMatches(ns, leafPath, forbidden) {
  const colon = forbidden.indexOf(":");
  if (colon === -1) return leafPath === forbidden;
  return ns === forbidden.slice(0, colon) && leafPath === forbidden.slice(colon + 1);
}

function allowlistReason(ns, leafPath) {
  const qualified = `${ns}:${leafPath}`;
  for (const { key, reason } of UNUSED_ALLOWLIST) {
    if (key.endsWith(".*")) {
      const prefix = key.slice(0, -1); // keep trailing "."
      if (qualified.startsWith(prefix)) return reason;
      continue;
    }
    if (key === qualified) return reason;
  }
  return null;
}

function walkScanFiles(dir, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR_NAMES.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkScanFiles(full, out);
    else if (SCAN_EXTS.has(extname(name))) out.push(full);
  }
}

function extractQuotedStrings(text, into) {
  // Extract "..." and '...' independently so keys nested in `...${t("ns:key")}...`
  // are not swallowed by the outer template literal.
  for (const re of [/"((?:\\.|[^"\\])*)"/g, /'((?:\\.|[^'\\])*)'/g]) {
    let m;
    while ((m = re.exec(text))) into.add(m[1].replace(/\\./g, (s) => s[1]));
  }
  const tick = /`([^`$\\]*)`/g;
  let m;
  while ((m = tick.exec(text))) into.add(m[1]);
}

/** `timeline:` / `nav:` cover an entire namespace — too broad for unused detection. */
function isSpecificDynamicPrefix(prefix) {
  const body = prefix.includes(":") ? prefix.slice(prefix.indexOf(":") + 1) : prefix;
  return body.length > 0 && (/[.:]/.test(prefix) || body.includes("."));
}

/**
 * Patterns from t(`prefix${var}suffix`) / i18n.t(`...`) / exists(`...`).
 * Prefix must be non-empty so `${base}.name` does not match every *.name key.
 */
function extractDynamicPatterns(text, into) {
  const callRe = /(?:(?:i18n\.)?t|\.exists|exists)\(\s*`([^`]*)`/g;
  let m;
  while ((m = callRe.exec(text))) {
    const tpl = m[1];
    if (!tpl.includes("${")) continue;
    const parts = tpl.split(/\$\{[^}]*\}/);
    const prefix = parts[0];
    const suffix = parts.length > 1 ? parts[parts.length - 1] : "";
    if (!isSpecificDynamicPrefix(prefix)) continue;
    into.push({ prefix, suffix });
  }
  const freeRe = /`([A-Za-z][A-Za-z0-9_.:-]*\.\$\{[^}]+\}[^`]*)`/g;
  while ((m = freeRe.exec(text))) {
    const tpl = m[1];
    const parts = tpl.split(/\$\{[^}]*\}/);
    const prefix = parts[0];
    const suffix = parts.length > 1 ? parts[parts.length - 1] : "";
    if (!isSpecificDynamicPrefix(prefix)) continue;
    into.push({ prefix, suffix });
  }
}

function coversKey(ns, leaf, patterns) {
  const qualified = `${ns}:${leaf}`;
  for (const { prefix, suffix } of patterns) {
    const haystacks = prefix.includes(":") ? [qualified] : [leaf, qualified];
    for (const hay of haystacks) {
      if (!hay.startsWith(prefix)) continue;
      if (suffix && !hay.endsWith(suffix)) continue;
      if (hay.length === prefix.length && suffix) continue;
      return true;
    }
  }
  return false;
}

function collectKeyReferences() {
  const files = [];
  for (const root of SCAN_ROOTS) walkScanFiles(root, files);
  const literals = new Set();
  const patterns = [];
  for (const file of files) {
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    if (SKIP_FILE_RE.test(rel)) continue;
    const text = readFileSync(file, "utf8");
    extractQuotedStrings(text, literals);
    extractDynamicPatterns(text, patterns);
  }
  return { fileCount: files.length, literals, patterns };
}

function findUnusedKeys(keysByNs, refs) {
  const unused = [];
  for (const [ns, keys] of keysByNs) {
    for (const leaf of keys) {
      const qualified = `${ns}:${leaf}`;
      if (
        refs.literals.has(leaf) ||
        refs.literals.has(qualified) ||
        refs.literals.has(`${ns}.${leaf}`)
      ) {
        continue;
      }
      if (coversKey(ns, leaf, refs.patterns)) continue;
      unused.push({ ns, leaf, qualified, allowReason: allowlistReason(ns, leaf) });
    }
  }
  return unused;
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
  const keysByNs = new Map();

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
    keysByNs.set(ns, sourceKeys);
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

  const refs = collectKeyReferences();
  const unusedHits = findUnusedKeys(keysByNs, refs);
  const unused = unusedHits.filter((row) => !row.allowReason);
  if (unused.length) {
    failed = true;
    console.error(`\nUnused i18n keys (${unused.length}; no t() / quoted literal, not allowlisted):`);
    for (const row of unused) console.error(`  - ${row.qualified}`);
  } else {
    console.log(
      `\ni18n unused-key check OK (scanned ${refs.fileCount} files; ${UNUSED_ALLOWLIST.length} allowlist rules).`,
    );
  }

  if (failed) {
    console.error("\ni18n check FAILED.");
    process.exit(1);
  }

  console.log("\ni18n check OK (parity vs zh-Hant + unused-key scan).");
}

main();
