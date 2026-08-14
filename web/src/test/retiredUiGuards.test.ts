import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Content bans for retired UI surfaces that had no dedicated leftover file
 * (or whose file path is already covered by retiredSourcePaths).
 * Scans production trees only (*.test.* may assert absence).
 */
const SRC_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(SRC_DIR, "../..");
const DESKTOP_DIR = resolve(REPO_ROOT, "desktop");

const SKIP_DIRS = new Set(["node_modules", "dist", "release", "tests", "__pycache__"]);

/** All pages (incl. sources/board) plus assistant/settings chrome, electron, desktop. */
const SCAN_ROOTS: { abs: string; relBase: string }[] = [
  { abs: resolve(SRC_DIR, "pages"), relBase: SRC_DIR },
  { abs: resolve(SRC_DIR, "components/assistant"), relBase: SRC_DIR },
  { abs: resolve(SRC_DIR, "components/settings"), relBase: SRC_DIR },
  { abs: resolve(SRC_DIR, "electron"), relBase: SRC_DIR },
  { abs: DESKTOP_DIR, relBase: REPO_ROOT },
];

const BANNED_SNIPPETS = [
  // Settings → General 「允許區域網路存取」
  "setDesktopAllowLanAccess",
  "allow-lan-access-toggle",
  "lanAccessLabel",
  "lanAccessHelp",
  "lanAccessEnabled",
  "lanAccessDisabled",
  "lanAccessRestarting",
  // Assistant per-session LLM profile block
  "AssistantSessionLlmProfileSelect",
  "assistant-llm-profile",
  't("llmProfile.',
  "t('llmProfile.",
] as const;

/** Items-only: redundant chrome pageTitle keys must stay unused. */
const ITEMS_BANNED_SNIPPETS = [
  't("pageTitle")',
  "t('pageTitle')",
  't("finance.pageTitle")',
  "t('finance.pageTitle')",
] as const;

function walkProductionFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkProductionFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (/\.test\.(ts|tsx)$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

describe("retired UI content guards", () => {
  it("does not reintroduce retired LAN / assistant LLM / items title markers", () => {
    const violations: string[] = [];

    for (const { abs, relBase } of SCAN_ROOTS) {
      for (const file of walkProductionFiles(abs)) {
        const rel = relative(relBase, file).replace(/\\/g, "/");
        const source = readFileSync(file, "utf8");
        for (const snippet of BANNED_SNIPPETS) {
          if (source.includes(snippet)) {
            violations.push(`${rel}: ${snippet}`);
          }
        }
        if (rel.startsWith("pages/items/")) {
          for (const snippet of ITEMS_BANNED_SNIPPETS) {
            if (source.includes(snippet)) {
              violations.push(`${rel}: ${snippet}`);
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
