/**
 * Linked-calendar create/edit form initials for Items (quick chip + add/edit).
 * Only「到期」is a special quick preset — title + all-day.
 */

import type { UserEvent } from "../../api/userEvents";
import { defaultCreateTimedRange, todayDateInput } from "../timeline/dateUtils";
import { toUserEventFormWorksetId } from "../timeline/userEvents";
import { isReservedAttributeKey } from "./itemAttributes";

/** Only expiry is a first-class quick-create preset. */
export const LINKED_CALENDAR_QUICK_KINDS = ["expires"] as const;

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

/** True when title is the linked-calendar expiry preset (到期 / Expires). */
export function isLinkedExpiryTitle(title: string): boolean {
  return isReservedAttributeKey(title);
}

/** First active (non-dismissed) linked expiry event on an item, if any. */
export function findActiveLinkedExpiryEvent(
  events: readonly UserEvent[],
): UserEvent | null {
  return (
    events.find((event) => !event.dismissed && isLinkedExpiryTitle(event.title)) ?? null
  );
}

/** True when the preset should open as an all-day event (expiry only). */
export function linkedCalendarQuickIsAllDay(kind: LinkedCalendarQuickKind): boolean {
  return kind === "expires";
}

/**
 * Build ``UserEventDialog`` create ``initial`` for a linked-calendar open,
 * optionally applying the expiry quick-create title / all-day preset.
 */
export function buildLinkedCalendarCreateInitial(args: {
  itemId: string;
  worksetId: string;
  title?: string;
  kind?: LinkedCalendarQuickKind | null;
  /** Category preset — prefilled on create when set. */
  defaultRemindBeforeDays?: number | null;
  now?: Date;
}): LinkedCalendarFormInitial {
  const worksetId = toUserEventFormWorksetId(args.worksetId);
  const title = (args.title ?? "").trim();
  const remindBeforeDays =
    args.defaultRemindBeforeDays != null ? String(args.defaultRemindBeforeDays) : "";
  const base = {
    title,
    worksetId,
    itemId: args.itemId,
    remindBeforeDays,
  };

  if (args.kind === "expires") {
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
    // Item form owns workset — prefer current form value over stored event workset.
    worksetId: toUserEventFormWorksetId(fallbackWorksetId || event.worksetId),
    isAllDay: Boolean(event.isAllDay),
    remindBeforeDays:
      event.remindBeforeDays != null ? String(event.remindBeforeDays) : "",
    itemId,
  };
}
