/**
 * Timeline domain fetcher: thin wrapper over {@link fetchMergedTimedEvents}.
 *
 * Board uses the same core via {@link fetchMergedTimedBoardEvents} /
 * {@link fetchBoardEventsList}.
 *
 * Timeline month/gantt and board calendar surfaces come from
 * GET /api/v1/calendar/window (tagged analysis + user + recurring +
 * item_remind). Intelligence / board map keep /results/events.
 */

import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";
import type { TimelineFilterPlan } from "./timelineFilterPlan";
import { fetchMergedTimedEvents } from "./timedEventMerge";
import type { TimelineItem } from "../../types";

/** Padding (days) around the visible range so the 42-day month grid is covered. */
export const TIMELINE_CALENDAR_FETCH_PADDING_DAYS = 7;

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
 * Pull one calendar window, then client-filter for multi workset/task selection.
 * Delegates to the shared {@link fetchMergedTimedEvents} core.
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

  return fetchMergedTimedEvents({
    startIso,
    endIso,
    analysis: "timeline",
    includeUserEvents: true,
    includeRrule: true,
    filterPlan: { selectedSources, plan: filterPlan },
    userEventLabels: { taskNameById, generalWorksetLabel, worksetNameById },
  }) as Promise<TimelineItem[]>;
}
