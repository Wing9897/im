/**
 * Linked-calendar create/edit form initials for Items (開始 / 到期 / 購入 chips + add/edit).
 * Quick kinds are title (+ all-day) presets only — not distinct event kinds.
 */

import type { UserEvent } from "../../api/userEvents";
import { defaultCreateTimedRange, todayDateInput } from "../timeline/dateUtils";
import { toUserEventFormWorksetId } from "../timeline/userEvents";

export const LINKED_CALENDAR_QUICK_KINDS = ["start", "expires", "purchased"] as const;

export type LinkedCalendarQuickKind = (typeof LINKED_CALENDAR_QUICK_KINDS)[number];

/** Prefill shape accepted by ``UserEventDialog`` create/edit ``initial``. */
export type LinkedCalendarFormInitial = {
  title: string;
  worksetId: string;
  itemId: string;
  remindBeforeDays: string;
  isAllDay: boolean;
  startTime: string;
  /** Omitted for all-day create so valuesFromInitial keeps an inclusive single day. */
  endTime?: string;
  location?: string;
  body?: string;
};

/** i18n key under ``items`` for both chip label and prefilled title. */
export function linkedCalendarQuickLabelKey(
  kind: LinkedCalendarQuickKind,
): `quickLinkedCalendar.${LinkedCalendarQuickKind}` {
  return `quickLinkedCalendar.${kind}`;
}

/** True when the preset should open as an all-day event (到期). */
export function linkedCalendarQuickIsAllDay(kind: LinkedCalendarQuickKind): boolean {
  return kind === "expires";
}

/**
 * Build ``UserEventDialog`` create ``initial`` for a linked-calendar open,
 * optionally applying a quick-create title / all-day preset.
 */
export function buildLinkedCalendarCreateInitial(args: {
  itemId: string;
  worksetId: string;
  title?: string;
  kind?: LinkedCalendarQuickKind | null;
  now?: Date;
}): LinkedCalendarFormInitial {
  const worksetId = toUserEventFormWorksetId(args.worksetId);
  const title = (args.title ?? "").trim();
  const base = {
    title,
    worksetId,
    itemId: args.itemId,
    remindBeforeDays: "",
  };

  if (args.kind != null && linkedCalendarQuickIsAllDay(args.kind)) {
    // Omit endTime so valuesFromInitial uses the same inclusive day (not wire-exclusive).
    return {
      ...base,
      startTime: todayDateInput(args.now),
      isAllDay: true,
    };
  }

  const range = defaultCreateTimedRange(args.now);
  return {
    ...base,
    startTime: range.startTime,
    endTime: range.endTime,
    isAllDay: false,
  };
}

/** Build ``UserEventDialog`` edit ``initial`` from a linked one-off user event. */
export function buildLinkedCalendarEditInitial(args: {
  event: UserEvent;
  itemId: string;
  fallbackWorksetId: string;
}): LinkedCalendarFormInitial {
  const { event, itemId, fallbackWorksetId } = args;
  return {
    title: event.title,
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    body: event.body ?? "",
    worksetId: toUserEventFormWorksetId(event.worksetId || fallbackWorksetId),
    isAllDay: Boolean(event.isAllDay),
    remindBeforeDays:
      event.remindBeforeDays != null ? String(event.remindBeforeDays) : "",
    itemId,
  };
}
