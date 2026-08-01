import {
  addDays,
  buildQuarterWeeks,
  buildYearGanttColumns,
  startOfMonth,
  startOfQuarter,
  type GanttColumn,
  type TimelineScale,
} from "../../domain/timeline/dateUtils";

/** Build gantt column headers for the active time scale and cursor. */
export function buildGanttColumns(
  timeScale: TimelineScale,
  timeCursor: Date,
  monthCursor: Date,
  weekDays: Date[],
): GanttColumn[] {
  if (timeScale === "day") {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: `hour-${hour}`,
      label: `${String(hour).padStart(2, "0")}`,
    }));
  }
  if (timeScale === "quarter") {
    const qStart = startOfQuarter(timeCursor);
    const weeks = buildQuarterWeeks(qStart);
    return weeks.map((weekStart) => ({
      key: weekStart.toISOString(),
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      day: weekStart,
    }));
  }
  if (timeScale === "year") {
    return buildYearGanttColumns(timeCursor);
  }
  const days =
    timeScale === "week"
      ? weekDays
      : Array.from(
          {
            length: new Date(
              monthCursor.getFullYear(),
              monthCursor.getMonth() + 1,
              0,
            ).getDate(),
          },
          (_, index) => addDays(startOfMonth(monthCursor), index),
        );
  return days.map((day) => ({
    key: day.toISOString(),
    label:
      timeScale === "week"
        ? `${day.getMonth() + 1}/${day.getDate()}`
        : `${day.getDate()}`,
    day,
  }));
}
