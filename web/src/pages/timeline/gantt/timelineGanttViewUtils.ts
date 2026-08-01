import type { TimelineScale } from "../../../domain/timeline/dateUtils";

/**
 * Compute the end of the visible range based on timeScale and rangeStart.
 */
export function computeRangeEnd(
  timeScale: TimelineScale,
  rangeStart: Date,
  columnCount: number,
): Date {
  if (timeScale === "day") {
    const end = new Date(rangeStart);
    end.setHours(end.getHours() + 24);
    return end;
  }
  if (timeScale === "quarter") {
    // Each column is one week
    const end = new Date(rangeStart);
    end.setDate(end.getDate() + columnCount * 7);
    return end;
  }
  if (timeScale === "year") {
    // Each column is one month
    return new Date(rangeStart.getFullYear(), rangeStart.getMonth() + columnCount, 1);
  }
  // Week/month: each column is one day
  const end = new Date(rangeStart);
  end.setDate(end.getDate() + columnCount);
  return end;
}
