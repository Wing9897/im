import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { isEmptySourceFilter } from "../../domain/tasks/sourceFilterSelection";
import { findActivitySpan } from "../../domain/tasks/agentTaskSelectors";
import { timelineSelectedSourcesFilter } from "../../domain/ui/namedSourceFilters";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
import {
  usePersistedSourceFilter,
  usePruneSourceFilterToCatalog,
} from "../../hooks/usePersistedSourceFilter";
import { useTimelineAnnotations } from "./useTimelineAnnotations";
import { useTimelineCursorActions } from "./useTimelineCursorActions";
import { useTimelineData } from "./useTimelineData";
import { useTimelineFiltering } from "./useTimelineFiltering";
import { useTimelineNavigation } from "./useTimelineNavigation";
import { useTimelinePagePrefs } from "./useTimelinePagePrefs";
import { useTimelineSelection } from "./useTimelineSelection";
import { useTimelineViewDeepLink } from "./useTimelineViewDeepLink";

export {
  TIMELINE_FOCUSED_DAY_STORAGE_KEY,
  TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY,
} from "../../domain/prefs";

/** Empty-state copy key for the current source selection / catalog state. */
function emptyStateKey(
  selectedSources: SourceFilterSelection,
  hasTimelineTasks: boolean,
): string {
  if (
    selectedSources !== null &&
    selectedSources.taskIds.length === 0 &&
    selectedSources.worksetIds.length === 1 &&
    selectedSources.worksetIds[0] === SYSTEM_WORKSET_ID
  ) {
    return "empty.noUserEvents";
  }
  if (selectedSources !== null && isEmptySourceFilter(selectedSources)) {
    return "empty.needData";
  }
  return hasTimelineTasks ? "empty.needData" : "empty.noTasks";
}

/**
 * Timeline composed state (sources / data / navigation / filters / selection / gantt).
 *
 * INVARIANTS:
 * - Navigation cursors (`timeCursor` / `rangeStart` / `monthCursor` / `focusedDay`)
 *   stay in `useTimelineNavigation` / `useTimelinePagePrefs` — do not merge into
 *   selection or one mega-store.
 * - `showDismissed` gates soft-dismiss visibility for calendar + gantt; default on.
 * - `showOngoing` / `showEnding` gate month-cell「+N 进行中」／「+N 结束」chips; default on.
 * - Client `eventStatuses` / `eventTimeOverrides` are SQLite ui-prefs (not soft-dismiss).
 * - `?view=` is one-shot deep-link (apply then clear) via fingerprint — do not leave
 *   sticky `?view=` forcing the toggle.
 * - Switching to calendar from quarter/year forces month scale.
 */
export function useTimelinePageContainer() {
  const { t } = useTranslation("timeline");

  const prefs = useTimelinePagePrefs();
  const {
    eventStatuses,
    eventTimeOverrides,
    setEventStatuses,
    setEventTimeOverrides,
    setEventStatus,
  } = useTimelineAnnotations();

  const navigation = useTimelineNavigation();

  const { selectedSources, setSelectedSources } = usePersistedSourceFilter(
    timelineSelectedSourcesFilter,
  );
  const data = useTimelineData({
    selectedSources,
    viewMode: prefs.viewMode,
    rangeStart: navigation.rangeStart,
    rangeEnd: navigation.rangeEnd,
  });
  usePruneSourceFilterToCatalog(timelineSelectedSourcesFilter, {
    selectedSources,
    setSelectedSources,
    catalog: data.timelineTasks,
    catalogLoading: data.tasksLoading,
  });

  const filtering = useTimelineFiltering({
    events: data.events,
    eventTimeOverrides,
    rangeStart: navigation.rangeStart,
    rangeEnd: navigation.rangeEnd,
    monthCursor: navigation.monthCursor,
    showDismissed: prefs.showDismissed,
    focusedDay: prefs.focusedDay,
  });

  const selection = useTimelineSelection({
    eventLookup: filtering.eventLookup,
    rawEventLookup: filtering.rawEventLookup,
    rangeStart: navigation.rangeStart,
    rangeEnd: navigation.rangeEnd,
    setEventStatuses,
    setEventTimeOverrides,
  });

  const clearSelectedEvent = useCallback(
    () => selection.setSelectedEvent(null),
    [selection],
  );
  const actions = useTimelineCursorActions({
    navigation,
    setViewMode: prefs.setViewMode,
    setFocusedDay: prefs.setFocusedDay,
    clearSelectedEvent,
  });

  useTimelineViewDeepLink(actions.handleSetViewMode);

  const handleSelectGanttTask = useCallback(
    (taskId: string) =>
      prefs.setSelectedGanttTaskId((prev) => (prev === taskId ? null : taskId)),
    [prefs],
  );
  const selectedGanttSpan =
    prefs.selectedGanttTaskId !== null
      ? findActivitySpan(data.taskSpans, prefs.selectedGanttTaskId)
      : null;

  const emptyState = useMemo(
    () => t(emptyStateKey(selectedSources, data.timelineTasks.length > 0)),
    [t, selectedSources, data.timelineTasks.length],
  );

  return {
    sources: {
      selectedSources,
      setSelectedSources,
      timelineTasks: data.timelineTasks,
      viewMode: prefs.viewMode,
      setViewMode: actions.handleSetViewMode,
      emptyState,
      eventStatuses,
      setEventStatus,
      focusDay: actions.focusDay,
      goToDay: actions.goToDay,
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
      focusedDay: prefs.focusedDay,
      moveCursor: actions.handleMoveCursor,
      jumpTo: actions.handleJumpTo,
      visibleRangeLabel: navigation.visibleRangeLabel,
    },
    filters: {
      showDismissed: prefs.showDismissed,
      setShowDismissed: prefs.setShowDismissed,
      showOngoing: prefs.showOngoing,
      setShowOngoing: prefs.setShowOngoing,
      showEnding: prefs.showEnding,
      setShowEnding: prefs.setShowEnding,
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
      selectedGanttTaskId: prefs.selectedGanttTaskId,
      handleSelectGanttTask,
      selectedGanttSpan,
      setSelectedGanttTaskId: prefs.setSelectedGanttTaskId,
    },
  };
}
