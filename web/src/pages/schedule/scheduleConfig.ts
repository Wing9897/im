export const SCHEDULE_PAGE_SIZE = 24;

export type ScheduleTab = "oneOff" | "recurring";

export function isScheduleTab(value: string | null): value is ScheduleTab {
  return value === "oneOff" || value === "recurring";
}
