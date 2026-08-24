import { useMemo } from "react";

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
}: Args): TimelinePageContextValue {
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
    }),
    [
      sources,
      data,
      navigation.ganttColumns,
      gantt,
      selection,
      dialogs,
      filters.showDismissed,
      filters.showOngoing,
      filters.showEnding,
      overlays.weatherByDate,
      overlays.holidaysByDate,
      overlays.datesReveal.revealed,
    ],
  );
}
