import { describe, expect, it } from "vitest";
import { formatItemQuantityUnit, itemInventorySummary } from "./itemInventoryDisplay";

describe("itemInventoryDisplay", () => {
  it("formats quantity with optional unit", () => {
    expect(formatItemQuantityUnit(3, "盒")).toBe("× 3 盒");
    expect(formatItemQuantityUnit(1.5, null)).toBe("× 1.5");
    expect(formatItemQuantityUnit(null, "盒")).toBeNull();
  });

  it("summarizes quantity/unit only", () => {
    expect(itemInventorySummary({ quantity: 3, unit: "盒" })).toBe("× 3 盒");
    expect(itemInventorySummary({ quantity: null, unit: null })).toBeNull();
  });
});
