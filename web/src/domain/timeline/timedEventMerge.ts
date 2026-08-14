/**
 * Timed-event merge barrel — project / merge / fetch live in sibling modules.
 * Keep this path as the public import for Board + Timeline callers.
 */

export {
  calendarOccurrenceToBoardEvent,
  sortEventsByTimeDesc,
  userEventToBoardEvent,
  userEventToTimelineItem,
  withResolvedUserEventTaskNames,
} from "./timedEventProject";

export {
  mergeTimelineFilterSources,
  mergeWithCalendarOccurrences,
} from "./timedEventMergeCore";

export type {
  FetchMergedTimedEventsOpts,
  UserEventLabelOpts,
} from "./timedEventFetch";
export {
  fetchBoardEventsList,
  fetchMergedTimedBoardEvents,
  fetchMergedTimedEvents,
} from "./timedEventFetch";
