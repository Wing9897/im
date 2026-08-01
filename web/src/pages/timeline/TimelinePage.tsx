/**
 * Timeline page container.
 *
 * State management lives in {@link useTimelinePageContainer} (grouped return:
 * sources / data / navigation / filters / selection / gantt). Deeply-nested props
 * are also provided via {@link TimelinePageProvider}.
 *
 * INVARIANTS:
 * - Soft-dismiss (`event.dismissed`) ≠ client annotations (`eventStatuses` /
 *   time overrides in SQLite ui-prefs).
 * - Default show dismissed (`showDismissed=true`); uncheck「顯示已移除」in Show menu to hide them.
 * - Do not collapse calendar vs gantt into one view store (cursors / spans differ).
 * - Fill with `h-full` / flex — do not use `100vh` (overflows titlebar/topbar).
 * Regression fences: `TimelinePage.test.tsx`, `timelineDismissUtils.test.ts`,
 *   `useTimelineFiltering.test.ts`.
 */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppPageShell } from "../../components/ui";
import {
  createUserEvent,
  updateUserEvent,
} from "../../api/userEvents";
import {
  dismissTimelineEvent,
  restoreTimelineEvent,
  timelineItemDismissalSource,
} from "../../api/timelineDismissals";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { createRecurringTimelineEvent } from "../../domain/timeline/createRecurringTimelineEvent";
import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import { useErrorToast } from "../../hooks/useErrorToast";
import type { TimelineItem } from "../../types";
import { TimelineControlBar } from "./components/TimelineControlBar";
import { TimelineShowOptionsControl } from "./components/TimelineShowOptionsControl";
import { TimelineViewSwitch } from "./components/TimelineViewSwitch";
import {
  UserEventDialog,
  type UserEventFormValues,
} from "../../components/calendar/UserEventDialog";
import { TimelinePageProvider, type TimelinePageContextValue } from "./TimelinePageContext";
import { useTimelineFullscreen } from "./useTimelineFullscreen";
import { useTimelinePageContainer } from "./useTimelinePageContainer";

/** Fill main canvas height; do not use 100vh (that overflows titlebar/topbar and scrolls the whole page). */
const timelinePageShellClass =
  "timeline-page-fill flex !min-h-0 h-full max-h-full flex-col overflow-hidden";

const timelineFullscreenShellClass =
  "flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface-base p-md text-text-primary";

const scrollAreaClass = "flex min-h-0 flex-1 flex-col overflow-hidden";

type PendingTimelineConfirm =
  | { kind: "dismiss"; event: TimelineItem }
  | { kind: "restore"; event: TimelineItem };

export function TimelinePage() {
  const { t } = useTranslation("timeline");
  const { t: tc } = useTranslation("common");
  const { sources, data, navigation, filters, selection, gantt } = useTimelinePageContainer();
  const { worksets, tasks, refreshTasks } = useTaskCatalog();
  const { showToast } = useToast();
  useErrorToast(data.pageError);
  const { containerRef, isFullscreen, toggleFullscreen } = useTimelineFullscreen();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingEvent, setEditingEvent] = useState<TimelineItem | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [userEventActionBusy, setUserEventActionBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingTimelineConfirm | null>(null);

  const openCreateDialog = useCallback(() => {
    setDialogMode("create");
    setEditingEvent(null);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((event: TimelineItem) => {
    setDialogMode("edit");
    setEditingEvent(event);
    setDialogError(null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (dialogBusy) return;
    setDialogOpen(false);
    setEditingEvent(null);
    setDialogError(null);
  }, [dialogBusy]);

  const handleDialogSubmit = useCallback(
    async (values: UserEventFormValues) => {
      setDialogBusy(true);
      setDialogError(null);
      try {
        const worksetId = toUserEventFormWorksetId(values.worksetId);
        if (dialogMode === "create" && values.kind === "recurring") {
          await createRecurringTimelineEvent({
            title: values.title,
            worksetId,
            isAllDay: values.isAllDay,
            eventStartTime: values.eventStartTime,
            eventEndTime: values.eventEndTime,
            location: values.location,
            body: values.body,
            rrule: values.rrule,
          });
          await refreshTasks().catch(() => {});
        } else if (dialogMode === "create") {
          await createUserEvent({
            title: values.title,
            startTime: values.startTime,
            endTime: values.endTime || null,
            body: values.body,
            location: values.location,
            isAllDay: values.isAllDay,
            worksetId,
          });
        } else if (editingEvent) {
          await updateUserEvent(editingEvent.id, {
            title: values.title,
            startTime: values.startTime,
            endTime: values.endTime || null,
            body: values.body,
            location: values.location,
            isAllDay: values.isAllDay,
            worksetId,
          });
        }
        setDialogOpen(false);
        setEditingEvent(null);
        await data.refreshEvents();
      } catch (error) {
        setDialogError(error instanceof Error ? error.message : t("messages.saveFailed"));
      } finally {
        setDialogBusy(false);
      }
    },
    [dialogMode, editingEvent, data, refreshTasks, t],
  );

  const handleDismissTimelineEvent = useCallback((event: TimelineItem) => {
    setPendingConfirm({ kind: "dismiss", event });
  }, []);

  const handleRestoreTimelineEvent = useCallback((event: TimelineItem) => {
    setPendingConfirm({ kind: "restore", event });
  }, []);

  const confirmPendingAction = useCallback(async () => {
    if (!pendingConfirm) return;
    const { kind, event } = pendingConfirm;
    setUserEventActionBusy(true);
    try {
      if (kind === "dismiss") {
        await dismissTimelineEvent(timelineItemDismissalSource(event.source), event.id);
        if (selection.selectedEvent?.id === event.id) {
          selection.setSelectedEvent(null);
        }
      } else {
        await restoreTimelineEvent(timelineItemDismissalSource(event.source), event.id);
      }
      setPendingConfirm(null);
      await data.refreshEvents();
    } catch (error) {
      const fallback =
        kind === "dismiss" ? t("messages.dismissFailed") : t("messages.restoreFailed");
      showToast(error instanceof Error ? error.message : fallback, "error");
    } finally {
      setUserEventActionBusy(false);
    }
  }, [pendingConfirm, data, selection, showToast, t]);

  const contextValue: TimelinePageContextValue = useMemo(
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
      onEditUserEvent: openEditDialog,
      onDismissTimelineEvent: handleDismissTimelineEvent,
      onRestoreTimelineEvent: handleRestoreTimelineEvent,
      userEventActionBusy,
      showDismissed: filters.showDismissed,
      showOngoing: filters.showOngoing,
      showEnding: filters.showEnding,
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
      openEditDialog,
      handleDismissTimelineEvent,
      handleRestoreTimelineEvent,
      userEventActionBusy,
      filters.showDismissed,
      filters.showOngoing,
      filters.showEnding,
    ],
  );

  return (
    <TimelinePageProvider value={contextValue}>
      <div
        ref={containerRef}
        className={isFullscreen ? timelineFullscreenShellClass : "flex h-full min-h-0 flex-col"}
        data-timeline-fullscreen={isFullscreen ? "true" : undefined}
      >
        <AppPageShell
          width="fluid"
          className={isFullscreen ? "flex min-h-0 flex-1 flex-col overflow-hidden !p-0" : timelinePageShellClass}
        >
          <div className="shrink-0">
            <TimelineControlBar
              selectedSources={sources.selectedSources}
              setSelectedSources={sources.setSelectedSources}
              timelineTasks={sources.timelineTasks}
              worksets={worksets.map((ws) => ({ id: ws.id, name: ws.name }))}
              expandTasks={tasks.map((row) => ({
                id: row.id,
                worksetId: row.worksetId ?? null,
              }))}
              viewMode={sources.viewMode}
              setViewMode={sources.setViewMode}
              timeScale={navigation.timeScale}
              onJumpTo={navigation.jumpTo}
              onMoveCursor={navigation.moveCursor}
              visibleRangeLabel={navigation.visibleRangeLabel}
              onAddEvent={openCreateDialog}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                void toggleFullscreen();
              }}
            >
              <TimelineShowOptionsControl
                showDismissed={filters.showDismissed}
                setShowDismissed={filters.setShowDismissed}
                showOngoing={filters.showOngoing}
                setShowOngoing={filters.setShowOngoing}
                showEnding={filters.showEnding}
                setShowEnding={filters.setShowEnding}
              />
            </TimelineControlBar>
          </div>

          <div className={scrollAreaClass}>
            <TimelineViewSwitch
              initialLoading={data.initialLoading}
              isRefreshing={data.isRefreshing}
              events={data.events}
              filteredEvents={filters.filteredEvents}
              emptyState={sources.emptyState}
              viewMode={sources.viewMode}
              timeScale={navigation.timeScale}
              rangeStart={navigation.rangeStart}
              rangeEvents={navigation.rangeEvents}
              sidebarEvents={filters.sidebarEvents}
              weekDays={navigation.weekDays}
              timeCursor={navigation.timeCursor}
              monthCursor={navigation.monthCursor}
              monthDays={navigation.monthDays}
              monthEvents={navigation.monthEvents}
              focusedDay={navigation.focusedDay}
              onFocusDay={sources.focusDay}
            />
          </div>
        </AppPageShell>
      </div>

      <UserEventDialog
        open={dialogOpen}
        mode={dialogMode}
        worksetOptions={worksets.map((ws) => ({
          id: ws.id,
          name: ws.name,
        }))}
        initial={
          editingEvent
            ? {
                title: editingEvent.title,
                startTime: editingEvent.startTime,
                endTime: editingEvent.endTime ?? "",
                location: editingEvent.location ?? "",
                body: editingEvent.body ?? "",
                worksetId: toUserEventFormWorksetId(editingEvent.worksetId),
                isAllDay: Boolean(editingEvent.isAllDay),
              }
            : { worksetId: toUserEventFormWorksetId(null), isAllDay: false }
        }
        busy={dialogBusy}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={(values) => {
          void handleDialogSubmit(values);
        }}
      />

      {pendingConfirm ? (
        <ConfirmDialog
          title={
            pendingConfirm.kind === "dismiss"
              ? t("detail.dismiss")
              : t("detail.restore")
          }
          body={
            pendingConfirm.kind === "dismiss"
              ? t("messages.dismissConfirm", { title: pendingConfirm.event.title })
              : t("messages.restoreConfirm", { title: pendingConfirm.event.title })
          }
          confirmLabel={tc("dialog.confirm")}
          confirmBusyLabel={tc("dialog.confirm")}
          busy={userEventActionBusy}
          onCancel={() => {
            if (!userEventActionBusy) setPendingConfirm(null);
          }}
          onConfirm={confirmPendingAction}
        />
      ) : null}
    </TimelinePageProvider>
  );
}
