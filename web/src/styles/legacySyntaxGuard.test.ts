/**
 * Legacy syntax & import guardrail.
 *
 * Prevents Vite-breaking patterns and blocks re-introduction of styles/theme imports
 * in application source (components, pages, routing, and styles helpers).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC_DIR = path.resolve(__dirname, "..");
const SCAN_DIRS = [
  path.join(SRC_DIR, "components"),
  path.join(SRC_DIR, "pages"),
  path.join(SRC_DIR, "routing"),
  path.join(SRC_DIR, "styles"),
];

/** Styles tests / guards may mention banned paths; app code may not import them. */
const STYLES_ALLOWLIST = new Set([
  "themeSystem.test.ts",
  "legacySyntaxGuard.test.ts",
  "styleConflictDetection.test.ts",
  "noHardcodedHexColors.test.ts",
]);

const THEME_IMPORT_RE =
  /from\s+['"][^'"]*\/styles\/theme['"]|from\s+['"]\.\.?\/styles\/theme['"]|from\s+['"]\.\/theme['"]/;

const THEME_COLORS_IMPORT_RE =
  /import\s+\{\s*colors\s*\}\s+from\s+['"][^'"]*themeColors['"]/;

const DEFAULT_VAR_PARAM_RE = /=\s*var\(--/;

const BRACKETED_VAR_RE = /\["var\(--/;

interface Violation {
  file: string;
  line: number;
  rule: string;
  content: string;
}

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (
      entry.isFile() &&
      /\.(tsx?)$/.test(entry.name) &&
      !/\.(test|spec|prop\.test)\.(ts|tsx)$/.test(entry.name) &&
      !STYLES_ALLOWLIST.has(entry.name) &&
      !/Styles\.ts$/.test(entry.name)
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const relativePath = path.relative(path.resolve(SRC_DIR, ".."), filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    const codeOnly = line.replace(/\/\/.*$/, "");

    if (THEME_IMPORT_RE.test(codeOnly)) {
      violations.push({
        file: relativePath,
        line: i + 1,
        rule: "styles/theme import banned (use themeData, tokens, or var(--*) strings)",
        content: trimmed,
      });
    }
    if (THEME_COLORS_IMPORT_RE.test(codeOnly)) {
      violations.push({
        file: relativePath,
        line: i + 1,
        rule: "themeColors import banned (use var(--*) strings directly)",
        content: trimmed,
      });
    }
    if (DEFAULT_VAR_PARAM_RE.test(codeOnly)) {
      violations.push({
        file: relativePath,
        line: i + 1,
        rule: "= var(--*) default parameter syntax is invalid",
        content: trimmed,
      });
    }
    if (BRACKETED_VAR_RE.test(codeOnly)) {
      violations.push({
        file: relativePath,
        line: i + 1,
        rule: '["var(--*)"] bracket syntax is invalid (use ease-[var(--*)])',
        content: trimmed,
      });
    }
  }

  return violations;
}

describe("Legacy syntax guardrail", () => {
  const allFiles = SCAN_DIRS.flatMap(collectSourceFiles);

  it("should scan source files", () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it("should not import styles/theme or themeColors in application source", () => {
    const violations: Violation[] = [];
    for (const file of allFiles) {
      violations.push(...scanFile(file));
    }

    if (violations.length > 0) {
      const summary = violations
        .slice(0, 30)
        .map((v) => `  ${v.file}:${v.line} [${v.rule}] ${v.content.substring(0, 100)}`)
        .join("\n");
      const extra =
        violations.length > 30 ? `\n  ... and ${violations.length - 30} more` : "";

      expect(
        violations.length,
        `Found ${violations.length} legacy violation(s):\n${summary}${extra}`,
      ).toBe(0);
    }
  });
});
