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

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AppPageShell, PillButton } from "../../components/ui";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { startOfDay } from "../../domain/timeline/dateUtils";
import { useErrorToast } from "../../hooks/useErrorToast";
import { useMonthHolidays } from "../../hooks/useMonthHolidays";
import { useMonthWeather } from "../../hooks/useMonthWeather";
import { getOsTimeMs } from "../../utils/time";
import { useMonthDateReveal } from "./calendar/useMonthDateReveal";
import { TimelineControlBar } from "./components/TimelineControlBar";
import { TimelineShowOptionsControl } from "./components/TimelineShowOptionsControl";
import { TimelineViewSwitch } from "./components/TimelineViewSwitch";
import { TimelinePageProvider, type TimelinePageContextValue } from "./TimelinePageContext";
import { TimelinePageDialogs } from "./TimelinePageDialogs";
import { useTimelineFullscreen } from "./useTimelineFullscreen";
import { useTimelinePageContainer } from "./useTimelinePageContainer";
import { useTimelinePageDialogs } from "./useTimelinePageDialogs";

/** Fill main canvas height; do not use 100vh (that overflows titlebar/topbar and scrolls the whole page).
 * No overflow-hidden on the fill — canvas/main clip via `:has(.timeline-page-fill)`;
 * overflow-hidden on this shell kills child backdrop-filter over photo BG. */
const timelinePageShellClass =
  "timeline-page-fill flex !min-h-0 h-full max-h-full flex-col";

const timelineFullscreenShellClass =
  "im-fs-atmosphere im-page-shell flex h-full min-h-0 w-full flex-col p-md text-text-primary";

const timelineWindowedShellClass = "im-fs-atmosphere flex h-full min-h-0 flex-col";

const scrollAreaClass = "flex min-h-0 flex-1 flex-col overflow-hidden";

export function TimelinePage() {
  const { t } = useTranslation("timeline");
  const [searchParams, setSearchParams] = useSearchParams();
  const { sources, data, navigation, filters, selection, gantt } = useTimelinePageContainer();
  const { worksets, tasks } = useTaskCatalog();
  useErrorToast(data.pageError);
  const { containerRef, isFullscreen, toggleFullscreen } = useTimelineFullscreen();
  const dialogs = useTimelinePageDialogs({
    refreshEvents: data.refreshEvents,
    selectedEvent: selection.selectedEvent,
    setSelectedEvent: selection.setSelectedEvent,
  });
  const createLinkHandled = useRef(false);
  const eventLinkHandled = useRef<string | null>(null);
  const eventDayJumped = useRef<string | null>(null);
  const weatherEnabled = sources.viewMode === "calendar";
  const weatherDays = useMemo(() => {
    if (!weatherEnabled) return [] as Date[];
    if (navigation.timeScale === "week") return navigation.weekDays;
    if (navigation.timeScale === "day") return [navigation.rangeStart];
    return navigation.monthDays;
  }, [
    weatherEnabled,
    navigation.timeScale,
    navigation.weekDays,
    navigation.rangeStart,
    navigation.monthDays,
  ]);
  const {
    weatherByDate,
    loading: weatherLoading,
    refresh: refreshWeather,
  } = useMonthWeather(weatherEnabled, weatherDays);
  const {
    holidaysByDate,
    loading: holidaysLoading,
    refresh: refreshHolidays,
  } = useMonthHolidays(weatherEnabled, weatherDays);
  const overlayLoading = weatherLoading || holidaysLoading;
  const datesReveal = useMonthDateReveal();
  const showMonthDatesReveal =
    sources.viewMode === "calendar" && navigation.timeScale === "month";

  // Deep-link from workset detail: /timeline?newEvent=1&worksetId=…
  useEffect(() => {
    const wantsNew = searchParams.get("newEvent") === "1";
    if (!wantsNew) {
      createLinkHandled.current = false;
      return;
    }
    if (createLinkHandled.current) return;
    createLinkHandled.current = true;
    const wid = searchParams.get("worksetId")?.trim() || null;
    const itemId = searchParams.get("itemId")?.trim() || null;
    dialogs.openCreateDialog({ worksetId: wid, itemId });
    const next = new URLSearchParams(searchParams);
    next.delete("newEvent");
    next.delete("worksetId");
    next.delete("itemId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, dialogs]);

  // Deep-link from workset summary: /timeline?eventId=…&at=…
  useEffect(() => {
    const eventId = searchParams.get("eventId")?.trim();
    if (!eventId) {
      eventLinkHandled.current = null;
      eventDayJumped.current = null;
      return;
    }

    if (eventDayJumped.current !== eventId) {
      const atRaw = searchParams.get("at")?.trim();
      if (atRaw) {
        const atMs = getOsTimeMs(atRaw);
        if (Number.isFinite(atMs)) {
          sources.goToDay(startOfDay(new Date(atMs)));
        }
      }
      eventDayJumped.current = eventId;
    }

    if (eventLinkHandled.current === eventId) return;
    if (data.initialLoading) return;

    const match =
      data.events.find((row) => row.id === eventId) ??
      filters.filteredEvents.find((row) => row.id === eventId) ??
      null;

    eventLinkHandled.current = eventId;
    const next = new URLSearchParams(searchParams);
    next.delete("eventId");
    next.delete("at");
    setSearchParams(next, { replace: true });

    if (match) {
      selection.setSelectedEvent(match);
    }
  }, [
    searchParams,
    setSearchParams,
    data.initialLoading,
    data.events,
    filters.filteredEvents,
    sources,
    selection,
  ]);

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
      weatherByDate,
      holidaysByDate,
      monthDatesRevealed: datesReveal.revealed,
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
      weatherByDate,
      holidaysByDate,
      datesReveal.revealed,
    ],
  );

  return (
    <TimelinePageProvider value={contextValue}>
      <div
        ref={containerRef}
        className={isFullscreen ? timelineFullscreenShellClass : timelineWindowedShellClass}
        data-timeline-fullscreen={isFullscreen ? "true" : undefined}
      >
        <AppPageShell
          width="fluid"
          className={isFullscreen ? "flex min-h-0 flex-1 flex-col !p-0" : timelinePageShellClass}
        >
          <div className="shrink-0">
            <TimelineControlBar
              selectedSources={sources.selectedSources}
              setSelectedSources={sources.setSelectedSources}
              timelineTasks={sources.timelineTasks}
              worksets={worksets.map((ws) => ({ id: ws.id, name: ws.name }))}
              expandTasks={tasks.map((row) => ({
                id: row.id,
                name: row.name,
                worksetId: row.worksetId ?? null,
                analysisMode: row.analysisMode ?? null,
              }))}
              viewMode={sources.viewMode}
              setViewMode={sources.setViewMode}
              timeScale={navigation.timeScale}
              onJumpTo={navigation.jumpTo}
              onMoveCursor={navigation.moveCursor}
              visibleRangeLabel={navigation.visibleRangeLabel}
              onAddEvent={() => dialogs.openCreateDialog()}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                void toggleFullscreen();
              }}
              showLoadingIndicator={data.initialLoading || data.isRefreshing}
              loadingLabel={
                data.initialLoading ? t("view.loading") : t("view.refreshing")
              }
            >
              {weatherEnabled ? (
                <PillButton
                  type="button"
                  onClick={() => {
                    void refreshWeather();
                    void refreshHolidays();
                  }}
                  disabled={overlayLoading}
                  title={t("calendar.weatherRefresh")}
                  aria-label={t("calendar.weatherRefresh")}
                  data-testid="timeline-weather-refresh"
                >
                  <RefreshCw
                    size={16}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className={overlayLoading ? "animate-spin" : undefined}
                  />
                </PillButton>
              ) : null}
              <TimelineShowOptionsControl
                showDismissed={filters.showDismissed}
                setShowDismissed={filters.setShowDismissed}
                showOngoing={filters.showOngoing}
                setShowOngoing={filters.setShowOngoing}
                showEnding={filters.showEnding}
                setShowEnding={filters.setShowEnding}
                monthDateReveal={
                  showMonthDatesReveal
                    ? {
                        persisted: datesReveal.persisted,
                        onPersistedChange: datesReveal.onPersistedChange,
                        onPointerEnter: datesReveal.onPointerEnter,
                        onPointerLeave: datesReveal.onPointerLeave,
                      }
                    : null
                }
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

      <TimelinePageDialogs
        dialogOpen={dialogs.dialogOpen}
        dialogMode={dialogs.dialogMode}
        editingEvent={dialogs.editingEvent}
        createInitial={dialogs.createInitial}
        dialogBusy={dialogs.dialogBusy}
        dialogError={dialogs.dialogError}
        worksetOptions={worksets.map((ws) => ({ id: ws.id, name: ws.name }))}
        pendingConfirm={dialogs.pendingConfirm}
        userEventActionBusy={dialogs.userEventActionBusy}
        onCloseDialog={dialogs.closeDialog}
        onSubmitDialog={(values) => {
          void dialogs.handleDialogSubmit(values);
        }}
        onCancelConfirm={dialogs.cancelPendingConfirm}
        onConfirmPending={() => {
          void dialogs.confirmPendingAction();
        }}
      />
    </TimelinePageProvider>
  );
}
