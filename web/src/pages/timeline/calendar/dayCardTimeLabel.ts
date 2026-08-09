import type { TimelineItem } from "../../../types";
import { formatTimeLabel } from "../../../domain/timeline/dateUtils";

/** Day/week card time chip: all-day label, start-only, or start–end range. */
export function dayCardTimeLabel(
  event: TimelineItem,
  allDayLabel: string,
): string {
  if (event.isAllDay) return allDayLabel;
  const start = formatTimeLabel(new Date(event.startTime));
  if (!event.endTime) return start;
  const endDate = new Date(event.endTime);
  if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= new Date(event.startTime).getTime()) {
    return start;
  }
  return `${start} – ${formatTimeLabel(endDate)}`;
}
