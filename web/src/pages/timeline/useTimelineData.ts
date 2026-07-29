import { useCallback, useEffect, useMemo } from "react";

import { fetchCalendarOccurrences, fetchTimelineEvents } from "../../api/results";
import { listUserEvents } from "../../api/userEvents";
import {
  calendarOccurrenceToBoardEvent,
  userEventToTimelineItem,
} from "../../domain/timeline/timedEventMerge";
import { useTaskCatalog, useTaskNameById } from "../../context/TaskCatalogContext";
import type { TimelineSelectedTaskIds } from "../../domain/timeline/timelineTaskFilter";
import { subscribeResourceModified } from "../../domain/sse/resourceModified";
import {
  filterAssignableTimelineTasks,
  isUnassignedUserEventTaskId,
} from "../../domain/timeline/userEvents";
import { useUserEventsFilterLabel } from "../../domain/timeline/useUserEventsFilterLabel";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useRefreshOnAnalysisEvent } from "../../hooks/useRefreshOnAnalysisEvent";
import type { TimelineItem, TaskActivitySpan } from "../../types";
import { logWarn } from "../../utils/logger";
import { useGanttData } from "./useGanttData";
import { resolveTimelineFilterPlan, type TimelineFilterPlan } from "./shared";

const EMPTY_EVENTS: TimelineItem[] = [];

/** Padding (days) around the visible range so the 42-day month grid is covered. */
const CALENDAR_FETCH_PADDING_DAYS = 7;

function anySourceFlag(
  plan: TimelineFilterPlan,
  analysis: boolean,
  calendar: boolean,
  user: boolean,
): boolean {
  return (
    (plan.fetchAnalysis && analysis) ||
    (plan.fetchCalendar && calendar) ||
    (plan.fetchUserEvents && user)
  );
}

function firstSourceError(
  plan: TimelineFilterPlan,
  analysis: string | null,
  calendar: string | null,
  user: string | null,
): string | null {
  if (plan.fetchAnalysis && analysis) return analysis;
  if (plan.fetchCalendar && calendar) return calendar;
  if (plan.fetchUserEvents && user) return user;
  return null;
}

interface UseTimelineDataOptions {
  /** `null` = all, `[]` = none, otherwise multi-select (may include `__user__`). */
  selectedTaskIds: TimelineSelectedTaskIds;
  /** Current view mode — span fetching only triggers in "gantt" mode. */
  viewMode: "calendar" | "gantt";
  /** Start of the visible date range (calendar occurrences are fetched around it). */
  rangeStart: Date;
  /** End of the visible date range. */
  rangeEnd: Date;
}

interface UseTimelineDataReturn {
  // Task catalog
  tasks: ReturnType<typeof useTaskCatalog>["tasks"];
  tasksLoading: boolean;
  taskLoadError: string | null;
  timelineTasks: ReturnType<typeof useTaskCatalog>["tasks"];

  // Analysis timed events (primary list) — also reused by Gantt when a real task is selected
  events: TimelineItem[];
  initialLoading: boolean;
  isRefreshing: boolean;
  pageError: string | null;
  refreshEvents: () => Promise<void>;

  // Gantt: task activity spans
  taskSpans: TaskActivitySpan[];
  spansInitialLoading: boolean;
  spansIsRefreshing: boolean;
  spansError: string | null;
  fetchSpans: () => Promise<TaskActivitySpan[] | null>;

  // Gantt: timed events for selected task (same fetch as `events`)
  timelineEvents: TimelineItem[];
  timelineEventsInitialLoading: boolean;
  timelineEventsIsRefreshing: boolean;
  timelineEventsError: string | null;
  retryTimelineEvents: () => void;
}

type AnalysisFetchKey = {
  startIso: string;
  endIso: string;
  /** `null` = all tasks; otherwise IN filter (may be empty → short-circuit). */
  taskIds: string[] | null;
};

/**
 * Encapsulates data fetching for the timeline page:
 * - Event-mode analysis results (filtered by task multi-select)
 * - Calendar-mode RRULE occurrences (filtered by task)
 * - Manual / assistant user events
 * - "All tasks" merges all applicable sources
 * - Auto-refresh on analysis completion
 * Gantt activity spans live in useGanttData; Gantt events reuse the primary list.
 */
export function useTimelineData({
  selectedTaskIds,
  viewMode,
  rangeStart,
  rangeEnd,
}: UseTimelineDataOptions): UseTimelineDataReturn {
  const { tasks, taskLoadError, tasksLoading } = useTaskCatalog();

  // `activeOnly` matches the assistant / voice pickers: a soft-deleted calendar
  // task must not stay assignable in the toolbar or UserEventDialog.
  const timelineTasks = useMemo(
    () => filterAssignableTimelineTasks(tasks, { activeOnly: true }),
    [tasks],
  );

  const taskNameById = useTaskNameById();
  const userEventsLabel = useUserEventsFilterLabel();

  const filterPlan = useMemo(
    () => resolveTimelineFilterPlan(selectedTaskIds, tasks),
    [selectedTaskIds, tasks],
  );

  const selectedTaskIdsKey =
    selectedTaskIds === null ? "*" : selectedTaskIds.join("|");

  const calendarWindow = useMemo(() => {
    const start = new Date(rangeStart);
    start.setDate(start.getDate() - CALENDAR_FETCH_PADDING_DAYS);
    const end = new Date(rangeEnd);
    end.setDate(end.getDate() + CALENDAR_FETCH_PADDING_DAYS);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, [rangeStart, rangeEnd]);

  const fetcher = useCallback(
    (key: AnalysisFetchKey) =>
      fetchTimelineEvents({
        taskIds: key.taskIds === null ? undefined : key.taskIds,
        startDate: key.startIso,
        endDate: key.endIso,
      }),
    [],
  );
  const {
    data,
    initialLoading,
    isRefreshing,
    error,
    execute: fetchEvents,
  } = useAsyncResource(fetcher, { toastOnError: false });

  const calendarFetcher = useCallback(
    (window: { startIso: string; endIso: string; taskIds: string[] | null }) =>
      fetchCalendarOccurrences(
        window.startIso,
        window.endIso,
        window.taskIds === null ? undefined : { taskIds: window.taskIds },
      ),
    [],
  );
  const {
    data: calendarData,
    initialLoading: calendarInitialLoading,
    isRefreshing: calendarIsRefreshing,
    error: calendarError,
    execute: executeCalendarFetch,
  } = useAsyncResource(calendarFetcher, { toastOnError: false });

  const userEventsFetcher = useCallback(
    (window: { startIso: string; endIso: string }) =>
      listUserEvents({ start: window.startIso, end: window.endIso }),
    [],
  );
  const {
    data: userEventsData,
    initialLoading: userEventsInitialLoading,
    isRefreshing: userEventsIsRefreshing,
    error: userEventsError,
    execute: executeUserEventsFetch,
  } = useAsyncResource(userEventsFetcher, { toastOnError: false });

  const calendarTaskFingerprint = useMemo(
    () =>
      tasks
        .filter((task) => task.analysisMode === "recurring")
        .map((task) => `${task.id}:${task.updatedAt}:${task.isActive}`)
        .join("|"),
    [tasks],
  );

  useEffect(() => {
    if (!filterPlan.fetchAnalysis) return;
    void fetchEvents({
      startIso: calendarWindow.startIso,
      endIso: calendarWindow.endIso,
      taskIds: filterPlan.analysisTaskIds,
    });
  }, [fetchEvents, calendarWindow, filterPlan.fetchAnalysis, filterPlan.analysisTaskIds, selectedTaskIdsKey]);

  useEffect(() => {
    if (!filterPlan.fetchCalendar) return;
    void executeCalendarFetch({
      ...calendarWindow,
      taskIds: filterPlan.calendarTaskIds,
    });
  }, [
    executeCalendarFetch,
    calendarWindow,
    calendarTaskFingerprint,
    filterPlan.fetchCalendar,
    filterPlan.calendarTaskIds,
  ]);

  useEffect(() => {
    if (!filterPlan.fetchUserEvents) return;
    void executeUserEventsFetch(calendarWindow);
  }, [executeUserEventsFetch, calendarWindow, filterPlan.fetchUserEvents]);

  const refreshEvents = useCallback(async () => {
    const jobs: Promise<unknown>[] = [];
    if (filterPlan.fetchAnalysis) {
      jobs.push(
        fetchEvents({
          startIso: calendarWindow.startIso,
          endIso: calendarWindow.endIso,
          taskIds: filterPlan.analysisTaskIds,
        }),
      );
    }
    if (filterPlan.fetchCalendar) {
      jobs.push(
        executeCalendarFetch({
          ...calendarWindow,
          taskIds: filterPlan.calendarTaskIds,
        }),
      );
    }
    if (filterPlan.fetchUserEvents) {
      jobs.push(executeUserEventsFetch(calendarWindow));
    }
    await Promise.all(jobs);
  }, [
    fetchEvents,
    filterPlan,
    executeCalendarFetch,
    executeUserEventsFetch,
    calendarWindow,
  ]);

  useRefreshOnAnalysisEvent(refreshEvents, {
    taskIds: filterPlan.fetchAnalysis ? filterPlan.analysisTaskIds : [],
    analysisMode: "event",
  });

  useEffect(() => {
    return subscribeResourceModified((detail) => {
      if (detail.resourceType !== "task" && detail.resourceType !== "user_event") {
        return;
      }
      void refreshEvents().catch((error) => {
        logWarn("[timeline] refresh after resource_modified failed", error);
      });
    });
  }, [refreshEvents]);

  const calendarEvents = useMemo(
    () => (calendarData ?? []).map(calendarOccurrenceToBoardEvent) as TimelineItem[],
    [calendarData],
  );

  const userEvents = useMemo(
    () =>
      (userEventsData ?? [])
        .map((event) => userEventToTimelineItem(event, taskNameById, userEventsLabel))
        .filter((event): event is TimelineItem => event !== null),
    [userEventsData, taskNameById, userEventsLabel],
  );

  const events = useMemo(() => {
    if (selectedTaskIds !== null && selectedTaskIds.length === 0) {
      return EMPTY_EVENTS;
    }

    const analysis = filterPlan.fetchAnalysis ? (data ?? EMPTY_EVENTS) : EMPTY_EVENTS;
    const allow = new Set(filterPlan.selectedRealTaskIds);
    const isAll = selectedTaskIds === null;

    const calendar = filterPlan.fetchCalendar
      ? isAll
        ? calendarEvents
        : calendarEvents.filter((event) => event.taskId != null && allow.has(event.taskId))
      : EMPTY_EVENTS;

    const users = filterPlan.fetchUserEvents
      ? isAll
        ? userEvents
        : userEvents.filter((event) => {
            if (isUnassignedUserEventTaskId(event.taskId)) {
              return filterPlan.includeUnassignedUserEvents;
            }
            return event.taskId != null && allow.has(event.taskId);
          })
      : EMPTY_EVENTS;

    return [...analysis, ...calendar, ...users];
  }, [data, selectedTaskIds, filterPlan, calendarEvents, userEvents]);

  const sourceError = firstSourceError(
    filterPlan,
    error,
    calendarError,
    userEventsError,
  );
  const pageError = sourceError ?? taskLoadError;
  const pageInitialLoading = anySourceFlag(
    filterPlan,
    initialLoading,
    calendarInitialLoading,
    userEventsInitialLoading,
  );
  const pageIsRefreshing = anySourceFlag(
    filterPlan,
    isRefreshing,
    calendarIsRefreshing,
    userEventsIsRefreshing,
  );

  const ganttData = useGanttData({ viewMode });

  const timelineEvents = events;
  const timelineEventsInitialLoading = pageInitialLoading;
  const timelineEventsIsRefreshing = pageIsRefreshing;
  const timelineEventsError = sourceError;
  const retryTimelineEvents = useCallback(() => {
    void refreshEvents();
  }, [refreshEvents]);

  return {
    tasks,
    tasksLoading,
    taskLoadError,
    timelineTasks,

    events,
    initialLoading: pageInitialLoading,
    isRefreshing: pageIsRefreshing,
    pageError,
    refreshEvents,

    ...ganttData,

    timelineEvents,
    timelineEventsInitialLoading,
    timelineEventsIsRefreshing,
    timelineEventsError,
    retryTimelineEvents,
  };
}
