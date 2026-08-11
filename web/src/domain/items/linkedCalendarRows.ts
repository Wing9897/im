import type { UserEvent } from "../../api/userEvents";
import type { RecurringSeries } from "../../types/recurring";
import { isExpiresCalendarEvent } from "../timeline/userEventCalendarKind";
import { formatDateOnly, formatDateTime } from "../../utils/dateFormat";

export type LinkedCalendarRowBase = {
  id: string;
  title: string;
  detail: string;
  sortKey: string;
};

export type LinkedCalendarRow =
  | (LinkedCalendarRowBase & { kind: "oneOff"; event: UserEvent })
  | (LinkedCalendarRowBase & { kind: "recurring"; seriesId: string });

export function formatLinkedEventWhen(event: UserEvent): string {
  const startMs = Date.parse(event.startTime);
  if (!Number.isFinite(startMs)) return event.startTime;
  if (event.isAllDay) return formatDateOnly(startMs) || event.startTime.slice(0, 10);
  return formatDateTime(startMs) || event.startTime;
}

export function toLinkedOneOffRow(event: UserEvent): LinkedCalendarRow {
  return {
    kind: "oneOff",
    id: `ue:${event.id}`,
    title: event.title,
    detail: formatLinkedEventWhen(event),
    sortKey: String(event.startTime),
    event,
  };
}

export function toLinkedRecurringRow(series: RecurringSeries): LinkedCalendarRow {
  return {
    kind: "recurring",
    id: `rs:${series.id}`,
    title: series.name,
    detail: series.rrule.trim() || "RRULE",
    sortKey: String(series.createdAt || series.name),
    seriesId: series.id,
  };
}

/** Merge one-off events + recurring series (all kinds share one chip list). */
export function mergeLinkedCalendarRows(
  events: readonly UserEvent[],
  recurring: readonly RecurringSeries[],
): LinkedCalendarRow[] {
  const merged: LinkedCalendarRow[] = [
    ...events.filter((event) => !event.dismissed).map(toLinkedOneOffRow),
    ...recurring.map(toLinkedRecurringRow),
  ];
  merged.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return merged;
}

/** Count active (non-dismissed) ``kind=expires`` milestones — drives Primary badge. */
export function countActiveLinkedExpiryEvents(events: readonly UserEvent[]): number {
  return events.filter((event) => !event.dismissed && isExpiresCalendarEvent(event)).length;
}
