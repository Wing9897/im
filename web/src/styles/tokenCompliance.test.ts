import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  spacing,
  borderRadius,
  typography,
  layoutWidth,
  type SpacingKey,
  type BorderRadiusKey,
  type TypographyKey,
} from "./tokens";

/**
 * Static analysis test for token adoption compliance.
 * Scans src/pages/ for hardcoded spacing, borderRadius, maxWidth, and typography values
 * that should use design tokens instead.
 *
 * This test serves two purposes:
 * 1. Prevents NEW hardcoded values from being introduced (ratchet mechanism)
 * 2. Tracks migration progress — as pages are migrated, reduce the baseline counts
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const PAGES_DIR = path.resolve(__dirname, "../pages");

/** Properties that should use spacing tokens */
const SPACING_PROPERTIES = [
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
];

/** Properties that should use borderRadius tokens */
const BORDER_RADIUS_PROPERTIES = ["borderRadius"];

/** Properties that should use layoutWidth tokens */
const LAYOUT_WIDTH_PROPERTIES = ["maxWidth"];

/** Properties that should use typography tokens */
const TYPOGRAPHY_PROPERTIES = ["fontSize", "fontWeight"];

/** Properties that are exempt from token compliance (non-design values) */
const EXEMPT_PROPERTIES = [
  "zIndex",
  "opacity",
  "flex",
  "flexGrow",
  "flexShrink",
  "order",
  "animationDuration",
  "transitionDuration",
  "animationDelay",
  "transitionDelay",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxHeight",
  "lineHeight",
  "letterSpacing",
  "tabIndex",
];

/** Numeric values that are always allowed (0 and 1 are trivial) */
const ALWAYS_ALLOWED_VALUES = [0, 1];

/**
 * Known pre-migration violation baselines.
 * These represent pages that have NOT yet been migrated to tokens.
 * As pages are migrated, reduce these numbers. The test will fail if
 * violations INCREASE (preventing regressions) or if the baseline is
 * too generous (prompting you to tighten it after migration).
 *
 * maxWidth exceptions: These 5 values are element-specific widths (not page
 * layout widths) for things like filter dropdowns, action cards, and gantt
 * chart labels. They don't map to layoutWidth tokens.
 */
const VIOLATION_BASELINES = {
  spacing: 0,
  borderRadius: 0,
  maxWidth: 0,
  typography: 0,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  property: string;
  value: string;
  category: "spacing" | "borderRadius" | "maxWidth" | "typography";
}

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsxFiles(fullPath));
    } else if (entry.isFile() && /\.(tsx?|ts)$/.test(entry.name) && !entry.name.includes(".test.")) {
      results.push(fullPath);
    }
  }
  return results;
}

function categorizeProperty(prop: string): Violation["category"] | null {
  if (SPACING_PROPERTIES.includes(prop)) return "spacing";
  if (BORDER_RADIUS_PROPERTIES.includes(prop)) return "borderRadius";
  if (LAYOUT_WIDTH_PROPERTIES.includes(prop)) return "maxWidth";
  if (TYPOGRAPHY_PROPERTIES.includes(prop)) return "typography";
  return null;
}

/**
 * Scans a file for hardcoded numeric values in style properties.
 * Detects patterns like: `propertyName: 16` or `propertyName: 16,`
 * Skips lines that already use token references.
 */
function scanFileForViolations(filePath: string, content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split("\n");
  const relativePath = path.relative(path.resolve(__dirname, "../../.."), filePath);

  // Build a combined regex for all target properties
  const allTargetProperties = [
    ...SPACING_PROPERTIES,
    ...BORDER_RADIUS_PROPERTIES,
    ...LAYOUT_WIDTH_PROPERTIES,
    ...TYPOGRAPHY_PROPERTIES,
  ];

  // Match: propertyName: <number> (with optional trailing comma/semicolon)
  const propertyPattern = new RegExp(
    `\\b(${allTargetProperties.join("|")})\\s*:\\s*(-?\\d+\\.?\\d*)\\s*[,;}\\n]`,
    "g"
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;

    // Skip lines that are clearly using tokens (token references)
    if (line.includes("spacing.") || line.includes("borderRadius.") ||
        line.includes("layoutWidth.") || line.includes("typography.") ||
        line.includes("pageHeader.") ||
        line.includes("typographyStyle")) continue;

    // Skip lines with template literals using tokens
    if (/\$\{.*(?:spacing|borderRadius|layoutWidth|typography)/.test(line)) continue;

    // Skip lines that reference theme style objects (already using tokens indirectly)
    if (line.includes("...pageStyle") || line.includes("...toolbarStyle") ||
        line.includes("...cardStyle") || line.includes("...headingStyle")) continue;

    // Reset regex lastIndex for each line
    propertyPattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = propertyPattern.exec(line)) !== null) {
      const property = match[1];
      const rawValue = match[2];
      const numericValue = parseFloat(rawValue);

      // Skip always-allowed values
      if (ALWAYS_ALLOWED_VALUES.includes(numericValue)) continue;

      // Skip exempt properties (shouldn't match but just in case)
      if (EXEMPT_PROPERTIES.includes(property)) continue;

      // Skip if the line contains a calc expression
      if (line.includes("calc(")) continue;

      const category = categorizeProperty(property);
      if (category) {
        violations.push({
          file: relativePath,
          line: i + 1,
          property,
          value: rawValue,
          category,
        });
      }
    }
  }

  return violations;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Token Adoption Compliance - src/pages/", () => {
  const files = getAllTsxFiles(PAGES_DIR);

  it("should find page files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("should not have MORE hardcoded spacing values than baseline (Requirement 7.1)", () => {
    const allViolations: Violation[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const violations = scanFileForViolations(file, content).filter(
        (v) => v.category === "spacing"
      );
      allViolations.push(...violations);
    }

    // Ratchet: violations must not increase beyond baseline
    expect(
      allViolations.length,
      `Spacing violations: ${allViolations.length}/${VIOLATION_BASELINES.spacing}. ` +
      `New hardcoded spacing values were introduced. Use spacing tokens instead. ` +
      `If violations decreased, consider tightening VIOLATION_BASELINES.spacing.`
    ).toBeLessThanOrEqual(VIOLATION_BASELINES.spacing);
  });

  it("should not have MORE hardcoded borderRadius values than baseline (Requirement 7.2)", () => {
    const allViolations: Violation[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const violations = scanFileForViolations(file, content).filter(
        (v) => v.category === "borderRadius"
      );
      allViolations.push(...violations);
    }

    expect(
      allViolations.length,
      `BorderRadius violations: ${allViolations.length}/${VIOLATION_BASELINES.borderRadius}. ` +
      `New hardcoded borderRadius values were introduced. Use borderRadius tokens instead. ` +
      `If violations decreased, consider tightening VIOLATION_BASELINES.borderRadius.`
    ).toBeLessThanOrEqual(VIOLATION_BASELINES.borderRadius);
  });

  it("should not have MORE hardcoded maxWidth values than baseline (Requirement 7.3)", () => {
    const allViolations: Violation[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const violations = scanFileForViolations(file, content).filter(
        (v) => v.category === "maxWidth"
      );
      allViolations.push(...violations);
    }

    expect(
      allViolations.length,
      `MaxWidth violations: ${allViolations.length}/${VIOLATION_BASELINES.maxWidth}. ` +
      `New hardcoded maxWidth values were introduced. Use layoutWidth tokens instead. ` +
      `If violations decreased, consider tightening VIOLATION_BASELINES.maxWidth.`
    ).toBeLessThanOrEqual(VIOLATION_BASELINES.maxWidth);
  });

  it("should not have MORE hardcoded typography values than baseline (Requirement 7.4)", () => {
    const allViolations: Violation[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const violations = scanFileForViolations(file, content).filter(
        (v) => v.category === "typography"
      );
      allViolations.push(...violations);
    }

    expect(
      allViolations.length,
      `Typography violations: ${allViolations.length}/${VIOLATION_BASELINES.typography}. ` +
      `New hardcoded typography values were introduced. Use typography tokens instead. ` +
      `If violations decreased, consider tightening VIOLATION_BASELINES.typography.`
    ).toBeLessThanOrEqual(VIOLATION_BASELINES.typography);
  });

  it("should not exceed total violation baseline across all categories", () => {
    const allViolations: Violation[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      allViolations.push(...scanFileForViolations(file, content));
    }

    const TOTAL_BASELINE =
      VIOLATION_BASELINES.spacing +
      VIOLATION_BASELINES.borderRadius +
      VIOLATION_BASELINES.maxWidth +
      VIOLATION_BASELINES.typography;

    expect(
      allViolations.length,
      `Total violations: ${allViolations.length}/${TOTAL_BASELINE} ` +
      `(spacing: ${allViolations.filter((v) => v.category === "spacing").length}, ` +
      `borderRadius: ${allViolations.filter((v) => v.category === "borderRadius").length}, ` +
      `maxWidth: ${allViolations.filter((v) => v.category === "maxWidth").length}, ` +
      `typography: ${allViolations.filter((v) => v.category === "typography").length}, ` +
      `files scanned: ${files.length})`
    ).toBeLessThanOrEqual(TOTAL_BASELINE);
  });
});


// ─── Runtime Theme Mirror Tests ──────────────────────────────────────────────

/**
 * Verifies that the JavaScript token mirror stays aligned with the runtime
 * values defined by tailwind.css @theme.
 *
 * **Validates: Requirements 7.1**
 */

const EXPECTED_SPACING: Record<string, number> = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
};

const EXPECTED_BORDER_RADIUS: Record<string, string> = {
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "12px",
  full: "999px",
};

const EXPECTED_TYPOGRAPHY: Record<string, { fontSize: number; fontWeight: number; lineHeight: number }> = {
  display: { fontSize: 16, fontWeight: 700, lineHeight: 1.35 },
  h1: { fontSize: 16, fontWeight: 600, lineHeight: 1.35 },
  h2: { fontSize: 12, fontWeight: 600, lineHeight: 1.4 },
  body: { fontSize: 12, fontWeight: 400, lineHeight: 1.4 },
  caption: { fontSize: 10, fontWeight: 400, lineHeight: 1.35 },
  micro: { fontSize: 10, fontWeight: 400, lineHeight: 1.35 },
  dataMono: { fontSize: 12, fontWeight: 500, lineHeight: 1.4 },
};

const EXPECTED_LAYOUT_WIDTH: Record<string, number> = {
  narrow: 720,
  medium: 960,
  wide: 1280,
  horizontalPadding: 24,
};

const spacingKeys = Object.keys(EXPECTED_SPACING) as SpacingKey[];
const borderRadiusKeys = Object.keys(EXPECTED_BORDER_RADIUS) as BorderRadiusKey[];
const typographyKeys = Object.keys(EXPECTED_TYPOGRAPHY) as TypographyKey[];
const layoutWidthKeys = Object.keys(EXPECTED_LAYOUT_WIDTH) as (keyof typeof layoutWidth)[];

describe("JavaScript tokens mirror runtime @theme values", () => {
  it("spacing token values match the runtime scale", () => {
    for (const key of spacingKeys) {
      expect(spacing[key]).toBe(EXPECTED_SPACING[key]);
    }
  });

  it("spacing token has not lost any existing keys", () => {
    for (const key of spacingKeys) {
      expect(spacing).toHaveProperty(key);
    }
  });

  it("borderRadius token values match the runtime scale", () => {
    for (const key of borderRadiusKeys) {
      expect(borderRadius[key]).toBe(EXPECTED_BORDER_RADIUS[key]);
    }
  });

  it("borderRadius token has not lost any existing keys", () => {
    for (const key of borderRadiusKeys) {
      expect(borderRadius).toHaveProperty(key);
    }
  });

  it("typography token values match the runtime scale", () => {
    for (const key of typographyKeys) {
      const actual = typography[key];
      const expected = EXPECTED_TYPOGRAPHY[key];
      expect(actual.fontSize).toBe(expected.fontSize);
      expect(actual.fontWeight).toBe(expected.fontWeight);
      expect(actual.lineHeight).toBe(expected.lineHeight);
    }
  });

  it("typography token has not lost any existing keys", () => {
    for (const key of typographyKeys) {
      expect(typography).toHaveProperty(key);
    }
  });

  it("layoutWidth token values match the runtime scale", () => {
    for (const key of layoutWidthKeys) {
      expect(layoutWidth[key]).toBe(EXPECTED_LAYOUT_WIDTH[key]);
    }
  });

  it("layoutWidth token has not lost any existing keys", () => {
    for (const key of layoutWidthKeys) {
      expect(layoutWidth).toHaveProperty(key);
    }
  });
});
