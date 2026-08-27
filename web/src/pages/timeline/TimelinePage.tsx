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
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertBanner, AppPageShell, PillButton } from "../../components/ui";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useErrorToast } from "../../hooks/useErrorToast";
import { isCalendarShareUnreachable } from "../../domain/calendarShare/subscribedCalendars";
import { TimelineControlBar } from "./components/TimelineControlBar";
import { TimelineShowOptionsControl } from "./components/TimelineShowOptionsControl";
import { TimelineViewSwitch } from "./components/TimelineViewSwitch";
import { TimelinePageProvider } from "./TimelinePageContext";
import { TimelinePageDialogs } from "./TimelinePageDialogs";
import { useTimelineFullscreen } from "./useTimelineFullscreen";
import { useTimelinePageContainer } from "./useTimelinePageContainer";
import { useTimelinePageContextValue } from "./useTimelinePageContextValue";
import { useTimelinePageDeepLinks } from "./useTimelinePageDeepLinks";
import { useTimelinePageDialogs } from "./useTimelinePageDialogs";
import { useTimelinePageOverlays } from "./useTimelinePageOverlays";

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
  const { t } = useTranslation(["timeline", "subscriptions"]);
  const { sources, data, navigation, filters, selection, gantt } = useTimelinePageContainer();
  const { worksets, tasks } = useTaskCatalog();
  const subscribeAvailability = sources.subscribeAvailability ?? "ok";
  const subscribeOfflineError =
    subscribeAvailability === "offline" && isCalendarShareUnreachable(data.pageError);
  useErrorToast(subscribeOfflineError ? null : data.pageError);
  const { containerRef, isFullscreen, toggleFullscreen } = useTimelineFullscreen();
  const dialogs = useTimelinePageDialogs({
    refreshEvents: data.refreshEvents,
    selectedEvent: selection.selectedEvent,
    setSelectedEvent: selection.setSelectedEvent,
  });
  const overlays = useTimelinePageOverlays({
    viewMode: sources.viewMode,
    navigation,
  });
  useTimelinePageDeepLinks({ sources, data, filters, selection, dialogs });
  const contextValue = useTimelinePageContextValue({
    sources,
    data,
    navigation,
    filters,
    selection,
    gantt,
    dialogs,
    overlays,
  });

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
              subscribeCalendars={sources.subscribeCalendars}
              selectedSubscribeKeys={sources.selectedSubscribeKeys}
              onChangeSubscribeKeys={sources.setSelectedSubscribeKeys}
              subscribeAvailability={subscribeAvailability}
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
              {overlays.weatherEnabled ? (
                <PillButton
                  type="button"
                  onClick={() => {
                    void overlays.refreshWeather();
                    void overlays.refreshHolidays();
                  }}
                  disabled={overlays.overlayLoading}
                  title={t("calendar.weatherRefresh")}
                  aria-label={t("calendar.weatherRefresh")}
                  data-testid="timeline-weather-refresh"
                >
                  <RefreshCw
                    size={16}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className={overlays.overlayLoading ? "animate-spin" : undefined}
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
                  overlays.showMonthDatesReveal
                    ? {
                        persisted: overlays.datesReveal.persisted,
                        onPersistedChange: overlays.datesReveal.onPersistedChange,
                        onPointerEnter: overlays.datesReveal.onPointerEnter,
                        onPointerLeave: overlays.datesReveal.onPointerLeave,
                      }
                    : null
                }
              />
            </TimelineControlBar>
          </div>
          {subscribeAvailability === "loggedOut" || subscribeAvailability === "offline" ? (
            <AlertBanner
              variant="warning"
              role="status"
              className="mb-sm max-w-[56ch] shrink-0"
              data-testid="timeline-subscribe-status"
              data-availability={subscribeAvailability}
            >
              {subscribeAvailability === "offline"
                ? t("subscriptions:filter.offline")
                : t("subscriptions:filter.loggedOut")}{" "}
              {subscribeAvailability === "loggedOut" ? (
                <Link to="/account/identity" className="font-medium text-accent no-underline hover:underline">
                  {t("subscriptions:loginLink")}
                </Link>
              ) : null}
            </AlertBanner>
          ) : null}

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
