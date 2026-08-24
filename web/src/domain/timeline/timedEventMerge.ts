/**
 * Timed-event merge barrel — project / merge / fetch live in sibling modules.
 * Keep this path as the public import for Board + Timeline callers.
 */

export {
  sortEventsByTimeDesc,
  userEventToBoardEvent,
  userEventToTimelineItem,
  windowItemToBoardEvent,
  withResolvedUserEventTaskNames,
} from "./timedEventProject";

export { filterTimelineWindowEvents } from "./timedEventMergeCore";

export type {
  FetchMergedTimedEventsOpts,
  UserEventLabelOpts,
} from "./timedEventFetch";
export {
  fetchBoardEventsList,
  fetchMergedTimedBoardEvents,
  fetchMergedTimedEvents,
} from "./timedEventFetch";
