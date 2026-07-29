import { USER_EVENTS_FILTER_ID } from "../../domain/timeline/userEvents";

/** Multi-select plan: which sources to fetch and how to client-filter. */
export type TimelineFilterPlan = {
  fetchAnalysis: boolean;
  fetchCalendar: boolean;
  fetchUserEvents: boolean;
  /** `null` = no task_id filter (all); otherwise IN list for event-mode tasks. */
  analysisTaskIds: string[] | null;
  /** `null` = all recurring; otherwise IN list for recurring tasks. */
  calendarTaskIds: string[] | null;
  /** Real task ids selected (excludes `__user__`). Empty when only sentinel. */
  selectedRealTaskIds: string[];
  includeUnassignedUserEvents: boolean;
};

/**
 * Resolve multi-select (`null`/`[]`/ids) into fetch + merge flags.
 * `null` = all sources; `[]` = show none (skip fetches).
 */
export function resolveTimelineFilterPlan(
  selectedTaskIds: string[] | null,
  tasks: ReadonlyArray<{ id: string; analysisMode: string }>,
): TimelineFilterPlan {
  if (selectedTaskIds === null) {
    return {
      fetchAnalysis: true,
      fetchCalendar: true,
      fetchUserEvents: true,
      analysisTaskIds: null,
      calendarTaskIds: null,
      selectedRealTaskIds: [],
      includeUnassignedUserEvents: true,
    };
  }

  if (selectedTaskIds.length === 0) {
    return {
      fetchAnalysis: false,
      fetchCalendar: false,
      fetchUserEvents: false,
      analysisTaskIds: [],
      calendarTaskIds: [],
      selectedRealTaskIds: [],
      includeUnassignedUserEvents: false,
    };
  }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const includeUnassignedUserEvents = selectedTaskIds.includes(USER_EVENTS_FILTER_ID);
  const selectedRealTaskIds = selectedTaskIds.filter((id) => id !== USER_EVENTS_FILTER_ID);

  const analysisTaskIds: string[] = [];
  const calendarTaskIds: string[] = [];
  let fetchUserForTagged = false;

  for (const id of selectedRealTaskIds) {
    const mode = byId.get(id)?.analysisMode;
    if (mode === "recurring") {
      calendarTaskIds.push(id);
      fetchUserForTagged = true;
    } else if (mode === "calendar_task") {
      fetchUserForTagged = true;
    } else if (mode === "project") {
      // Project owns child recurrings; fetch calendar by project id (server expands children).
      calendarTaskIds.push(id);
      fetchUserForTagged = true;
    } else {
      // event / unknown → analysis + tagged user events
      analysisTaskIds.push(id);
      fetchUserForTagged = true;
    }
  }

  return {
    fetchAnalysis: analysisTaskIds.length > 0,
    fetchCalendar: calendarTaskIds.length > 0,
    fetchUserEvents: includeUnassignedUserEvents || fetchUserForTagged,
    analysisTaskIds: analysisTaskIds.length > 0 ? analysisTaskIds : [],
    calendarTaskIds: calendarTaskIds.length > 0 ? calendarTaskIds : [],
    selectedRealTaskIds,
    includeUnassignedUserEvents,
  };
}
