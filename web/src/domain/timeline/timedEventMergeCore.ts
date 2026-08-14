import { userEventMatchesSourceSelection } from "../tasks/sourceFilterSelection";
import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";
import type { TimelineFilterPlan } from "./timelineFilterPlan";
import { calendarOccurrenceToBoardEvent } from "./timedEventProject";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { AnalysisEvent, CalendarOccurrence, TimelineItem } from "../../types";
import { asTimedAnalysisEvent } from "../../types/timelineItem";

const EMPTY_EVENTS: TimelineItem[] = [];

function timedKey(
  seriesOrTaskId: string | null | undefined,
  startTime: string | null | undefined,
): string | null {
  if (!seriesOrTaskId || !startTime) {
    return null;
  }
  const timestamp = new Date(startTime).getTime();
  return `${seriesOrTaskId}|${Number.isNaN(timestamp) ? startTime : timestamp}`;
}

/**
 * Append recurring RRULE occurrences after analysis / user events.
 * Skips rows that already match by id or by seriesId+startTime to avoid double bars.
 */
export function mergeWithCalendarOccurrences(
  timedEvents: AnalysisEvent[],
  occurrences: CalendarOccurrence[],
): AnalysisEvent[] {
  if (occurrences.length === 0) {
    return timedEvents;
  }
  const ids = new Set(timedEvents.map((event) => event.id));
  const keys = new Set<string>();
  for (const event of timedEvents) {
    // Dedupe against RRULE rows by seriesId only — never taskId
    // (analysis/user provenance is a separate id namespace).
    const key = timedKey(event.seriesId, event.startTime);
    if (key) {
      keys.add(key);
    }
  }
  const extras: AnalysisEvent[] = [];
  for (const occurrence of occurrences) {
    if (ids.has(occurrence.id)) {
      continue;
    }
    const key = timedKey(occurrence.seriesId, occurrence.startTime);
    if (key && keys.has(key)) {
      continue;
    }
    extras.push(calendarOccurrenceToBoardEvent(occurrence));
    ids.add(occurrence.id);
    if (key) {
      keys.add(key);
    }
  }
  return extras.length === 0 ? timedEvents : [...timedEvents, ...extras];
}

function isItemOccurrence(occurrence: CalendarOccurrence): boolean {
  return occurrence.source === "item_remind";
}

function itemOccurrenceToTimelineItem(occurrence: CalendarOccurrence): TimelineItem | null {
  return asTimedAnalysisEvent(calendarOccurrenceToBoardEvent(occurrence));
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
  const {
    selectedSources,
    filterPlan,
    analysisEvents,
    calendarOccurrences,
    userEvents,
  } = opts;

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

  const recurringOccurrences = calendarOccurrences.filter((row) => !isItemOccurrence(row));
  const itemOccurrences = calendarOccurrences.filter(isItemOccurrence);

  const calendarFiltered = filterPlan.fetchCalendar
    ? isAll
      ? [...recurringOccurrences]
      : recurringOccurrences.filter(
          (occurrence) =>
            (occurrence.seriesId != null &&
              occurrence.seriesId !== "" &&
              allow.has(occurrence.seriesId)) ||
            (occurrence.worksetId != null &&
              allowWorksets.has(occurrence.worksetId)),
        )
    : [];

  const users = filterPlan.fetchUserEvents
    ? isAll
      ? [...userEvents]
      : userEvents.filter((event) =>
          userEventMatchesSourceSelection(event, allowWorksets, allowExplicitTasks),
        )
    : EMPTY_EVENTS;

  const itemEvents = filterPlan.fetchItems
    ? (isAll
        ? itemOccurrences
        : itemOccurrences.filter((occurrence) => {
            const wid =
              typeof occurrence.worksetId === "string" && occurrence.worksetId.trim()
                ? occurrence.worksetId.trim()
                : SYSTEM_WORKSET_ID;
            return allowWorksets.has(wid);
          })
      )
        .map(itemOccurrenceToTimelineItem)
        .filter((event): event is TimelineItem => event !== null)
    : EMPTY_EVENTS;

  return mergeWithCalendarOccurrences(
    [...analysis, ...users, ...itemEvents],
    calendarFiltered,
  ) as TimelineItem[];
}
