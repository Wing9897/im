import { describe, expect, it } from "vitest";

import {
  calculateAxisBarLayout,
  cellSpanToCssGridColumns,
  cellSpanToPercent,
  clipIntervalToAxis,
  GANTT_HOUR_MS,
  msRangeToCellSpan,
} from "./ganttTimeGeometry";

describe("ganttTimeGeometry", () => {
  const axisStart = Date.UTC(2025, 0, 15, 0, 0, 0);
  const axisEnd = axisStart + 24 * GANTT_HOUR_MS;

  it("clips intervals to the axis and rejects non-overlaps", () => {
    expect(
      clipIntervalToAxis(axisStart - GANTT_HOUR_MS, axisStart + GANTT_HOUR_MS, axisStart, axisEnd),
    ).toEqual({ clippedStart: axisStart, clippedEnd: axisStart + GANTT_HOUR_MS });
    expect(clipIntervalToAxis(axisEnd, axisEnd + GANTT_HOUR_MS, axisStart, axisEnd)).toBeNull();
  });

  it("maps ms ranges to at least one cell", () => {
    const span = msRangeToCellSpan(axisStart + 9 * GANTT_HOUR_MS, axisStart + 9 * GANTT_HOUR_MS, axisStart, GANTT_HOUR_MS, 24);
    expect(span).toEqual({ startCell: 9, endCell: 10 });
  });

  it("builds percent layout for board bars", () => {
    const layout = calculateAxisBarLayout(
      axisStart + 9 * GANTT_HOUR_MS,
      axisStart + 12 * GANTT_HOUR_MS,
      { start: axisStart, end: axisEnd, cellMs: GANTT_HOUR_MS, tickCount: 24 },
    );
    expect(layout).toMatchObject({ startCell: 9, endCell: 12 });
    expect(layout?.left).toBeCloseTo((9 / 24) * 100);
    expect(layout?.width).toBeCloseTo((3 / 24) * 100);
    expect(cellSpanToPercent(9, 12, 24)).toEqual({ left: layout!.left, width: layout!.width });
    expect(cellSpanToCssGridColumns({ startCell: 9, endCell: 12 })).toEqual({
      startColumn: 10,
      endColumn: 12,
    });
  });
});
