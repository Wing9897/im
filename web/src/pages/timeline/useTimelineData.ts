import { useCallback, useEffect, useMemo } from "react";

import { useMonitorMode } from "../../context/MonitorModeContext";
import { useTaskCatalog, useTaskNameById, useWorksetNameById } from "../../context/TaskCatalogContext";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
import { subscribeResourceModified } from "../../domain/sse/resourceModified";
import { filterAssignableTimelineTasks } from "../../domain/timeline/userEvents";
import { useGeneralWorksetLabel } from "../../domain/timeline/useGeneralWorksetLabel";
import {
  fetchMergedTimelineEvents,
  paddedTimelineFetchWindow,
} from "../../domain/timeline/timelineMergedFetch";
import { resolveTimelineFilterPlan } from "../../domain/timeline/timelineFilterPlan";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useRefreshOnAnalysisEvent } from "../../hooks/useRefreshOnAnalysisEvent";
import type { TimelineItem, TaskActivitySpan } from "../../types";
import { logWarn } from "../../utils/logger";
import { useGanttData } from "./useGanttData";

const EMPTY_EVENTS: TimelineItem[] = [];

interface UseTimelineDataOptions {
  /** `null` = all, `[]` = none, otherwise multi-select (may include `__user__`). */
  selectedSources: SourceFilterSelection;
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

type TimelineFetchKey = {
  startIso: string;
  endIso: string;
  selectedSources: SourceFilterSelection;
  /** Stable fingerprint of the filter plan for cache/effect identity. */
  planKey: string;
  filterPlan: ReturnType<typeof resolveTimelineFilterPlan>;
};

function filterPlanKey(plan: ReturnType<typeof resolveTimelineFilterPlan>): string {
  return [
    plan.fetchAnalysis ? "A" : "-",
    plan.fetchCalendar ? "C" : "-",
    plan.fetchUserEvents ? "U" : "-",
    plan.analysisTaskIds === null ? "*" : plan.analysisTaskIds.join(","),
    plan.recurringTaskIds === null ? "*" : plan.recurringTaskIds.join(","),
    plan.selectedRealTaskIds.join(","),
    plan.explicitTaskIds.join(","),
    plan.selectedWorksetIds.join(","),
  ].join("|");
}

/**
 * Timeline page data hook: catalog + plan-aware merged events + gantt spans.
 *
 * INVARIANTS:
 * - Pages shell stays keep-mounted under canvas — pause expensive Timeline
 *   fetches/subscriptions while the board is the visible shell (`pageActive`).
 * - Fetch + merge go through {@link fetchMergedTimelineEvents} (sharedCalendarFetch
 *   + timedEventMerge). Board keeps {@link fetchMergedTimedBoardEvents} separately.
 */
export function useTimelineData({
  selectedSources,
  viewMode,
  rangeStart,
  rangeEnd,
}: UseTimelineDataOptions): UseTimelineDataReturn {
  const { monitorMode } = useMonitorMode();
  // Pages shell stays keep-mounted under canvas — pause expensive Timeline
  // fetches/subscriptions while the board is the visible shell.
  const pageActive = monitorMode === "pages";
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
  const planKey = useMemo(() => filterPlanKey(filterPlan), [filterPlan]);

  const calendarWindow = useMemo(
    () => paddedTimelineFetchWindow(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const recurringTaskFingerprint = useMemo(
    () =>
      tasks
        .filter((task) => task.analysisMode === "recurring")
        .map((task) => `${task.id}:${task.updatedAt}:${task.isActive}`)
        .join("|"),
    [tasks],
  );

  const fetcher = useCallback(
    (key: TimelineFetchKey) =>
      fetchMergedTimelineEvents({
        selectedSources: key.selectedSources,
        filterPlan: key.filterPlan,
        startIso: key.startIso,
        endIso: key.endIso,
        taskNameById,
        generalWorksetLabel,
        worksetNameById,
      }),
    [taskNameById, generalWorksetLabel, worksetNameById],
  );

  const {
    data,
    initialLoading,
    isRefreshing,
    error,
    execute: fetchEvents,
  } = useAsyncResource(fetcher, { toastOnError: false });

  const refreshEvents = useCallback(async () => {
    if (!filterPlan.fetchAnalysis && !filterPlan.fetchCalendar && !filterPlan.fetchUserEvents) {
      return;
    }
    await fetchEvents({
      startIso: calendarWindow.startIso,
      endIso: calendarWindow.endIso,
      selectedSources,
      planKey,
      filterPlan,
    });
  }, [fetchEvents, filterPlan, calendarWindow, selectedSources, planKey]);

  useEffect(() => {
    if (!pageActive) return;
    if (!filterPlan.fetchAnalysis && !filterPlan.fetchCalendar && !filterPlan.fetchUserEvents) {
      return;
    }
    void fetchEvents({
      startIso: calendarWindow.startIso,
      endIso: calendarWindow.endIso,
      selectedSources,
      planKey,
      filterPlan,
    });
  }, [
    pageActive,
    fetchEvents,
    calendarWindow,
    selectedSources,
    planKey,
    filterPlan,
    recurringTaskFingerprint,
  ]);

  useRefreshOnAnalysisEvent(
    refreshEvents,
    {
      taskIds: pageActive && filterPlan.fetchAnalysis ? filterPlan.analysisTaskIds : [],
      analysisMode: "event",
    },
  );

  useEffect(() => {
    if (!pageActive) return;
    return subscribeResourceModified((detail) => {
      if (detail.resourceType !== "task" && detail.resourceType !== "user_event") {
        return;
      }
      void refreshEvents().catch((err) => {
        logWarn("[timeline] refresh after resource_modified failed", err);
      });
    });
  }, [pageActive, refreshEvents]);

  // Empty / no-op plans must not keep showing a prior merge (effect skips fetch).
  const events = useMemo(() => {
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
    return data ?? EMPTY_EVENTS;
  }, [data, selectedSources, filterPlan]);
  const pageError = error ?? taskLoadError;

  const ganttData = useGanttData({ viewMode });

  const retryTimelineEvents = useCallback(() => {
    void refreshEvents();
  }, [refreshEvents]);

  return {
    tasks,
    tasksLoading,
    taskLoadError,
    timelineTasks,

    events,
    initialLoading,
    isRefreshing,
    pageError,
    refreshEvents,

    ...ganttData,

    timelineEvents: events,
    timelineEventsInitialLoading: initialLoading,
    timelineEventsIsRefreshing: isRefreshing,
    timelineEventsError: error,
    retryTimelineEvents,
  };
}
