/**
 * Shared test helpers for timeline page tests.
 */
import type { TimelineItem } from "../types";
import type { GanttColumn } from "../domain/timeline/dateUtils";
import { makeTimelineItem } from "./analysisEventFixtures";

/** Creates a TimelineItem with sensible defaults. */
export function makeEvent(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return makeTimelineItem({
    id: "evt-1",
    taskId: "task-1",
    taskName: "Meeting task",
    batchId: "batch-1",
    version: 1,
    title: "Kickoff Meeting",
    body: "Kickoff meeting summary",
    startTime: "2025-01-15T09:00:00Z",
    endTime: "2025-01-15T10:00:00Z",
    location: "HK Office",
    participants: ["Alice", "Bob"],
    sourceMessageId: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  });
}

/** Creates 24 hour-based GanttColumns for day scale. */
export function makeDayColumns(): GanttColumn[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    key: `hour-${hour}`,
    label: String(hour).padStart(2, "0"),
  }));
}

/** Creates 7 day-based GanttColumns for week scale. */
export function makeWeekColumns(rangeStart: Date): GanttColumn[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(rangeStart);
    day.setDate(day.getDate() + i);
    return {
      key: day.toISOString(),
      label: `${day.getMonth() + 1}/${day.getDate()}`,
      day,
    };
  });
}

/** Creates day-based GanttColumns for a full month. */
export function makeMonthColumns(year: number, month: number): GanttColumn[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = new Date(year, month, i + 1);
    return {
      key: day.toISOString(),
      label: `${i + 1}`,
      day,
    };
  });
}
