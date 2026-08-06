import {
  isSameDay,
  startOfDay,
  startOfWeek,
  type GanttColumn,
  type TimelineScale,
} from "../../../domain/timeline/dateUtils";

/**
 * 0-based index of the column that contains "now", or null if outside the axis.
 * - day: current hour when rangeStart is today
 * - week / month: column.day matching today
 * - quarter: week column whose week contains today
 * - year: month column matching today's month
 */
export function findGanttTodayColumnIndex(
  columns: GanttColumn[],
  timeScale: TimelineScale,
  rangeStart: Date,
  now: Date = new Date(),
): number | null {
  if (columns.length === 0) return null;

  if (timeScale === "day") {
    if (!isSameDay(rangeStart, now)) return null;
    const hour = now.getHours();
    return hour >= 0 && hour < columns.length ? hour : null;
  }

  if (timeScale === "year") {
    const todayMonth = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    for (let i = 0; i < columns.length; i++) {
      const day = columns[i].day;
      if (!day) continue;
      if (
        day.getFullYear() === todayMonth.getFullYear() &&
        day.getMonth() === todayMonth.getMonth()
      ) {
        return i;
      }
    }
    return null;
  }

  if (timeScale === "quarter") {
    const todayWeek = startOfWeek(now);
    for (let i = 0; i < columns.length; i++) {
      const day = columns[i].day;
      if (!day) continue;
      if (isSameDay(startOfWeek(day), todayWeek)) return i;
    }
    return null;
  }

  // week / month
  for (let i = 0; i < columns.length; i++) {
    const day = columns[i].day;
    if (day && isSameDay(day, now)) return i;
  }
  return null;
}
