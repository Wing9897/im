import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { TimelinePageContextValue } from "./TimelinePageContext";
import type { useTimelinePageContainer } from "./useTimelinePageContainer";
import type { useTimelinePageDialogs } from "./useTimelinePageDialogs";
import type { useTimelinePageOverlays } from "./useTimelinePageOverlays";

type Container = ReturnType<typeof useTimelinePageContainer>;
type Dialogs = ReturnType<typeof useTimelinePageDialogs>;
type Overlays = ReturnType<typeof useTimelinePageOverlays>;

type Args = {
  sources: Container["sources"];
  data: Container["data"];
  navigation: Container["navigation"];
  filters: Container["filters"];
  selection: Container["selection"];
  gantt: Container["gantt"];
  dialogs: Dialogs;
  overlays: Overlays;
  worksets: readonly { id: string; name: string }[];
  expandTasks: readonly {
    id: string;
    name?: string;
    worksetId?: string | null;
    analysisMode?: string | null;
  }[];
};

/** Assemble TimelinePageProvider value from container + overlays + dialogs. */
export function useTimelinePageContextValue({
  sources,
  data,
  navigation,
  filters,
  selection,
  gantt,
  dialogs,
  overlays,
  worksets,
  expandTasks,
}: Args): TimelinePageContextValue {
  const { t } = useTranslation("timeline");
  return useMemo(
    () => ({
      selectedEvent: selection.selectedEvent,
      onSelectEvent: selection.setSelectedEvent,
      editStartTime: selection.editStartTime,
      editEndTime: selection.editEndTime,
      setEditStartTime: selection.setEditStartTime,
      setEditEndTime: selection.setEditEndTime,
      onSaveTimeOverride: selection.saveTimeOverride,
      onResetTimeOverride: selection.resetTimeOverride,
      onSetEventStatus: sources.setEventStatus,
      eventStatuses: sources.eventStatuses,
      onEditUserEvent: dialogs.openEditDialog,
      onEditItemEvent: dialogs.openEditItem,
      onDismissTimelineEvent: dialogs.handleDismissTimelineEvent,
      onRestoreTimelineEvent: dialogs.handleRestoreTimelineEvent,
      onToggleImportantEvent: dialogs.handleToggleImportantEvent,
      onCreateOnDay: (day) => dialogs.openCreateDialog({ day }),
      userEventActionBusy: dialogs.userEventActionBusy,
      showDismissed: filters.showDismissed,
      showOngoing: filters.showOngoing,
      showEnding: filters.showEnding,
      weatherByDate: overlays.weatherByDate,
      holidaysByDate: overlays.holidaysByDate,
      monthDatesRevealed: overlays.datesReveal.revealed,
      monthLayout: sources.monthLayout,
      monthCardModels: navigation.monthCardModels,
      monthCardsOmitted: navigation.monthCardsOmitted,
      monthCardsEmptyReason: navigation.monthCardsEmptyReason,
      taskSpans: data.taskSpans,
      selectedGanttTaskId: gantt.selectedGanttTaskId,
      onSelectGanttTask: gantt.handleSelectGanttTask,
      spansInitialLoading: data.spansInitialLoading,
      spansIsRefreshing: data.spansIsRefreshing,
      spansError: data.spansError,
      onRetrySpans: data.fetchSpans,
      selectedGanttSpan: gantt.selectedGanttSpan,
      onCloseGanttPanel: () => gantt.setSelectedGanttTaskId(null),
      ganttColumns: navigation.ganttColumns,
      timelineEvents: filters.showDismissed
        ? data.timelineEvents
        : data.timelineEvents.filter((event) => !event.dismissed),
      timelineEventsInitialLoading: data.timelineEventsInitialLoading,
      timelineEventsIsRefreshing: data.timelineEventsIsRefreshing,
      timelineEventsError: data.timelineEventsError,
      onRetryTimelineEvents: data.retryTimelineEvents,
      overviewMode: sources.overviewMode,
      overviewWindow: navigation.overviewWindow,
      onOverviewWindowChange: navigation.setOverviewWindow,
      onOverviewFetchCommit: navigation.commitFetchWindow,
      navigation: {
        timeScale: navigation.timeScale,
        rangeStart: navigation.rangeStart,
        rangeEvents: navigation.rangeEvents,
        weekDays: navigation.weekDays,
        timeCursor: navigation.timeCursor,
        monthCursor: navigation.monthCursor,
        monthDays: navigation.monthDays,
        monthEvents: navigation.monthEvents,
        focusedDay: navigation.focusedDay,
        onFocusDay: sources.focusDay,
        events: data.events,
        filteredEvents: filters.filteredEvents,
        initialLoading: data.initialLoading,
        isRefreshing: data.isRefreshing,
        emptyState: sources.emptyState,
        sidebarEvents: filters.sidebarEvents,
        sidebarDay: filters.sidebarDay,
        sidebarOutOfView: filters.sidebarOutOfView,
        visibleRangeLabel: navigation.visibleRangeLabel,
        onJumpTo: navigation.jumpTo,
        onMoveCursor: navigation.moveCursor,
        overviewRangeId: navigation.overviewRangeId ?? "",
        onOverviewRangeChange: navigation.applyOverviewRange,
        jumpDateValue: navigation.jumpDateValue,
        onJumpDate: navigation.jumpToDate,
      },
      chrome: {
        selectedSources: sources.selectedSources,
        setSelectedSources: sources.setSelectedSources,
        timelineTasks: sources.timelineTasks,
        worksets: worksets.map((ws) => ({ id: ws.id, name: ws.name })),
        expandTasks: expandTasks.map((row) => ({
          id: row.id,
          name: row.name,
          worksetId: row.worksetId ?? null,
          analysisMode: row.analysisMode ?? null,
        })),
        viewMode: sources.viewMode,
        setViewMode: sources.setViewMode,
        monthLayout: sources.monthLayout,
        onMonthLayoutChange: sources.setMonthLayout,
        overviewMode: sources.overviewMode ?? false,
        onOverviewModeChange: sources.setOverviewMode,
        onAddEvent: () => {
          dialogs.openCreateDialog();
        },
        showLoadingIndicator: data.initialLoading || data.isRefreshing,
        loadingLabel: data.initialLoading ? t("view.loading") : t("view.refreshing"),
        subscribeCalendars: sources.subscribeCalendars,
        selectedSubscribeKeys: sources.selectedSubscribeKeys ?? null,
        onChangeSubscribeKeys: sources.setSelectedSubscribeKeys,
        subscribeAvailability: sources.subscribeAvailability ?? "ok",
      },
    }),
    [
      sources,
      data,
      navigation.ganttColumns,
      navigation.overviewWindow,
      navigation.setOverviewWindow,
      navigation.commitFetchWindow,
      gantt,
      selection,
      dialogs,
      filters.showDismissed,
      filters.showOngoing,
      filters.showEnding,
      overlays.weatherByDate,
      overlays.holidaysByDate,
      overlays.datesReveal.revealed,
      navigation.monthCardModels,
      navigation.monthCardsOmitted,
      navigation.monthCardsEmptyReason,
      navigation.timeScale,
      navigation.rangeStart,
      navigation.rangeEvents,
      navigation.weekDays,
      navigation.timeCursor,
      navigation.monthCursor,
      navigation.monthDays,
      navigation.monthEvents,
      navigation.focusedDay,
      navigation.visibleRangeLabel,
      navigation.jumpTo,
      navigation.moveCursor,
      navigation.overviewRangeId,
      navigation.applyOverviewRange,
      navigation.jumpDateValue,
      navigation.jumpToDate,
      filters.filteredEvents,
      filters.sidebarEvents,
      filters.sidebarDay,
      filters.sidebarOutOfView,
      worksets,
      expandTasks,
      t,
    ],
  );
}
