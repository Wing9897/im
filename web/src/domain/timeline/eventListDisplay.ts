/**
 * Right-sidebar event-card display helpers: time labels, remind badges,
 * leading glyphs, day-phase tags, and title chrome.
 */

import { stripItemKindTitlePrefix } from "../items/itemCalendarProjection";
import type { TimelineItem } from "../../types";
import { formatOsDateTime } from "../../utils/time";
import { isSameDay, startOfDay } from "./dateUtils";
import {
  resolveCalendarLeadingGlyph,
  type CalendarLeadingGlyph,
} from "./importantEventDisplay";
import { classifyMonthDaySpan } from "./monthDaySpanIndicators";

/** Collapse newlines/spaces for single-line list previews (line-clamp breaks on multi-line body). */
export function previewEventBody(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

/** Sidebar card time row: all-day label, or local start (– end) via OS datetime. */
export function eventListTimeLabel(
  event: Pick<TimelineItem, "isAllDay" | "startTime" | "endTime">,
  allDayLabel: string,
): string {
  if (event.isAllDay) return allDayLabel;
  const start = formatOsDateTime(event.startTime, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!event.endTime) return start;
  return `${start} – ${formatOsDateTime(event.endTime, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Unified 「提醒」 badge: items via remind-kind projection; user / assistant
 * (and any other source) via `remindBeforeDays` when set. Analysis / tasks
 * only when they carry the same field.
 */
export function eventShowsRemindBadge(
  event: Pick<TimelineItem, "source" | "itemDateKind" | "remindBeforeDays">,
): boolean {
  if (event.source === "item_remind") {
    return event.itemDateKind === "remind";
  }
  const days = event.remindBeforeDays;
  return typeof days === "number" && Number.isFinite(days) && days >= 0;
}

/**
 * Card-level day-phase tags:
 * - 「跨日进行中」 for multi-day covering (middle) days — same whether
 *   the focused day is real today or a selected day
 * - 「结束于本日」 when the focused day **is** real today and span ends
 * - 「结束于当日」 when the focused day ≠ today and span ends
 *
 * Span kind still follows month chips ({@link classifyMonthDaySpan}).
 * When viewing a non-today day, prefer 结束于当日 over 结束于本日 even if
 * the event also overlaps real today.
 */
export type EventListDayPhaseTag =
  | "ongoingMultiDay"
  | "endingToday"
  | "endingFocused";

/** i18n + testid map for list / week / day phase tags. */
export const EVENT_LIST_DAY_PHASE_TAG_META: Record<
  EventListDayPhaseTag,
  { labelKey: string; testId: string }
> = {
  ongoingMultiDay: {
    labelKey: "eventList.cardTagOngoingMultiDay",
    testId: "timeline-event-day-phase-ongoing-multi-day",
  },
  endingToday: {
    labelKey: "eventList.cardTagEndingOnDay",
    testId: "timeline-event-day-phase-ending-today",
  },
  endingFocused: {
    labelKey: "eventList.cardTagEndingOnFocusedDay",
    testId: "timeline-event-day-phase-ending-focused",
  },
};

export const EVENT_LIST_DAY_PHASE_TAG_CLASS =
  "shrink-0 rounded-sm bg-[color-mix(in_srgb,var(--surface-border)_55%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-text-secondary";

export function resolveEventListDayPhaseTag(
  event: TimelineItem,
  focusedDay: Date,
  now: Date = new Date(),
): EventListDayPhaseTag | null {
  const span = classifyMonthDaySpan(event, focusedDay);
  if (span == null) return null;
  if (span === "ongoing") {
    return "ongoingMultiDay";
  }
  const focusedIsToday = isSameDay(startOfDay(focusedDay), startOfDay(now));
  return focusedIsToday ? "endingToday" : "endingFocused";
}

/**
 * List / week / day card title: drop remind prefix when the card already shows
 * the remind badge. Other item kinds (if any) stay plain.
 */
export function eventListCardTitle(
  event: Pick<TimelineItem, "title" | "source" | "itemDateKind">,
  opts: {
    showRemindBadge?: boolean;
  } = {},
): string {
  const base = event.title.trim();
  if (event.source !== "item_remind") return base;

  const showRemind =
    opts.showRemindBadge ?? eventShowsRemindBadge(event);
  if (event.itemDateKind === "remind" && showRemind) {
    return stripItemKindTitlePrefix("remind", base);
  }

  return base;
}

/** Empty / whitespace / legacy "N/A" → empty string (no literal N/A placeholder). */
export function calendarLocationDisplay(
  raw: string | null | undefined,
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.toUpperCase() === "N/A") {
    return "";
  }
  return trimmed;
}

export type EventCardDisplay = {
  leading: CalendarLeadingGlyph | null;
  showRemindBadge: boolean;
  dayPhaseTag: EventListDayPhaseTag | null;
  title: string;
};

/**
 * Single source for list / week / day card chrome: leading glyph, remind badge,
 * day-phase tag, and title (with kind prefixes stripped when redundant).
 */
export function resolveEventCardDisplay(
  event: TimelineItem,
  focusedDay: Date,
  now: Date = new Date(),
): EventCardDisplay {
  const dayPhaseTag = resolveEventListDayPhaseTag(event, focusedDay, now);
  const showRemindBadge = eventShowsRemindBadge(event);
  return {
    leading: resolveCalendarLeadingGlyph(event),
    showRemindBadge,
    dayPhaseTag,
    title: eventListCardTitle(event, { showRemindBadge }),
  };
}
