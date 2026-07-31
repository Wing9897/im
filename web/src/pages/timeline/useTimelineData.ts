import { useCallback, useEffect, useMemo } from "react";

import { fetchCalendarOccurrences, fetchTimelineEvents } from "../../api/results";
import { listUserEvents } from "../../api/userEvents";
import { userEventMatchesSourceSelection } from "../../domain/tasks/sourceFilterSelection";
import {
  mergeWithCalendarOccurrences,
  userEventToTimelineItem,
} from "../../domain/timeline/timedEventMerge";
import { useTaskCatalog, useTaskNameById, useWorksetNameById } from "../../context/TaskCatalogContext";
import type { TimelineSelectedSources } from "../../domain/ui/namedSourceFilters";
import { subscribeResourceModified } from "../../domain/sse/resourceModified";
import { filterAssignableTimelineTasks } from "../../domain/timeline/userEvents";
import { useGeneralWorksetLabel } from "../../domain/timeline/useGeneralWorksetLabel";
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
  selectedSources: TimelineSelectedSources;
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
  selectedSources,
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
  const worksetNameById = useWorksetNameById();
  const generalWorksetLabel = useGeneralWorksetLabel();

  const filterPlan = useMemo(
    () => resolveTimelineFilterPlan(selectedSources, tasks),
    [selectedSources, tasks],
  );

  const selectedSourcesKey =
    selectedSources === null
      ? "*"
      : `t:${selectedSources.taskIds.join("|")}|w:${selectedSources.worksetIds.join("|")}`;

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

  const recurringTaskFingerprint = useMemo(
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
  }, [fetchEvents, calendarWindow, filterPlan.fetchAnalysis, filterPlan.analysisTaskIds, selectedSourcesKey]);

  useEffect(() => {
    if (!filterPlan.fetchCalendar) return;
    void executeCalendarFetch({
      ...calendarWindow,
      taskIds: filterPlan.recurringTaskIds,
    });
  }, [
    executeCalendarFetch,
    calendarWindow,
    recurringTaskFingerprint,
    filterPlan.fetchCalendar,
    filterPlan.recurringTaskIds,
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
          taskIds: filterPlan.recurringTaskIds,
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

  const userEvents = useMemo(
    () =>
      (userEventsData ?? [])
        .map((event) =>
          userEventToTimelineItem(event, taskNameById, generalWorksetLabel, worksetNameById),
        )
        .filter((event): event is TimelineItem => event !== null),
    [userEventsData, taskNameById, generalWorksetLabel, worksetNameById],
  );

  const events = useMemo(() => {
    if (selectedSources !== null && selectedSources.taskIds.length === 0 && selectedSources.worksetIds.length === 0) {
      return EMPTY_EVENTS;
    }

    const analysis = filterPlan.fetchAnalysis ? (data ?? EMPTY_EVENTS) : EMPTY_EVENTS;
    const allow = new Set(filterPlan.selectedRealTaskIds);
    const allowWorksets = new Set(filterPlan.selectedWorksetIds);
    const allowExplicitTasks = new Set(filterPlan.explicitTaskIds);
    const isAll = selectedSources === null;

    const calendarOccurrences = filterPlan.fetchCalendar
      ? isAll
        ? (calendarData ?? [])
        : (calendarData ?? []).filter(
            (occurrence) => occurrence.taskId != null && allow.has(occurrence.taskId),
          )
      : [];

    const users = filterPlan.fetchUserEvents
      ? isAll
        ? userEvents
        : userEvents.filter((event) =>
            userEventMatchesSourceSelection(event, allowWorksets, allowExplicitTasks),
          )
      : EMPTY_EVENTS;

    // Same id / taskId|startTime dedupe as Board (skip RRULE bars already covered).
    return mergeWithCalendarOccurrences(
      [...analysis, ...users],
      calendarOccurrences,
    ) as TimelineItem[];
  }, [data, selectedSources, filterPlan, calendarData, userEvents]);

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
