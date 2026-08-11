/**
 * Right-sidebar event-card workset + generation provenance labels.
 *
 * Always surfaces both so analysis / user / assistant / item / recurring rows
 * read consistently in the day list footer.
 */

import { stripItemKindTitlePrefix } from "../items/itemCalendarProjection";
import type { TimelineItem } from "../../types";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { formatOsDateTime } from "../../utils/time";
import { isSameDay, startOfDay } from "./dateUtils";
import {
  resolveCalendarLeadingGlyph,
  type CalendarLeadingGlyph,
} from "./importantEventDisplay";
import { classifyMonthDaySpan } from "./monthDaySpanIndicators";
import {
  getGeneralWorksetLabel,
  isNullProvenanceTaskId,
  toUserEventFormWorksetId,
  type WorksetNameLookup,
} from "./userEvents";

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

export type EventListCardMetaLookups = {
  /** Localized builtin「一般」label. */
  generalWorksetLabel?: string;
  /** Catalog workset id → display name. */
  worksetNameById?: WorksetNameLookup;
  /** Catalog task id → ownership workset id. */
  taskWorksetById?: ReadonlyMap<string, string>;
};

function lookupWorksetName(
  worksetId: string,
  lookups: EventListCardMetaLookups,
): string {
  const general = lookups.generalWorksetLabel ?? getGeneralWorksetLabel();
  if (worksetId === SYSTEM_WORKSET_ID) return general;
  if (!lookups.worksetNameById) return worksetId;
  if (lookups.worksetNameById instanceof Map) {
    const named: unknown = (lookups.worksetNameById as ReadonlyMap<string, string>).get(
      worksetId,
    );
    return typeof named === "string" ? named : worksetId;
  }
  const named: unknown = (lookups.worksetNameById as Readonly<Record<string, string>>)[
    worksetId
  ];
  return typeof named === "string" ? named : worksetId;
}

/**
 * Ownership workset display name for a sidebar card.
 * Falls back to「一般」when ownership is missing (product default).
 */
export function resolveEventListWorksetName(
  event: TimelineItem,
  lookups: EventListCardMetaLookups = {},
): string {
  const general = lookups.generalWorksetLabel ?? getGeneralWorksetLabel();

  const direct = typeof event.worksetId === "string" ? event.worksetId.trim() : "";
  if (direct) {
    return lookupWorksetName(toUserEventFormWorksetId(direct), lookups);
  }

  if (!isNullProvenanceTaskId(event.taskId) && lookups.taskWorksetById) {
    const viaTask = lookups.taskWorksetById.get(String(event.taskId));
    if (viaTask?.trim()) {
      return lookupWorksetName(toUserEventFormWorksetId(viaTask), lookups);
    }
  }

  // User rows without task provenance historically stash the workset name in taskName.
  if (
    event.source === "user" &&
    isNullProvenanceTaskId(event.taskId) &&
    event.taskName?.trim()
  ) {
    return event.taskName.trim();
  }

  return general;
}

export type EventListProvenanceKind =
  | "task"
  | "user"
  | "assistant"
  | "item"
  | "ics"
  | "a2a"
  | "agent";

/**
 * Generation source for the card footer (任務 / 用戶 / 助手 / 物品 / …).
 * Distinct from ownership workset.
 */
export function resolveEventListProvenanceKind(
  event: TimelineItem,
): EventListProvenanceKind {
  if (event.source === "item_remind") return "item";
  if (event.source === "user") {
    switch (event.origin) {
      case "assistant":
        return "assistant";
      case "ics":
        return "ics";
      case "a2a":
        return "a2a";
      case "agent":
        return "agent";
      case "manual":
      default:
        return "user";
    }
  }
  // analysis / recurring / legacy → 任務
  return "task";
}

/** Optional task display name when provenance is「任務」. */
export function resolveEventListTaskName(event: TimelineItem): string | null {
  if (resolveEventListProvenanceKind(event) !== "task") return null;
  const name = event.taskName?.trim();
  return name || null;
}

/**
 * Footer / detail「生成来源」label (任務／用戶／助手／物品／…).
 * Task provenance with a name uses `sidebar.task` (`任務：{name}`).
 */
export function formatEventListProvenanceLabel(
  event: TimelineItem,
  t: (key: string, opts?: Record<string, string>) => string,
): string {
  const kind = resolveEventListProvenanceKind(event);
  if (kind === "task") {
    const taskName = resolveEventListTaskName(event);
    return taskName
      ? t("sidebar.task", { value: taskName })
      : t("eventList.provenance.task");
  }
  return t(`eventList.provenance.${kind}`);
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

/** Empty / whitespace / legacy "N/A" → display placeholder for location rows. */
export function calendarLocationDisplay(
  raw: string | null | undefined,
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.toUpperCase() === "N/A") {
    return "N/A";
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
