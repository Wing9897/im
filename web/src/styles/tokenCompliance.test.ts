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
 * Zero-tolerance ratchet: any new hardcoded value fails the suite.
 *
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

/** Allowed hardcoded counts in `src/pages/` (must stay at zero). */
const VIOLATION_LIMITS = {
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

  it("should not have hardcoded spacing values (Requirement 7.1)", () => {
    const allViolations: Violation[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const violations = scanFileForViolations(file, content).filter(
        (v) => v.category === "spacing"
      );
      allViolations.push(...violations);
    }

    expect(
      allViolations.length,
      `Spacing violations: ${allViolations.length}. Use spacing tokens instead.`,
    ).toBeLessThanOrEqual(VIOLATION_LIMITS.spacing);
  });

  it("should not have hardcoded borderRadius values (Requirement 7.2)", () => {
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
      `BorderRadius violations: ${allViolations.length}. Use borderRadius tokens instead.`,
    ).toBeLessThanOrEqual(VIOLATION_LIMITS.borderRadius);
  });

  it("should not have hardcoded maxWidth values (Requirement 7.3)", () => {
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
      `MaxWidth violations: ${allViolations.length}. Use layoutWidth tokens instead.`,
    ).toBeLessThanOrEqual(VIOLATION_LIMITS.maxWidth);
  });

  it("should not have hardcoded typography values (Requirement 7.4)", () => {
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
      `Typography violations: ${allViolations.length}. Use typography tokens instead.`,
    ).toBeLessThanOrEqual(VIOLATION_LIMITS.typography);
  });

  it("should not exceed total violation limit across all categories", () => {
    const allViolations: Violation[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      allViolations.push(...scanFileForViolations(file, content));
    }

    const TOTAL_LIMIT =
      VIOLATION_LIMITS.spacing +
      VIOLATION_LIMITS.borderRadius +
      VIOLATION_LIMITS.maxWidth +
      VIOLATION_LIMITS.typography;

    expect(
      allViolations.length,
      `Total violations: ${allViolations.length}/${TOTAL_LIMIT} ` +
      `(spacing: ${allViolations.filter((v) => v.category === "spacing").length}, ` +
      `borderRadius: ${allViolations.filter((v) => v.category === "borderRadius").length}, ` +
      `maxWidth: ${allViolations.filter((v) => v.category === "maxWidth").length}, ` +
      `typography: ${allViolations.filter((v) => v.category === "typography").length}, ` +
      `files scanned: ${files.length})`
    ).toBeLessThanOrEqual(TOTAL_LIMIT);
  });
});


// ─── Runtime Theme Mirror Tests ──────────────────────────────────────────────

/**
 * Verifies that the JavaScript token mirror stays aligned with the runtime
 * values defined by tailwind.css @theme.
 *
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
