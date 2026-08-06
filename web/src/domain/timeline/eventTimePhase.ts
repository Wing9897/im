import type { TimelineItem } from "../../types";
import {
  addDays,
  effectiveEndDay,
  startOfDay,
  timelineEventDateRange,
} from "./dateUtils";

/** Temporal phase of an event relative to "now" (not annotation status). */
export type EventTimePhase = "upcoming" | "ongoing" | "ended";

/**
 * Classify an event as upcoming / ongoing / ended vs `now`.
 *
 * Timed: upcoming when start > now; ongoing when start ≤ now < end; ended when end ≤ now.
 * Point events (no end / end ≤ start): upcoming before start, else ended.
 *
 * All-day: wall-date span with exclusive midnight ends — ongoing for the whole
 * local calendar day(s); ended once the last active day has passed.
 */
export function classifyEventTimePhase(
  event: TimelineItem,
  now: Date = new Date(),
): EventTimePhase {
  const { start, end: rawEnd } = timelineEventDateRange(event);
  if (Number.isNaN(start.getTime())) return "ended";
  const end = Number.isNaN(rawEnd.getTime()) || rawEnd < start ? start : rawEnd;

  if (event.isAllDay) {
    const startDay = startOfDay(start);
    const lastDay = effectiveEndDay(start, end);
    const endExclusive = addDays(lastDay, 1);
    if (now < startDay) return "upcoming";
    if (now < endExclusive) return "ongoing";
    return "ended";
  }

  if (now < start) return "upcoming";
  if (end > start && now < end) return "ongoing";
  return "ended";
}

/**
 * Presentation buckets for the right sidebar day list (2 groups only):
 * 进行中 vs 未开始 — always relative to **real now**, never the selected day.
 * Covering / ending-on-focused-day markers are card tags only (see
 * eventListCardMeta.resolveEventListDayPhaseTag); they do not force 进行中 when the
 * event has not started yet vs the wall clock.
 */
export type SidebarDayGroups = {
  /** Started already vs real now (clock-ongoing / ended / all-day active). */
  ongoing: TimelineItem[];
  /** Not started yet vs real now. */
  upcoming: TimelineItem[];
};

export type SidebarDayPhaseFilter = "all" | "ongoing" | "upcoming";

/**
 * Partition day-list events by real-now time phase:
 * 进行中 = already started (ongoing + ended); 未开始 = start still in the future.
 */
export function groupSidebarDayEvents(
  events: TimelineItem[],
  now: Date = new Date(),
): SidebarDayGroups {
  const upcoming: TimelineItem[] = [];
  const ongoing: TimelineItem[] = [];
  for (const event of events) {
    const phase = classifyEventTimePhase(event, now);
    if (phase === "upcoming") upcoming.push(event);
    else ongoing.push(event);
  }
  return { upcoming, ongoing };
}

/** Apply sidebar quick filter; `all` returns both buckets unchanged. */
export function filterSidebarDayGroups(
  groups: SidebarDayGroups,
  filter: SidebarDayPhaseFilter,
): SidebarDayGroups {
  if (filter === "ongoing") return { ongoing: groups.ongoing, upcoming: [] };
  if (filter === "upcoming") return { ongoing: [], upcoming: groups.upcoming };
  return groups;
}
