import type { UserEvent } from "../../api/userEvents";
import type { ScheduleRecurringItem } from "./useScheduleRecurringFeed";

export type ScheduleListEntry =
  | { kind: "oneOff"; event: UserEvent }
  | { kind: "recurring"; series: ScheduleRecurringItem };

function entrySortKey(entry: ScheduleListEntry): string {
  if (entry.kind === "oneOff") {
    return entry.event.updatedAt || entry.event.createdAt || entry.event.startTime || entry.event.title;
  }
  return entry.series.updatedAt || entry.series.createdAt || entry.series.name;
}

/**
 * Manage-list one-offs: hide timeline-dismissed rows.
 * Schedule trash is REST hard-delete, but GET /user-events still returns rows
 * soft-dismissed from Timeline / Agent (`dismissed: true` via timeline_dismissals).
 */
export function activeScheduleOneOffs(items: readonly UserEvent[]): UserEvent[] {
  return items.filter((item) => !item.dismissed);
}

/** Merge one-off + recurring into one management list (newest activity first). */
export function mergeScheduleList(
  oneOff: readonly UserEvent[],
  recurring: readonly ScheduleRecurringItem[],
): ScheduleListEntry[] {
  const entries: ScheduleListEntry[] = [
    ...activeScheduleOneOffs(oneOff).map((event) => ({ kind: "oneOff" as const, event })),
    ...recurring.map((series) => ({ kind: "recurring" as const, series })),
  ];
  entries.sort((a, b) => entrySortKey(b).localeCompare(entrySortKey(a)));
  return entries;
}
