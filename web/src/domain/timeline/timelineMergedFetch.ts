/**
 * Timeline domain fetcher: filter plan → analysis / calendar / user → merge.
 *
 * Board keeps {@link fetchMergedTimedBoardEvents} as its single dedupe path;
 * Timeline uses this plan-aware path with the same shared fetch + merge helpers.
 */

import type { UserEvent } from "../../api/userEvents";
import type { CalendarOccurrence, TimelineItem } from "../../types";
import { userEventMatchesSourceSelection } from "../tasks/sourceFilterSelection";
import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";
import {
  fetchSharedCalendarItems,
  fetchSharedTimelineEvents,
  fetchSharedUserEvents,
} from "./sharedCalendarFetch";
import type { TimelineFilterPlan } from "./timelineFilterPlan";
import { mergeWithCalendarOccurrences, userEventToTimelineItem } from "./timedEventMerge";

/** Padding (days) around the visible range so the 42-day month grid is covered. */
export const TIMELINE_CALENDAR_FETCH_PADDING_DAYS = 7;

const EMPTY_EVENTS: TimelineItem[] = [];

export function paddedTimelineFetchWindow(
  rangeStart: Date,
  rangeEnd: Date,
  paddingDays: number = TIMELINE_CALENDAR_FETCH_PADDING_DAYS,
): { startIso: string; endIso: string } {
  const start = new Date(rangeStart);
  start.setDate(start.getDate() - paddingDays);
  const end = new Date(rangeEnd);
  end.setDate(end.getDate() + paddingDays);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * Client-filter + RRULE merge for Timeline (same id / taskId|startTime dedupe as Board).
 */
export function mergeTimelineFilterSources(opts: {
  selectedSources: SourceFilterSelection;
  filterPlan: TimelineFilterPlan;
  analysisEvents: readonly TimelineItem[];
  calendarOccurrences: readonly CalendarOccurrence[];
  userEvents: readonly TimelineItem[];
}): TimelineItem[] {
  const { selectedSources, filterPlan, analysisEvents, calendarOccurrences, userEvents } = opts;

  if (
    selectedSources !== null &&
    selectedSources.taskIds.length === 0 &&
    selectedSources.worksetIds.length === 0
  ) {
    return EMPTY_EVENTS;
  }

  const analysis = filterPlan.fetchAnalysis ? [...analysisEvents] : EMPTY_EVENTS;
  const allow = new Set(filterPlan.selectedRealTaskIds);
  const allowWorksets = new Set(filterPlan.selectedWorksetIds);
  const allowExplicitTasks = new Set(filterPlan.explicitTaskIds);
  const isAll = selectedSources === null;

  const calendarFiltered = filterPlan.fetchCalendar
    ? isAll
      ? [...calendarOccurrences]
      : calendarOccurrences.filter(
          (occurrence) => occurrence.taskId != null && allow.has(occurrence.taskId),
        )
    : [];

  const users = filterPlan.fetchUserEvents
    ? isAll
      ? [...userEvents]
      : userEvents.filter((event) =>
          userEventMatchesSourceSelection(event, allowWorksets, allowExplicitTasks),
        )
    : EMPTY_EVENTS;

  return mergeWithCalendarOccurrences(
    [...analysis, ...users],
    calendarFiltered,
  ) as TimelineItem[];
}

export type FetchMergedTimelineEventsOpts = {
  selectedSources: SourceFilterSelection;
  filterPlan: TimelineFilterPlan;
  startIso: string;
  endIso: string;
  taskNameById?: ReadonlyMap<string, string>;
  generalWorksetLabel?: string;
  worksetNameById?: ReadonlyMap<string, string>;
};

/**
 * Pull analysis / calendar / user per filter plan, project user rows, then merge.
 * Uses coalesced {@link sharedCalendarFetch} helpers shared with Board widgets.
 */
export async function fetchMergedTimelineEvents(
  opts: FetchMergedTimelineEventsOpts,
): Promise<TimelineItem[]> {
  const {
    selectedSources,
    filterPlan,
    startIso,
    endIso,
    taskNameById,
    generalWorksetLabel,
    worksetNameById,
  } = opts;

  if (
    selectedSources !== null &&
    selectedSources.taskIds.length === 0 &&
    selectedSources.worksetIds.length === 0
  ) {
    return EMPTY_EVENTS;
  }

  if (!filterPlan.fetchAnalysis && !filterPlan.fetchCalendar && !filterPlan.fetchUserEvents) {
    return EMPTY_EVENTS;
  }

  const [analysisEvents, calendarOccurrences, rawUserEvents] = await Promise.all([
    filterPlan.fetchAnalysis
      ? fetchSharedTimelineEvents({
          taskIds: filterPlan.analysisTaskIds,
          startDate: startIso,
          endDate: endIso,
        })
      : Promise.resolve(EMPTY_EVENTS),
    filterPlan.fetchCalendar
      ? fetchSharedCalendarItems(
          startIso,
          endIso,
          filterPlan.recurringTaskIds === null
            ? undefined
            : { taskIds: filterPlan.recurringTaskIds },
        )
      : Promise.resolve([] as CalendarOccurrence[]),
    filterPlan.fetchUserEvents
      ? fetchSharedUserEvents({ start: startIso, end: endIso })
      : Promise.resolve([] as UserEvent[]),
  ]);

  const userEvents = rawUserEvents
    .map((event) =>
      userEventToTimelineItem(event, taskNameById, generalWorksetLabel, worksetNameById),
    )
    .filter((event): event is TimelineItem => event !== null);

  return mergeTimelineFilterSources({
    selectedSources,
    filterPlan,
    analysisEvents,
    calendarOccurrences,
    userEvents,
  });
}
