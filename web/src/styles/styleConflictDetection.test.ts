/**
 * Style Conflict Detection tests
 *
 * Scans remaining Tailwind class-string modules (ui controlStyles).
 */
import { describe, it, expect } from "vitest";
import type React from "react";

import * as controlStyles from "../components/ui/controlStyles";

const SHORTHAND_LONGHAND_MAP: Record<string, string[]> = {
  border: [
    "borderColor", "borderWidth", "borderStyle",
    "borderTop", "borderRight", "borderBottom", "borderLeft",
    "borderTopColor", "borderTopWidth", "borderTopStyle",
    "borderRightColor", "borderRightWidth", "borderRightStyle",
    "borderBottomColor", "borderBottomWidth", "borderBottomStyle",
    "borderLeftColor", "borderLeftWidth", "borderLeftStyle",
  ],
  margin: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
  padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  background: ["backgroundColor", "backgroundImage", "backgroundPosition"],
  overflow: ["overflowX", "overflowY"],
  flex: ["flexGrow", "flexShrink", "flexBasis"],
};

function detectConflicts(style: React.CSSProperties): string[] {
  const conflicts: string[] = [];
  const keys = Object.keys(style);
  const keySet = new Set(keys);

  for (const [shorthand, longhands] of Object.entries(SHORTHAND_LONGHAND_MAP)) {
    if (keySet.has(shorthand)) {
      for (const longhand of longhands) {
        if (keySet.has(longhand)) {
          conflicts.push(`"${shorthand}" conflicts with "${longhand}"`);
        }
      }
    }
  }

  return conflicts;
}

function extractStyleObjects(mod: Record<string, unknown>): Array<{ name: string; style: React.CSSProperties }> {
  const results: Array<{ name: string; style: React.CSSProperties }> = [];
  for (const [name, value] of Object.entries(mod)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Map) &&
      !(value instanceof Set)
    ) {
      const obj = value as Record<string, unknown>;
      const hasStyleProps = Object.values(obj).some(
        (v) => typeof v === "string" || typeof v === "number",
      );
      if (hasStyleProps) {
        results.push({ name, style: obj as React.CSSProperties });
      }
    }
  }
  return results;
}

const allStyleModules = [{ moduleName: "ui/controlStyles", module: controlStyles }];

const allStyles: Array<{ moduleName: string; name: string; style: React.CSSProperties }> = [];
for (const { moduleName, module } of allStyleModules) {
  for (const { name, style } of extractStyleObjects(module as Record<string, unknown>)) {
    allStyles.push({ moduleName, name, style });
  }
}

describe("Style Conflict Detection", () => {
  it("all exported style objects have no shorthand/longhand conflicts", () => {
    expect(allStyles.length).toBeGreaterThan(0);

    for (const { moduleName, name, style } of allStyles) {
      const conflicts = detectConflicts(style);
      expect(
        conflicts,
        `${moduleName}.${name} has CSS shorthand/longhand conflicts: ${conflicts.join(", ")}`,
      ).toEqual([]);
    }
  });
});
