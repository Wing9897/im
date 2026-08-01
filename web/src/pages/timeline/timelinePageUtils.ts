import type { TimelineItem } from "../../types";
import { addDays } from "../../domain/timeline/dateUtils";

/**
 * Compute sidebar events: if a day is focused, filter to that day only;
 * otherwise return all range events.
 */
export function computeSidebarEvents(
  focusedDay: Date | null,
  rangeEvents: TimelineItem[],
): TimelineItem[] {
  if (!focusedDay) return rangeEvents;
  const dayEnd = addDays(focusedDay, 1);
  return rangeEvents.filter((event) => {
    const start = new Date(event.startTime);
    const end = event.endTime ? new Date(event.endTime) : start;
    return start < dayEnd && end >= focusedDay;
  });
}
