import type { UserEvent } from "../../api/userEvents";
import type { AnalysisTask } from "../../types";
import { findActiveLinkedExpiryEvent } from "./linkedCalendarQuickCreate";
import { resolveItemCardExpiry, type ItemCardExpiry } from "./itemCardExpiry";
import { formatDateOnly, formatDateTime } from "../../utils/dateFormat";

export type LinkedCalendarRowBase = {
  id: string;
  title: string;
  detail: string;
  sortKey: string;
};

export type LinkedCalendarRow =
  | (LinkedCalendarRowBase & { kind: "oneOff"; event: UserEvent })
  | (LinkedCalendarRowBase & { kind: "recurring"; taskId: string });

export function formatLinkedEventWhen(event: UserEvent): string {
  const startMs = Date.parse(event.startTime);
  if (!Number.isFinite(startMs)) return event.startTime;
  if (event.isAllDay) return formatDateOnly(startMs) || event.startTime.slice(0, 10);
  return formatDateTime(startMs) || event.startTime;
}

export function expiryDateFromLinkedEvent(event: UserEvent | null): string | null {
  if (!event?.startTime?.trim()) return null;
  const startMs = Date.parse(event.startTime);
  if (Number.isFinite(startMs) && event.isAllDay) {
    return formatDateOnly(startMs) || event.startTime.slice(0, 10);
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(event.startTime.trim());
  return match?.[1] ?? null;
}

export function deriveLinkedExpiryPreview(
  activeExpiry: UserEvent | null,
  itemExpiresAt: string | null | undefined,
  remindBeforeDays: number | null | undefined,
): ItemCardExpiry {
  const fromEvent = expiryDateFromLinkedEvent(activeExpiry);
  const cached =
    typeof itemExpiresAt === "string" && itemExpiresAt.trim()
      ? itemExpiresAt.trim()
      : null;
  return resolveItemCardExpiry({
    expiresAt: fromEvent ?? cached,
    remindBeforeDays: remindBeforeDays ?? null,
  });
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

export function toLinkedRecurringRow(task: AnalysisTask): LinkedCalendarRow {
  return {
    kind: "recurring",
    id: `rs:${task.id}`,
    title: task.name,
    detail: task.scheduleRrule?.trim() || "RRULE",
    sortKey: String(task.createdAt || task.name),
    taskId: task.id,
  };
}

/** Merge one-off events + recurring tasks, excluding active expiry; sort by sortKey. */
export function mergeLinkedCalendarRows(
  events: readonly UserEvent[],
  recurring: readonly AnalysisTask[],
  expiryEvent: UserEvent | null = findActiveLinkedExpiryEvent(events),
): LinkedCalendarRow[] {
  const merged: LinkedCalendarRow[] = [
    ...events
      .filter((event) => !expiryEvent || event.id !== expiryEvent.id)
      .filter((event) => !event.dismissed)
      .map(toLinkedOneOffRow),
    ...recurring.map(toLinkedRecurringRow),
  ];
  merged.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return merged;
}

export function resolveActiveLinkedExpiry(events: readonly UserEvent[]): UserEvent | null {
  return findActiveLinkedExpiryEvent(events);
}
