/**
 * Feature: comprehensive-refinement, Property 19: No hardcoded hex colors in component files
 *
 * Static analysis test that scans all .tsx/.ts files in src/components/ and src/pages/
 * and asserts that no hardcoded hexadecimal color literals exist outside of Style_System modules.
 *
 * Excluded files:
 * - Files in src/styles/ (the Style_System itself)
 * - Files ending in Layout.ts (viz layout modules with canvas fallbacks)
 * - Files ending in Styles.ts (controlStyles, segmentedTabStyles)
 * - Test files (.test.ts, .test.tsx)
 *
 * **Validates: Requirements 22.2**
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Configuration ───────────────────────────────────────────────────────────

const SRC_DIR = path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(SRC_DIR, "components");
const PAGES_DIR = path.join(SRC_DIR, "pages");

/**
 * Regex matching standalone hex color patterns: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
 * Uses word boundary to avoid matching things like URL fragments or IDs.
 */
const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface HexViolation {
  file: string;
  line: number;
  match: string;
  lineContent: string;
}

/**
 * Recursively collects all .ts/.tsx files in a directory,
 * excluding test files and style system files.
 */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(tsx?|ts)$/.test(entry.name)) {
      // Exclude test files
      if (/\.(test|spec|prop\.test)\.(ts|tsx)$/.test(entry.name)) continue;
      // Exclude layout/style helper modules (canvas fallbacks may use hex)
      if (/Layout\.ts$/.test(entry.name)) continue;
      if (/Styles\.ts$/.test(entry.name)) continue;
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Checks if a line is a comment (single-line // or inside a block comment indicator).
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*")
  );
}

/**
 * Scans a file for hardcoded hex color patterns outside of comments.
 */
function scanFileForHexColors(filePath: string): HexViolation[] {
  const violations: HexViolation[] = [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const relativePath = path.relative(path.resolve(SRC_DIR, ".."), filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comment lines
    if (isCommentLine(line)) continue;

    // Strip inline comments (// ...) from the line before scanning
    const codeOnly = line.replace(/\/\/.*$/, "");

    // Find all hex color matches
    HEX_COLOR_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = HEX_COLOR_PATTERN.exec(codeOnly)) !== null) {
      violations.push({
        file: relativePath,
        line: i + 1,
        match: match[0],
        lineContent: line.trim(),
      });
    }
  }

  return violations;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Feature: comprehensive-refinement, Property 19: No hardcoded hex colors in component files", () => {
  const componentFiles = collectSourceFiles(COMPONENTS_DIR);
  const pageFiles = collectSourceFiles(PAGES_DIR);
  const allFiles = [...componentFiles, ...pageFiles];

  it("should find source files to scan", () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it("should not contain hardcoded hex color literals in component files", () => {
    const allViolations: HexViolation[] = [];

    for (const file of componentFiles) {
      allViolations.push(...scanFileForHexColors(file));
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 20)
        .map((v) => `  ${v.file}:${v.line} → ${v.match} (${v.lineContent.substring(0, 80)})`)
        .join("\n");
      const extra = allViolations.length > 20 ? `\n  ... and ${allViolations.length - 20} more` : "";

      expect(
        allViolations.length,
        `Found ${allViolations.length} hardcoded hex color(s) in src/components/:\n${summary}${extra}\n\n` +
          `All colors should reference tokens.ts or theme.ts constants instead.`
      ).toBe(0);
    }
  });

  it("should not contain hardcoded hex color literals in page files", () => {
    const allViolations: HexViolation[] = [];

    for (const file of pageFiles) {
      allViolations.push(...scanFileForHexColors(file));
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .slice(0, 20)
        .map((v) => `  ${v.file}:${v.line} → ${v.match} (${v.lineContent.substring(0, 80)})`)
        .join("\n");
      const extra = allViolations.length > 20 ? `\n  ... and ${allViolations.length - 20} more` : "";

      expect(
        allViolations.length,
        `Found ${allViolations.length} hardcoded hex color(s) in src/pages/:\n${summary}${extra}\n\n` +
          `All colors should reference tokens.ts or theme.ts constants instead.`
      ).toBe(0);
    }
  });

  it("should report scan summary", () => {
    const allViolations: HexViolation[] = [];

    for (const file of allFiles) {
      allViolations.push(...scanFileForHexColors(file));
    }

    if (allViolations.length > 0) {
      const byFile = new Map<string, number>();
      for (const v of allViolations) {
        byFile.set(v.file, (byFile.get(v.file) || 0) + 1);
      }
      const sorted = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const topOffenders = sorted.map(([file, count]) => `  ${file}: ${count}`).join("\n");

      expect(
        allViolations.length,
        `Found ${allViolations.length} hex color violation(s) across ${allFiles.length} files.\n` +
          `Top offending files:\n${topOffenders}`
      ).toBe(0);
    }

    expect(allViolations.length).toBe(0);
  });
});
