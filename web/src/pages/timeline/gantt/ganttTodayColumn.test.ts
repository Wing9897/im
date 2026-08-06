import { describe, expect, it } from "vitest";

import {
  buildYearGanttColumns,
  startOfQuarter,
  type GanttColumn,
} from "../../../domain/timeline/dateUtils";
import { makeMonthColumns, makeWeekColumns } from "../../../test/timelineTestHelpers";
import { findGanttTodayColumnIndex } from "./ganttTodayColumn";

describe("findGanttTodayColumnIndex", () => {
  it("returns hour index on day scale when rangeStart is today", () => {
    const now = new Date(2026, 7, 6, 14, 30, 0);
    const columns: GanttColumn[] = Array.from({ length: 24 }, (_, hour) => ({
      key: `hour-${hour}`,
      label: String(hour).padStart(2, "0"),
    }));
    expect(
      findGanttTodayColumnIndex(columns, "day", new Date(2026, 7, 6), now),
    ).toBe(14);
  });

  it("returns null on day scale when viewing another day", () => {
    const now = new Date(2026, 7, 6, 14, 30, 0);
    const columns: GanttColumn[] = Array.from({ length: 24 }, (_, hour) => ({
      key: `hour-${hour}`,
      label: String(hour).padStart(2, "0"),
    }));
    expect(
      findGanttTodayColumnIndex(columns, "day", new Date(2026, 7, 5), now),
    ).toBeNull();
  });

  it("highlights today's day on month scale", () => {
    const now = new Date(2026, 0, 15, 10, 0, 0);
    const columns = makeMonthColumns(2026, 0);
    expect(findGanttTodayColumnIndex(columns, "month", columns[0].day!, now)).toBe(14);
  });

  it("highlights today's day on week scale", () => {
    const weekStart = new Date(2026, 0, 12); // Monday
    const now = new Date(2026, 0, 14, 9, 0, 0); // Wednesday
    const columns = makeWeekColumns(weekStart);
    expect(findGanttTodayColumnIndex(columns, "week", weekStart, now)).toBe(2);
  });

  it("highlights current month on year scale", () => {
    const now = new Date(2026, 2, 10); // March
    const columns = buildYearGanttColumns(new Date(2026, 0, 1));
    expect(findGanttTodayColumnIndex(columns, "year", columns[0].day!, now)).toBe(2);
  });

  it("highlights week containing today on quarter scale", () => {
    const quarterStart = startOfQuarter(new Date(2026, 0, 15));
    const now = new Date(2026, 0, 20);
    const columns: GanttColumn[] = Array.from({ length: 13 }, (_, i) => {
      const day = new Date(quarterStart);
      day.setDate(day.getDate() + i * 7);
      return { key: day.toISOString(), label: `${i}`, day };
    });
    const index = findGanttTodayColumnIndex(columns, "quarter", quarterStart, now);
    expect(index).not.toBeNull();
    expect(columns[index!].day).toBeDefined();
  });
});
