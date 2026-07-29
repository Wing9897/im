import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTaskCatalog, useTaskNameById } from "../../context/TaskCatalogContext";
import type { AnalysisEvent } from "../../types";
import { TaskFilterControl } from "../../components/TaskFilterControl";
import { isMappableCoordinate } from "../../domain/intelligence/mapFilters";
import { catalogOrEventFilterOptions } from "../../domain/timeline/taskFilterOptions";
import {
  fetchMergedTimedBoardEvents,
  withResolvedUserEventTaskNames,
} from "../../domain/timeline/timedEventMerge";
import { useUserEventsFilterLabel } from "../../domain/timeline/useUserEventsFilterLabel";
import { useBoardWidgetHeaderActions } from "../BoardWidgetFrame";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { useBoardTaskFilter } from "../useBoardTaskFilter";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import { focusBoardEvent } from "../boardFocusStore";
import type { BoardWidgetProps } from "../types";
import { useBoardGanttViewMode } from "../useBoardGanttViewMode";
import { GanttViewModeControls } from "./GanttViewModeControls";

const LazyGanttBoardEmbed = lazy(() =>
  import("../embeds/GanttBoardEmbed").then((m) => ({ default: m.GanttBoardEmbed })),
);

const EVENTS_LIMIT = 80;

function currentMonthWindowIso(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/** Gantt rows = analysis / user / calendar events; filter by task via header checklist. */
export function GanttEventsBoardWidget({ active = true, widgetId }: BoardWidgetProps) {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useBoardGanttViewMode(widgetId);
  const { selectedTaskIds, setSelectedTaskIds, filterByTaskId } = useBoardTaskFilter(widgetId);
  const ariaPrefix = t("board.ganttWidget.byEventAria");

  const eventsFetcher = useCallback(() => {
    const { startDate, endDate } = currentMonthWindowIso();
    return fetchMergedTimedBoardEvents({ startDate, endDate, limit: EVENTS_LIMIT });
  }, []);

  const { data: fetchedEvents, error, loading, refresh } = useBoardWidgetPoll<AnalysisEvent[]>(
    eventsFetcher,
    BOARD_POLL_MS.standard,
    { active },
  );
  const { tasks } = useTaskCatalog();
  const taskNameById = useTaskNameById();
  const userEventsLabel = useUserEventsFilterLabel();
  const events = useMemo(
    () =>
      fetchedEvents
        ? withResolvedUserEventTaskNames(fetchedEvents, taskNameById, userEventsLabel)
        : null,
    [fetchedEvents, taskNameById, userEventsLabel],
  );

  const selectEvent = useCallback(
    (event: { id: string; latitude?: number | null; longitude?: number | null }) => {
      focusBoardEvent({
        eventId: event.id,
        ...(isMappableCoordinate(event.latitude, event.longitude)
          ? { lat: event.latitude, lon: event.longitude! }
          : {}),
      });
    },
    [],
  );

  const filterOptions = useMemo(
    () => catalogOrEventFilterOptions(tasks, events, userEventsLabel),
    [tasks, events, userEventsLabel],
  );

  const filteredEvents = useMemo(
    () => filterByTaskId(events ?? []),
    [events, filterByTaskId],
  );

  const headerActions = useMemo(
    () => (
      <>
        <TaskFilterControl
          tasks={filterOptions}
          selectedTaskIds={selectedTaskIds}
          onChange={setSelectedTaskIds}
          ariaLabelPrefix={ariaPrefix}
        />
        <GanttViewModeControls
          viewMode={viewMode}
          onChange={setViewMode}
          ariaLabelPrefix={ariaPrefix}
          testIdPrefix="board-gantt-events"
        />
      </>
    ),
    [ariaPrefix, filterOptions, selectedTaskIds, setSelectedTaskIds, setViewMode, viewMode],
  );
  useBoardWidgetHeaderActions(headerActions);

  return (
    <div
      className="board-widget-body board-widget-gantt"
      data-testid="board-gantt-events-widget"
    >
      <BoardWidgetShell
        active={active}
        pausedLabel={t("board.common.paused", { name: t("board.ganttWidget.pausedName") })}
        pausedTestId="board-gantt-events-paused"
        loading={loading && !events}
        error={!events ? error : null}
        onRetry={refresh}
      >
        <Suspense fallback={<p className="board-widget-muted">{t("board.common.loadingGantt")}</p>}>
          <LazyGanttBoardEmbed
            events={filteredEvents}
            viewMode={viewMode}
            labelHeader={t("board.ganttWidget.labelEvent")}
            emptyLabel={t("board.ganttWidget.emptyEvents")}
            onSelectActivity={selectEvent}
          />
        </Suspense>
      </BoardWidgetShell>
    </div>
  );
}
