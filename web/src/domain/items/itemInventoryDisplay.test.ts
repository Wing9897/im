import { describe, expect, it } from "vitest";
import {
  formatItemPrice,
  formatItemQuantityUnit,
  itemInventorySummary,
  parseOptionalNumberInput,
} from "./itemInventoryDisplay";

describe("itemInventoryDisplay", () => {
  it("formats quantity with unit", () => {
    expect(formatItemQuantityUnit(3, "盒")).toBe("× 3 盒");
    expect(formatItemQuantityUnit(1.5, "kg")).toBe("× 1.5 kg");
    expect(formatItemQuantityUnit(2, null)).toBe("× 2");
    expect(formatItemQuantityUnit(null, "盒")).toBeNull();
  });

  it("formats price with $ prefix", () => {
    expect(formatItemPrice(1280)).toBe("$ 1,280");
    expect(formatItemPrice(42.5)).toBe("$ 42.50");
    expect(formatItemPrice(null)).toBeNull();
  });

  it("builds combined inventory summary", () => {
    expect(
      itemInventorySummary({ quantity: 3, unit: "盒", price: 1280 }),
    ).toBe("× 3 盒 · $ 1,280");
    expect(itemInventorySummary({ quantity: null, unit: null, price: null })).toBeNull();
  });

  it("parses optional numeric input", () => {
    expect(parseOptionalNumberInput("")).toBeNull();
    expect(parseOptionalNumberInput("  2.5 ")).toBe(2.5);
  });
});
