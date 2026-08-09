import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { isEmptySourceFilter } from "../../domain/tasks/sourceFilterSelection";
import { findActivitySpan } from "../tasks/agent/projectDetailModel";
import { timelineSelectedSourcesFilter } from "../../domain/ui/namedSourceFilters";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  startOfDay,
} from "../../domain/timeline/dateUtils";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useTimelineAnnotations } from "./useTimelineAnnotations";
import { useTimelineData } from "./useTimelineData";
import { useTimelineFiltering } from "./useTimelineFiltering";
import {
  parsePersistedTimelineDay,
  useTimelineNavigation,
} from "./useTimelineNavigation";
import { useTimelineSelection } from "./useTimelineSelection";
import { useTimelineViewDeepLink } from "./useTimelineViewDeepLink";
import {
  TIMELINE_FOCUSED_DAY_STORAGE_KEY,
  TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY,
  TIMELINE_SHOW_DISMISSED_STORAGE_KEY,
  TIMELINE_SHOW_ENDING_STORAGE_KEY,
  TIMELINE_SHOW_ONGOING_STORAGE_KEY,
  TIMELINE_VIEW_MODE_STORAGE_KEY,
} from "../../domain/prefs";

export {
  TIMELINE_FOCUSED_DAY_STORAGE_KEY,
  TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY,
} from "../../domain/prefs";

const VALID_VIEW_MODES = ["calendar", "gantt"] as const;

/**
 * Timeline composed state (sources / data / navigation / filters / selection / gantt).
 *
 * INVARIANTS:
 * - Navigation cursors (`timeCursor` / `rangeStart` / `monthCursor` / `focusedDay`)
 *   stay in `useTimelineNavigation` — do not merge into selection or one mega-store.
 * - `showDismissed` gates soft-dismiss visibility for calendar + gantt; default on.
 * - `showOngoing` / `showEnding` gate month-cell「+N 进行中」／「+N 结束」chips; default on.
 * - Client `eventStatuses` / `eventTimeOverrides` are SQLite ui-prefs (not soft-dismiss).
 * - `?view=` is one-shot deep-link (apply then clear) via fingerprint — do not leave
 *   sticky `?view=` forcing the toggle.
 * - Switching to calendar from quarter/year forces month scale.
 */
export function useTimelinePageContainer() {
  const { t } = useTranslation("timeline");

  // ─── Persisted UI state ────────────────────────────────────────────────────
  const [selectedSources, setSelectedSourcesState] = useState<SourceFilterSelection>(
    () => timelineSelectedSourcesFilter.load(),
  );
  const setSelectedSources = useCallback((ids: SourceFilterSelection) => {
    setSelectedSourcesState(ids);
    timelineSelectedSourcesFilter.save(ids);
  }, []);
  const [rawViewMode, setViewMode] = usePersistedState<"calendar" | "gantt">(
    TIMELINE_VIEW_MODE_STORAGE_KEY,
    "calendar",
  );
  const viewMode: "calendar" | "gantt" =
    (VALID_VIEW_MODES as readonly string[]).includes(rawViewMode) ? rawViewMode : "calendar";
  useEffect(() => { if (rawViewMode !== viewMode) setViewMode("calendar"); }, [rawViewMode, viewMode, setViewMode]);

  const [showDismissed, setShowDismissed] = usePersistedState(
    TIMELINE_SHOW_DISMISSED_STORAGE_KEY,
    true,
  );
  const [showOngoing, setShowOngoing] = usePersistedState(
    TIMELINE_SHOW_ONGOING_STORAGE_KEY,
    true,
  );
  const [showEnding, setShowEnding] = usePersistedState(
    TIMELINE_SHOW_ENDING_STORAGE_KEY,
    true,
  );
  const {
    eventStatuses,
    eventTimeOverrides,
    setEventStatuses,
    setEventTimeOverrides,
    setEventStatus,
  } = useTimelineAnnotations();
  const [focusedDayIso, setFocusedDayIso] = usePersistedState<string | null>(
    TIMELINE_FOCUSED_DAY_STORAGE_KEY,
    startOfDay(new Date()).toISOString(),
  );
  const focusedDay = useMemo(() => {
    if (focusedDayIso === null || focusedDayIso === "") {
      // Legacy null / cleared → today so the sidebar stays day-scoped.
      return startOfDay(new Date());
    }
    return parsePersistedTimelineDay(focusedDayIso) ?? startOfDay(new Date());
  }, [focusedDayIso]);
  const setFocusedDay = useCallback((day: Date | null) => {
    // null means "reset to today" (sidebar never shows the full view range).
    setFocusedDayIso(startOfDay(day ?? new Date()).toISOString());
  }, [setFocusedDayIso]);

  const [selectedGanttTaskId, setSelectedGanttTaskId] = usePersistedState<string | null>(
    TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY,
    null,
  );

  // ─── Composed hooks ────────────────────────────────────────────────────────
  const navigation = useTimelineNavigation();
  const data = useTimelineData({
    selectedSources,
    viewMode,
    rangeStart: navigation.rangeStart,
    rangeEnd: navigation.rangeEnd,
  });

  const filtering = useTimelineFiltering({
    events: data.events,
    eventTimeOverrides,
    rangeStart: navigation.rangeStart,
    rangeEnd: navigation.rangeEnd,
    monthCursor: navigation.monthCursor,
    showDismissed,
    focusedDay,
  });

  const selection = useTimelineSelection({
    eventLookup: filtering.eventLookup,
    rawEventLookup: filtering.rawEventLookup,
    rangeStart: navigation.rangeStart,
    rangeEnd: navigation.rangeEnd,
    setEventStatuses,
    setEventTimeOverrides,
  });

  // ─── Glue logic ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (data.tasksLoading) return;
    const catalogIds = data.timelineTasks.map((t) => t.id);
    const worksetIds = [
      SYSTEM_WORKSET_ID,
      ...new Set(
        data.timelineTasks
          .map((t) => t.worksetId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const pruned = timelineSelectedSourcesFilter.prune(selectedSources, catalogIds, worksetIds);
    if (pruned !== selectedSources) {
      setSelectedSources(pruned);
    }
  }, [
    selectedSources,
    setSelectedSources,
    data.tasksLoading,
    data.timelineTasks,
  ]);

  const handleSetViewMode = useCallback((mode: "calendar" | "gantt") => {
    setViewMode(mode);
    if (mode === "calendar" && (navigation.timeScale === "quarter" || navigation.timeScale === "year")) {
      navigation.setTimeScale("month");
    }
  }, [setViewMode, navigation]);

  useTimelineViewDeepLink(handleSetViewMode);

  const handleSelectGanttTask = useCallback(
    (taskId: string) => setSelectedGanttTaskId((prev) => (prev === taskId ? null : taskId)),
    [setSelectedGanttTaskId],
  );
  const selectedGanttSpan =
    selectedGanttTaskId !== null
      ? findActivitySpan(data.taskSpans, selectedGanttTaskId)
      : null;

  const focusDay = useCallback((day: Date) => {
    selection.setSelectedEvent(null);
    if (navigation.timeScale === "day") navigation.setTimeCursor(startOfDay(day));
    setFocusedDay(startOfDay(day));
  }, [navigation, selection, setFocusedDay]);

  /** Jump calendar cursor + focused day (deep-links from workset summary). */
  const goToDay = useCallback(
    (day: Date) => {
      const normalized = startOfDay(day);
      navigation.setTimeCursor(normalized);
      setFocusedDay(normalized);
    },
    [navigation, setFocusedDay],
  );

  const handleJumpTo = useCallback(
    (scale: Parameters<typeof navigation.jumpTo>[0]) => {
      // Jump snaps the cursor to today — keep the sidebar on today too.
      setFocusedDay(startOfDay(new Date()));
      navigation.jumpTo(scale);
    },
    [navigation, setFocusedDay],
  );

  const handleMoveCursor = useCallback(
    (delta: number) => {
      const scale = navigation.timeScale;
      const cursor = navigation.timeCursor;
      let nextFocus = cursor;
      if (scale === "day") nextFocus = addDays(cursor, delta);
      else if (scale === "week") nextFocus = addDays(cursor, delta * 7);
      else if (scale === "quarter") nextFocus = addQuarters(cursor, delta);
      else if (scale === "year") nextFocus = addYears(cursor, delta);
      else nextFocus = addMonths(cursor, delta);
      navigation.moveCursor(delta);
      // Sidebar stays day-scoped: follow the navigated cursor day.
      setFocusedDay(startOfDay(nextFocus));
    },
    [navigation, setFocusedDay],
  );

  const emptyState =
    selectedSources !== null &&
    selectedSources.taskIds.length === 0 &&
    selectedSources.worksetIds.length === 1 &&
    selectedSources.worksetIds[0] === SYSTEM_WORKSET_ID
      ? t("empty.noUserEvents")
      : selectedSources !== null && isEmptySourceFilter(selectedSources)
        ? t("empty.needData")
        : data.timelineTasks.length === 0
          ? t("empty.noTasks")
          : t("empty.needData");

  return {
    sources: {
      selectedSources,
      setSelectedSources,
      timelineTasks: data.timelineTasks,
      viewMode,
      setViewMode: handleSetViewMode,
      emptyState,
      eventStatuses,
      setEventStatus,
      focusDay,
      goToDay,
    },
    data: {
      events: data.events,
      initialLoading: data.initialLoading,
      isRefreshing: data.isRefreshing,
      pageError: data.pageError,
      refreshEvents: data.refreshEvents,
      taskSpans: data.taskSpans,
      spansInitialLoading: data.spansInitialLoading,
      spansIsRefreshing: data.spansIsRefreshing,
      spansError: data.spansError,
      fetchSpans: data.fetchSpans,
      timelineEvents: data.timelineEvents,
      timelineEventsInitialLoading: data.timelineEventsInitialLoading,
      timelineEventsIsRefreshing: data.timelineEventsIsRefreshing,
      timelineEventsError: data.timelineEventsError,
      retryTimelineEvents: data.retryTimelineEvents,
    },
    navigation: {
      timeScale: navigation.timeScale,
      setTimeScale: navigation.setTimeScale,
      rangeStart: navigation.rangeStart,
      rangeEvents: filtering.rangeEvents,
      weekDays: navigation.weekDays,
      timeCursor: navigation.timeCursor,
      monthCursor: navigation.monthCursor,
      monthDays: navigation.monthDays,
      monthEvents: filtering.monthEvents,
      ganttColumns: navigation.ganttColumns,
      focusedDay,
      moveCursor: handleMoveCursor,
      jumpTo: handleJumpTo,
      visibleRangeLabel: navigation.visibleRangeLabel,
    },
    filters: {
      showDismissed,
      setShowDismissed,
      showOngoing,
      setShowOngoing,
      showEnding,
      setShowEnding,
      filteredEvents: filtering.filteredEvents,
      sidebarEvents: filtering.sidebarEvents,
    },
    selection: {
      selectedEvent: selection.selectedEvent,
      setSelectedEvent: selection.setSelectedEvent,
      editStartTime: selection.editStartTime,
      setEditStartTime: selection.setEditStartTime,
      editEndTime: selection.editEndTime,
      setEditEndTime: selection.setEditEndTime,
      saveTimeOverride: selection.saveTimeOverride,
      resetTimeOverride: selection.resetTimeOverride,
    },
    gantt: {
      selectedGanttTaskId,
      handleSelectGanttTask,
      selectedGanttSpan,
      setSelectedGanttTaskId,
    },
  };
}
