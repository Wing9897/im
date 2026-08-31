import { describe, expect, it } from "vitest";
import {
  SPLIT_DAY_POPOVER_EDGE,
  SPLIT_DAY_POPOVER_GAP,
  placeSplitDayPopover,
} from "./splitDayPopoverPlacement";

function box(top: number, left: number, width: number, height: number) {
  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
  };
}

describe("placeSplitDayPopover", () => {
  it("opens below and centers on the cell when there is room", () => {
    const placed = placeSplitDayPopover({
      anchor: box(100, 200, 40, 28),
      popoverWidth: 160,
      popoverHeight: 80,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(placed.placement).toBe("below");
    expect(placed.top).toBe(100 + 28 + SPLIT_DAY_POPOVER_GAP);
    expect(placed.left).toBe(200 + 20 - 80);
    expect(placed.maxHeight).toBe(80);
  });

  it("flips above when the last row has no room below", () => {
    const placed = placeSplitDayPopover({
      anchor: box(540, 200, 40, 28),
      popoverWidth: 160,
      popoverHeight: 80,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(placed.placement).toBe("above");
    expect(placed.top).toBe(540 - SPLIT_DAY_POPOVER_GAP - 80);
    expect(placed.maxHeight).toBe(80);
  });

  it("stays below on the first row when there is more room under the cell", () => {
    const placed = placeSplitDayPopover({
      anchor: box(12, 200, 40, 28),
      popoverWidth: 160,
      popoverHeight: 80,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(placed.placement).toBe("below");
    expect(placed.top).toBe(12 + 28 + SPLIT_DAY_POPOVER_GAP);
  });

  it("clamps to the left viewport edge", () => {
    const placed = placeSplitDayPopover({
      anchor: box(100, 4, 20, 28),
      popoverWidth: 160,
      popoverHeight: 80,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(placed.left).toBe(SPLIT_DAY_POPOVER_EDGE);
  });

  it("clamps to the right viewport edge", () => {
    const placed = placeSplitDayPopover({
      anchor: box(100, 780, 20, 28),
      popoverWidth: 160,
      popoverHeight: 80,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(placed.left).toBe(800 - 160 - SPLIT_DAY_POPOVER_EDGE);
  });

  it("caps maxHeight so many events scroll inside instead of clipping chrome", () => {
    const placed = placeSplitDayPopover({
      anchor: box(500, 200, 40, 28),
      popoverWidth: 160,
      popoverHeight: 192,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(placed.placement).toBe("above");
    const spaceAbove = 500 - SPLIT_DAY_POPOVER_EDGE - SPLIT_DAY_POPOVER_GAP;
    expect(placed.maxHeight).toBe(Math.min(192, spaceAbove));
    expect(placed.top).toBe(500 - SPLIT_DAY_POPOVER_GAP - placed.maxHeight);
    expect(placed.top).toBeGreaterThanOrEqual(SPLIT_DAY_POPOVER_EDGE);
  });
});
