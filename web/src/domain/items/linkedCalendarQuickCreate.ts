/**
 * Linked-calendar create/edit form initials for Items (quick chip + add/edit).
 * Quick presets: expiry (all-day), purchase/effective (timed), other (empty title).
 */

import type { UserEvent } from "../../api/userEvents";
import { defaultCreateTimedRange, todayDateInput } from "../timeline/dateUtils";
import {
  isExpiresCalendarEvent,
  isLinkedExpiryTitle,
  normalizeUserEventCalendarKind,
  quickKindToCalendarKind,
  type UserEventCalendarKind,
} from "../timeline/userEventCalendarKind";
import { toUserEventFormWorksetId } from "../timeline/userEvents";

export { isLinkedExpiryTitle };

export const LINKED_CALENDAR_QUICK_KINDS = ["expires", "other", "purchaseEffective"] as const;

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
  /** Wire ``user_events.kind`` — authority for finance / expiry (not one_off/recurring). */
  calendarKind?: UserEventCalendarKind;
  amountInput?: string;
  direction?: "expense" | "income";
};

/** i18n key under ``items`` for prefilled dialog title (expires / purchase). */
export function linkedCalendarQuickLabelKey(
  kind: LinkedCalendarQuickKind,
): `quickLinkedCalendar.${LinkedCalendarQuickKind}` {
  return `quickLinkedCalendar.${kind}`;
}

/** i18n key for mode-picker menu labels (add flow step 1). */
export function linkedCalendarModeLabelKey(
  kind: LinkedCalendarQuickKind,
): `linkedCalendarMode.${LinkedCalendarQuickKind}` {
  return `linkedCalendarMode.${kind}`;
}

function compareLinkedExpiryPrimary(a: UserEvent, b: UserEvent): number {
  const ca = (a.createdAt ?? "").trim();
  const cb = (b.createdAt ?? "").trim();
  if (ca !== cb) return ca.localeCompare(cb);
  return a.id.localeCompare(b.id);
}

/** Primary active (non-dismissed) linked expiry — earliest created_at, then id. */
export function findActiveLinkedExpiryEvent(
  events: readonly UserEvent[],
): UserEvent | null {
  const active = events.filter((event) => !event.dismissed && isExpiresCalendarEvent(event));
  if (active.length === 0) return null;
  return [...active].sort(compareLinkedExpiryPrimary)[0] ?? null;
}

/** True when the preset should open as an all-day event (expiry only). */
export function linkedCalendarQuickIsAllDay(kind: LinkedCalendarQuickKind): boolean {
  return kind === "expires";
}

/**
 * Build ``UserEventDialog`` create ``initial`` for a linked-calendar open,
 * optionally applying quick-create presets.
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
  const quickKind = args.kind ?? "other";
  const calendarKind = quickKindToCalendarKind(quickKind);
  const base = {
    title,
    worksetId,
    itemId: args.itemId,
    remindBeforeDays,
    calendarKind,
  };

  if (quickKind === "expires") {
    // Omit endTime so valuesFromInitial uses the same inclusive day (not wire-exclusive).
    return {
      ...base,
      startTime: todayDateInput(args.now),
      isAllDay: true,
    };
  }

  const range = defaultCreateTimedRange(args.now);
  const purchaseFinance =
    quickKind === "purchaseEffective"
      ? { amountInput: "", direction: "expense" as const }
      : {};
  return {
    ...base,
    startTime: range.startTime,
    endTime: range.endTime,
    isAllDay: false,
    ...purchaseFinance,
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
    calendarKind: normalizeUserEventCalendarKind(event.kind),
    amountInput: event.amount != null ? String(event.amount) : "",
    direction: event.direction === "income" ? "income" : "expense",
  };
}
