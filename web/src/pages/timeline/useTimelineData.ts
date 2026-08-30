import { useCallback, useEffect, useMemo, useRef } from "react";

import { useMonitorMode } from "../../context/MonitorModeContext";
import { useTaskCatalog, useTaskNameById, useWorksetNameById } from "../../context/TaskCatalogContext";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
import { filterAssignableTimelineTasks } from "../../domain/timeline/userEvents";
import { useGeneralWorksetLabel } from "../../domain/timeline/useGeneralWorksetLabel";
import {
  fetchMergedTimelineEvents,
  paddedTimelineFetchWindow,
} from "../../domain/timeline/timelineMergedFetch";
import { resolveTimelineFilterPlan } from "../../domain/timeline/timelineFilterPlan";
import { fetchCalendarShareSubscriptionEvents } from "../../api/calendarShare";
import { applySubscribedDismissals } from "../../domain/calendarShare/subscribedDismissals";
import { projectSubscribedTimelineItems } from "../../domain/calendarShare/subscribedEventProject";
import {
  resolvedSubscribeKeys,
  subscribedEventVisible,
  type SubscribedCalendarSelection,
} from "../../domain/calendarShare/subscribedCalendars";
import { toErrorMessage } from "../../utils/errors";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useTimelineCalendarRefresh } from "../../hooks/useTimelineCalendarRefresh";
import type { AnalysisTask, TimelineItem, TaskActivitySpan } from "../../types";
import { useGanttData } from "./useGanttData";

const EMPTY_EVENTS: TimelineItem[] = [];
const EMPTY_SUBSCRIBE_CATALOG: readonly string[] = [];

interface UseTimelineDataOptions {
  /** `null` = all, `[]` = none, otherwise multi-select (may include `__general__`). */
  selectedSources: SourceFilterSelection;
  /** Timeline-only subscribed calendar keys; never mixed into SourceFilterSelection. */
  selectedSubscribeKeys?: SubscribedCalendarSelection;
  /** `handle/slug` keys from 我的訂閱 (IC list); empty means no subscribed events. */
  subscribeCatalogKeys?: readonly string[];
  /** Current view mode — span fetching only triggers in "gantt" mode. */
  viewMode: "calendar" | "gantt";
  /** Start of the visible date range (calendar window is fetched around it). */
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
  /** Refetch merged timeline events, optionally using a fresh task catalog snapshot. */
  refreshEvents: (catalogOverride?: readonly AnalysisTask[]) => Promise<void>;

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

type TimelineFetchResult = {
  events: TimelineItem[];
  shareError: string | null;
};

type TimelineFetchKey = {
  startIso: string;
  endIso: string;
  selectedSources: SourceFilterSelection;
  selectedSubscribeKeys: SubscribedCalendarSelection;
  subscribeCatalogKeys: readonly string[];
  /** Stable fingerprint of the filter plan for cache/effect identity. */
  planKey: string;
  filterPlan: ReturnType<typeof resolveTimelineFilterPlan>;
};

function filterPlanKey(plan: ReturnType<typeof resolveTimelineFilterPlan>): string {
  return [
    plan.fetchAnalysis ? "A" : "-",
    plan.fetchCalendar ? "C" : "-",
    plan.fetchUserEvents ? "U" : "-",
    plan.fetchItems ? "I" : "-",
    plan.analysisTaskIds === null ? "*" : plan.analysisTaskIds.join(","),
    plan.seriesIds === null ? "*" : plan.seriesIds.join(","),
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
 * - Fetch + merge go through {@link fetchMergedTimelineEvents} (shared
 *   {@link fetchMergedTimedEvents} core). Board uses the same core via
 *   {@link fetchMergedTimedBoardEvents} / {@link fetchBoardEventsList}.
 */
export function useTimelineData({
  selectedSources,
  selectedSubscribeKeys = null,
  subscribeCatalogKeys = EMPTY_SUBSCRIBE_CATALOG,
  viewMode,
  rangeStart,
  rangeEnd,
}: UseTimelineDataOptions): UseTimelineDataReturn {
  const { monitorMode } = useMonitorMode();
  // Pages shell stays keep-mounted under canvas — pause expensive Timeline
  // fetches/subscriptions while the board is the visible shell.
  const pageActive = monitorMode === "pages";
  const { tasks, taskLoadError, tasksLoading, refreshTasks } = useTaskCatalog();

  // `activeOnly` matches the assistant / voice pickers: paused (`isActive=false`)
  // analysis tasks must not stay assignable in the toolbar or UserEventDialog.
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
  const calendarWindowRef = useRef(calendarWindow);
  calendarWindowRef.current = calendarWindow;
  const selectedSourcesRef = useRef(selectedSources);
  selectedSourcesRef.current = selectedSources;
  const selectedSubscribeKeysRef = useRef(selectedSubscribeKeys);
  selectedSubscribeKeysRef.current = selectedSubscribeKeys;
  const subscribeCatalogKeysRef = useRef(subscribeCatalogKeys);
  subscribeCatalogKeysRef.current = subscribeCatalogKeys;
  const subscribeCatalogFingerprint = subscribeCatalogKeys.join("\n");
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const lastSubscribedRef = useRef<TimelineItem[]>([]);

  const fetcher = useCallback(
    async (key: TimelineFetchKey): Promise<TimelineFetchResult> => {
      const localEmpty =
        key.selectedSources !== null &&
        key.selectedSources.taskIds.length === 0 &&
        key.selectedSources.worksetIds.length === 0;
      const skipLocal =
        localEmpty ||
        (!key.filterPlan.fetchAnalysis &&
          !key.filterPlan.fetchCalendar &&
          !key.filterPlan.fetchUserEvents &&
          !key.filterPlan.fetchItems);
      const local = skipLocal
        ? []
        : await fetchMergedTimelineEvents({
            selectedSources: key.selectedSources,
            filterPlan: key.filterPlan,
            startIso: key.startIso,
            endIso: key.endIso,
            taskNameById,
            generalWorksetLabel,
            worksetNameById,
          });
      let subscribed: TimelineItem[] = [];
      let shareError: string | null = null;
      const visibleKeys = resolvedSubscribeKeys(key.selectedSubscribeKeys, key.subscribeCatalogKeys);
      if (visibleKeys.length > 0) {
        try {
          const remote = await fetchCalendarShareSubscriptionEvents(key.startIso, key.endIso);
          subscribed = applySubscribedDismissals(
            projectSubscribedTimelineItems(remote).filter((event) =>
              subscribedEventVisible(event.source, key.selectedSubscribeKeys, key.subscribeCatalogKeys),
            ),
          );
          lastSubscribedRef.current = subscribed;
        } catch (error) {
          shareError = toErrorMessage(error);
          subscribed = lastSubscribedRef.current;
        }
      } else {
        lastSubscribedRef.current = [];
      }
      return { events: [...local, ...subscribed], shareError };
    },
    [taskNameById, generalWorksetLabel, worksetNameById],
  );

  const {
    data,
    initialLoading,
    isRefreshing,
    error,
    execute: fetchEvents,
  } = useAsyncResource(fetcher, { toastOnError: false });

  const refreshEvents = useCallback(
    async (catalogOverride?: readonly AnalysisTask[]) => {
      const catalog = catalogOverride ?? tasksRef.current;
      const selection = selectedSourcesRef.current;
      const subscribeKeys = selectedSubscribeKeysRef.current;
      const catalogKeys = subscribeCatalogKeysRef.current;
      const plan = resolveTimelineFilterPlan(selection, catalog);
      const window = calendarWindowRef.current;
      await fetchEvents({
        startIso: window.startIso,
        endIso: window.endIso,
        selectedSources: selection,
        selectedSubscribeKeys: subscribeKeys,
        subscribeCatalogKeys: catalogKeys,
        planKey: filterPlanKey(plan),
        filterPlan: plan,
      });
    },
    [fetchEvents],
  );

  useEffect(() => {
    if (!pageActive) return;
    void fetchEvents({
      startIso: calendarWindow.startIso,
      endIso: calendarWindow.endIso,
      selectedSources,
      selectedSubscribeKeys,
      subscribeCatalogKeys,
      planKey,
      filterPlan,
    });
  }, [
    pageActive,
    fetchEvents,
    calendarWindow,
    selectedSources,
    selectedSubscribeKeys,
    subscribeCatalogKeys,
    subscribeCatalogFingerprint,
    planKey,
    filterPlan,
  ]);

  useTimelineCalendarRefresh({
    enabled: pageActive,
    refreshEvents,
    refreshTasks,
  });

  const events = useMemo(() => data?.events ?? EMPTY_EVENTS, [data]);
  const pageError = data?.shareError ?? error ?? taskLoadError;

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
