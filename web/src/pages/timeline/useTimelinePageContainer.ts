import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { isEmptySourceFilter } from "../../domain/tasks/sourceFilterSelection";
import { findActivitySpan } from "../tasks/project/projectDetailModel";
import {
  timelineSelectedSourcesFilter,
  type TimelineSelectedSources,
} from "../../domain/ui/namedSourceFilters";
import { startOfDay } from "../../domain/timeline/dateUtils";
import type {
  TimelineEventStatus,
  TimelineEventStatusMap,
  TimelineEventTimeOverrideMap,
} from "../../domain/timeline/status";
import { useDeepLinkFingerprint } from "../../hooks/useDeepLinkFingerprint";
import { usePersistedState } from "../../hooks/usePersistedState";
import {
  hydrateTimelineAnnotations,
  saveTimelineAnnotations,
} from "./timelineAnnotationsStore";
import { useTimelineData } from "./useTimelineData";
import { useTimelineFiltering } from "./useTimelineFiltering";
import {
  parsePersistedTimelineDay,
  useTimelineNavigation,
} from "./useTimelineNavigation";
import { useTimelineSelection } from "./useTimelineSelection";
import {
  TIMELINE_FOCUSED_DAY_STORAGE_KEY,
  TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY,
  TIMELINE_SHOW_DISMISSED_STORAGE_KEY,
  TIMELINE_SHOW_ENDING_STORAGE_KEY,
  TIMELINE_SHOW_ONGOING_STORAGE_KEY,
  TIMELINE_VIEW_MODE_STORAGE_KEY,
} from "./timelinePersistedKeys";

export {
  TIMELINE_FOCUSED_DAY_STORAGE_KEY,
  TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY,
} from "./timelinePersistedKeys";

const VALID_VIEW_MODES = ["calendar", "gantt"] as const;
const ANNOTATIONS_SAVE_DEBOUNCE_MS = 400;

function isTimelineViewMode(value: string | null): value is "calendar" | "gantt" {
  return value === "calendar" || value === "gantt";
}

/**
 * Timeline composed state (sources / data / navigation / filters / selection / gantt).
 *
 * INVARIANTS:
 * - Navigation cursors (`timeCursor` / `rangeStart` / `monthCursor` / `focusedDay`)
 *   stay in `useTimelineNavigation` — do not merge into selection or one mega-store.
 * - `showDismissed` gates soft-dismiss visibility for calendar + gantt; default on.
 * - `showOngoing` / `showEnding` gate month-cell「+N 进行中」／「+N 完结」chips; default on.
 * - Client `eventStatuses` / `eventTimeOverrides` are SQLite ui-prefs (not soft-dismiss).
 * - `?view=` is one-shot deep-link (apply then clear) via fingerprint — do not leave
 *   sticky `?view=` forcing the toggle.
 * - Switching to calendar from quarter/year forces month scale.
 */
export function useTimelinePageContainer() {
  const { t } = useTranslation("timeline");
  const location = useLocation();
  const navigate = useNavigate();
  const deepLinkGate = useDeepLinkFingerprint();
  const urlView = new URLSearchParams(location.search).get("view");

  // ─── Persisted UI state ────────────────────────────────────────────────────
  const [selectedSources, setSelectedSourcesState] = useState<TimelineSelectedSources>(
    () => timelineSelectedSourcesFilter.load(),
  );
  const setSelectedSources = useCallback((ids: TimelineSelectedSources) => {
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
  const [eventStatuses, setEventStatuses] = useState<TimelineEventStatusMap>({});
  const [eventTimeOverrides, setEventTimeOverrides] = useState<TimelineEventTimeOverrideMap>({});
  const [annotationsReady, setAnnotationsReady] = useState(false);
  const [focusedDayIso, setFocusedDayIso] = usePersistedState<string | null>(
    TIMELINE_FOCUSED_DAY_STORAGE_KEY,
    null,
  );
  const focusedDay = useMemo(() => {
    if (focusedDayIso === null || focusedDayIso === "") {
      return null;
    }
    return parsePersistedTimelineDay(focusedDayIso);
  }, [focusedDayIso]);
  const setFocusedDay = useCallback((day: Date | null) => {
    setFocusedDayIso(day ? startOfDay(day).toISOString() : null);
  }, [setFocusedDayIso]);

  const [selectedGanttTaskId, setSelectedGanttTaskId] = usePersistedState<string | null>(
    TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY,
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void hydrateTimelineAnnotations().then((data) => {
      if (cancelled) return;
      setEventStatuses(data.eventStatuses);
      setEventTimeOverrides(data.eventTimeOverrides);
      setAnnotationsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!annotationsReady) return;
    const timer = window.setTimeout(() => {
      void saveTimelineAnnotations({ eventStatuses, eventTimeOverrides });
    }, ANNOTATIONS_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [annotationsReady, eventStatuses, eventTimeOverrides]);

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

  // Board / deep-link: `/timeline?view=calendar|gantt` is one-shot (Monitor-style).
  // Clear `?view=` after apply so later UI toggles are not forced back by a sticky URL.
  useEffect(() => {
    if (!isTimelineViewMode(urlView)) {
      deepLinkGate(location.key, null);
      return;
    }
    if (deepLinkGate(location.key, urlView) === "skip") {
      return;
    }
    handleSetViewMode(urlView);
    const params = new URLSearchParams(location.search);
    if (!params.has("view")) {
      return;
    }
    params.delete("view");
    const nextSearch = params.toString();
    navigate(
      `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`,
      { replace: true },
    );
  }, [
    deepLinkGate,
    handleSetViewMode,
    location.key,
    location.pathname,
    location.search,
    navigate,
    urlView,
  ]);

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

  const handleJumpTo = useCallback(
    (scale: Parameters<typeof navigation.jumpTo>[0]) => {
      setFocusedDay(null);
      navigation.jumpTo(scale);
    },
    [navigation, setFocusedDay],
  );

  const handleMoveCursor = useCallback(
    (delta: number) => {
      if (navigation.timeScale === "month") {
        setFocusedDay(null);
      }
      navigation.moveCursor(delta);
    },
    [navigation, setFocusedDay],
  );

  const setEventStatus = useCallback(
    (eventId: string, status: TimelineEventStatus) => {
      setEventStatuses((current) => ({ ...current, [eventId]: status }));
    },
    [setEventStatuses],
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
