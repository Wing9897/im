import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { isMappableCoordinate } from "../../domain/intelligence/mapFilters";
import { currentMonthWindowIso } from "../../domain/timeline/boardFetchWindows";
import { fetchMergedTimedBoardEvents } from "../../domain/timeline/timedEventMerge";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { useBoardTimedEventsWidget } from "../useBoardTimedEventsWidget";
import { BOARD_POLL_MS } from "../useBoardWidgetPoll";
import { focusBoardEvent } from "../boardFocusStore";
import type { BoardWidgetProps } from "../types";
import { useBoardGanttViewMode } from "../useBoardGanttViewMode";
import { GanttViewModeControls } from "./GanttViewModeControls";

const LazyGanttBoardEmbed = lazy(() =>
  import("../embeds/GanttBoardEmbed").then((m) => ({ default: m.GanttBoardEmbed })),
);

const EVENTS_LIMIT = 80;

/** Gantt rows = analysis / user / calendar events; filter by task via header checklist. */
export function GanttEventsBoardWidget({ active = true, widgetId }: BoardWidgetProps) {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useBoardGanttViewMode(widgetId);
  const ariaPrefix = t("board.ganttWidget.byEventAria");

  const eventsFetcher = useCallback(() => {
    const { startDate, endDate } = currentMonthWindowIso();
    return fetchMergedTimedBoardEvents({ startDate, endDate, limit: EVENTS_LIMIT });
  }, []);

  const headerExtra = useMemo(
    () => (
      <GanttViewModeControls
        viewMode={viewMode}
        onChange={setViewMode}
        ariaLabelPrefix={ariaPrefix}
        testIdPrefix="board-gantt-events"
      />
    ),
    [ariaPrefix, setViewMode, viewMode],
  );

  const { events, filteredEvents, loading, error, refresh } = useBoardTimedEventsWidget({
    widgetId: widgetId ?? "gantt-events",
    active,
    fetcher: eventsFetcher,
    pollMs: BOARD_POLL_MS.standard,
    ariaLabelPrefix: ariaPrefix,
    headerExtra,
  });

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
