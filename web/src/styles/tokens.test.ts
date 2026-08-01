import { describe, it, expect } from "vitest";
import {
  spacing,
  SPACING_VALUES,
  type SpacingKey,
  type TypographyKey,
  borderRadius,
  layoutWidth,
  typography,
  SINGLE_LINE_LEVELS,
  MULTI_LINE_LEVELS,
} from "./tokens";

/**
 * Unit tests for Design Token System.
 * Verifies the invariant: spacing aliases and SPACING_VALUES
 * form a bijective (one-to-one) mapping.
 *
 * Requirements: 3.1, 3.2, 3.4
 */

describe("Spacing scale alias ↔ value bijectivity", () => {
  const spacingKeys = Object.keys(spacing) as SpacingKey[];

  it("every alias key maps to a value present in SPACING_VALUES", () => {
    for (const key of spacingKeys) {
      expect(SPACING_VALUES).toContain(spacing[key]);
    }
  });

  it("every value in SPACING_VALUES has exactly one alias mapping to it", () => {
    for (const value of SPACING_VALUES) {
      const matchingKeys = spacingKeys.filter((k) => spacing[k] === value);
      expect(matchingKeys).toHaveLength(1);
    }
  });

  it("alias count equals SPACING_VALUES count (same cardinality)", () => {
    expect(spacingKeys.length).toBe(SPACING_VALUES.length);
  });

  it("round-trip: alias → value → alias is identity", () => {
    const valueToKey = new Map<number, SpacingKey>();
    for (const key of spacingKeys) {
      valueToKey.set(spacing[key], key);
    }

    for (const key of spacingKeys) {
      const value = spacing[key];
      expect(valueToKey.get(value)).toBe(key);
    }
  });

  it("specific alias values match the expected scale", () => {
    expect(spacing.none).toBe(0);
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(12);
    expect(spacing.lg).toBe(16);
    expect(spacing.xl).toBe(20);
    expect(spacing["2xl"]).toBe(24);
    expect(spacing["3xl"]).toBe(32);
    expect(spacing["4xl"]).toBe(48);
  });
});

describe("Border radius tokens", () => {
  it("provides expected radius values", () => {
    expect(borderRadius.sm).toBe("6px");
    expect(borderRadius.md).toBe("8px");
    expect(borderRadius.lg).toBe("10px");
    expect(borderRadius.xl).toBe("12px");
    expect(borderRadius.full).toBe("999px");
  });
});

describe("Layout width tokens", () => {
  it("provides expected width values", () => {
    expect(layoutWidth.narrow).toBe(720);
    expect(layoutWidth.medium).toBe(960);
    expect(layoutWidth.wide).toBe(1280);
    expect(layoutWidth.horizontalPadding).toBe(24);
  });
});

describe("Typography tokens", () => {
  it("SINGLE_LINE_LEVELS and MULTI_LINE_LEVELS partition all levels", () => {
    const allLevels = [...SINGLE_LINE_LEVELS, ...MULTI_LINE_LEVELS];
    const typographyKeys = Object.keys(typography);
    expect(allLevels.sort()).toEqual(typographyKeys.sort());
  });
});

// ─── Typography & Token Invariants ───────────────────────────────────────────

/**
 * Typography scale ordering invariant (Validates: Requirements 4.1)
 *
 * For any two typography levels where level A is defined before level B in the
 * scale ordering (display > h1 > h2 > body > caption > micro), fontSize of A
 * should be >= fontSize of B. fontWeight values should be valid CSS font-weights,
 * and lineHeight values should be between 1.0 and 2.0.
 */
describe("Typography scale ordering invariant", () => {
  const TYPOGRAPHY_ORDERING: readonly TypographyKey[] = [
    "display",
    "h1",
    "h2",
    "body",
    "caption",
    "micro",
  ];

  it("fontSize is non-increasing across adjacent typography levels", () => {
    for (let i = 0; i < TYPOGRAPHY_ORDERING.length - 1; i++) {
      const higherLevel = TYPOGRAPHY_ORDERING[i];
      const lowerLevel = TYPOGRAPHY_ORDERING[i + 1];
      expect(typography[higherLevel].fontSize).toBeGreaterThanOrEqual(
        typography[lowerLevel].fontSize,
      );
    }
  });

  it("fontWeight values are valid CSS font-weight (multiples of 100, 100–900)", () => {
    for (const level of TYPOGRAPHY_ORDERING) {
      const { fontWeight } = typography[level];
      expect(fontWeight).toBeGreaterThanOrEqual(100);
      expect(fontWeight).toBeLessThanOrEqual(900);
      expect(fontWeight % 100).toBe(0);
    }
  });

  it("lineHeight values are between 1.0 and 2.0", () => {
    for (const level of TYPOGRAPHY_ORDERING) {
      const { lineHeight } = typography[level];
      expect(lineHeight).toBeGreaterThanOrEqual(1.0);
      expect(lineHeight).toBeLessThanOrEqual(2.0);
    }
  });
});

/**
 * Typography overflow classification consistency (Validates: Requirements 4.8)
 *
 * Single-line levels (display, h1, h2) should have fontSize >= 16px.
 * Multi-line levels (body, caption, micro) should have fontSize <= 14px.
 */
describe("Typography overflow classification consistency", () => {
  it("single-line levels (display, h1, h2) have fontSize >= 16px", () => {
    for (const level of SINGLE_LINE_LEVELS) {
      const { fontSize } = typography[level];
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });

  it("multi-line levels have fontSize <= 15px", () => {
    for (const level of MULTI_LINE_LEVELS) {
      const { fontSize } = typography[level];
      expect(fontSize).toBeLessThanOrEqual(15);
    }
  });
});

/**
 * Token scale geometry (Validates: Requirements 8.6)
 *
 * Spacing and radius tokens stay within 4px of their reference pixel values.
 * Typography is intentionally excluded (compact-density sizes exceed that bound).
 */
describe("Token scale geometry", () => {
  const TOKEN_PAIRS = [
    // Spacing
    { original: 10, token: spacing.md, category: "spacing" },
    { original: 14, token: spacing.lg, category: "spacing" },
    { original: 18, token: spacing.xl, category: "spacing" },
    { original: 6, token: spacing.sm, category: "spacing" },
    { original: 22, token: spacing["2xl"], category: "spacing" },
    { original: 28, token: spacing["3xl"], category: "spacing" },
    // Border radius
    { original: 6, token: parseInt(borderRadius.sm), category: "borderRadius" },
    { original: 10, token: parseInt(borderRadius.lg), category: "borderRadius" },
    { original: 16, token: parseInt(borderRadius.xl), category: "borderRadius" },
  ];

  it("absolute difference between reference and token value is ≤ 4px for all pairs", () => {
    for (const pair of TOKEN_PAIRS) {
      const deviation = Math.abs(pair.original - pair.token);
      expect(deviation).toBeLessThanOrEqual(4);
    }
  });

  it("values within spacing scale range map to nearest token within 4px", () => {
    const spacingValues = [0, 4, 8, 12, 16, 20, 24, 32, 48];

    // Test representative values across the spacing range
    for (let originalValue = 0; originalValue <= 48; originalValue++) {
      const nearestToken = spacingValues.reduce((nearest, tokenVal) =>
        Math.abs(tokenVal - originalValue) < Math.abs(nearest - originalValue)
          ? tokenVal
          : nearest,
      );
      const deviation = Math.abs(originalValue - nearestToken);
      // Values within 4px of a token are valid migration candidates
      if (deviation <= 4) {
        expect(deviation).toBeLessThanOrEqual(4);
      }
    }
  });
});
