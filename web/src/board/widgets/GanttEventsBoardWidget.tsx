import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTaskCatalog, useTaskNameById, useWorksetNameById } from "../../context/TaskCatalogContext";
import type { AnalysisEvent } from "../../types";
import { SourceFilterDialog } from "../../components/SourceFilterDialog";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { isMappableCoordinate } from "../../domain/intelligence/mapFilters";
import { catalogOrEventSourceOptions } from "../../domain/timeline/sourceFilterOptions";
import {
  fetchMergedTimedBoardEvents,
  withResolvedUserEventTaskNames,
} from "../../domain/timeline/timedEventMerge";
import { useGeneralWorksetLabel } from "../../domain/timeline/useGeneralWorksetLabel";
import { useBoardWidgetHeaderActions } from "../BoardWidgetFrame";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { useBoardSourceFilter } from "../useBoardSourceFilter";
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
  const { selection, setSelection, filterBySource } = useBoardSourceFilter(widgetId);
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
  const { tasks, worksets } = useTaskCatalog();
  const taskNameById = useTaskNameById();
  const worksetNameById = useWorksetNameById();
  const generalWorksetLabel = useGeneralWorksetLabel();
  const events = useMemo(
    () =>
      fetchedEvents
        ? withResolvedUserEventTaskNames(
            fetchedEvents,
            taskNameById,
            generalWorksetLabel,
            worksetNameById,
          )
        : null,
    [fetchedEvents, taskNameById, generalWorksetLabel, worksetNameById],
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
    () => catalogOrEventSourceOptions(tasks, events),
    [tasks, events],
  );

  const filteredEvents = useMemo(
    () => filterBySource(events ?? []),
    [events, filterBySource],
  );

  const headerActions = useMemo(
    () => (
      <>
        <SourceFilterDialog
          tasks={filterOptions}
          worksets={worksets.map((ws) => ({
            id: ws.id,
            name: ws.id === SYSTEM_WORKSET_ID ? generalWorksetLabel : ws.name,
            isSystem: ws.isSystem,
          }))}
          expandTasks={tasks.map((task) => ({
            id: task.id,
            name: task.name,
            worksetId: task.worksetId ?? null,
          }))}
          selection={selection}
          onChange={setSelection}
          ariaLabelPrefix={ariaPrefix}
          variant="board"
        />
        <GanttViewModeControls
          viewMode={viewMode}
          onChange={setViewMode}
          ariaLabelPrefix={ariaPrefix}
          testIdPrefix="board-gantt-events"
        />
      </>
    ),
    [ariaPrefix, filterOptions, selection, setSelection, setViewMode, tasks, generalWorksetLabel, viewMode, worksets],
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
