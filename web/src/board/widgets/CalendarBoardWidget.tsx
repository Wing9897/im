import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent } from "../../types";
import {
  dayWindowIso,
  paddedMonthWindowIso,
} from "../../domain/timeline/boardFetchWindows";
import { isEmptySourceFilter } from "../../domain/tasks/sourceFilterSelection";
import { fetchMergedTimedBoardEvents } from "../../domain/timeline/timedEventMerge";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { useBoardTimedEventsWidget } from "../useBoardTimedEventsWidget";
import { BOARD_POLL_MS } from "../useBoardWidgetPoll";
import { focusBoardEvent } from "../boardFocusStore";
import type { BoardWidgetProps } from "../types";
import { isMappableCoordinate } from "../../domain/intelligence/mapFilters";
import { CalendarBoardEmbed } from "../embeds/CalendarBoardEmbed";

type CalendarMode = "day" | "month";

/** Compact calendar for timed intelligence events; mounts only while `active`. */
function CalendarBoardWidgetContent({
  active = true,
  widgetId,
  mode,
}: BoardWidgetProps & { mode: CalendarMode }) {
  const { t } = useTranslation();
  const modeAria =
    mode === "month" ? t("board.calendarWidget.monthAria") : t("board.calendarWidget.dayAria");
  const fetcher = useCallback(() => {
    const { startDate, endDate } = mode === "day" ? dayWindowIso() : paddedMonthWindowIso();
    return fetchMergedTimedBoardEvents({
      startDate,
      endDate,
      limit: mode === "day" ? 100 : 200,
    });
  }, [mode]);
  const { selection, events, filteredEvents, loading, error, refresh } =
    useBoardTimedEventsWidget({
      widgetId: widgetId ?? "calendar",
      active,
      fetcher,
      pollMs: BOARD_POLL_MS.standard,
      ariaLabelPrefix: modeAria,
    });

  const handleSelectEvent = useCallback((event: AnalysisEvent) => {
    focusBoardEvent({
      eventId: event.id,
      title: event.title,
      body: event.body,
      location: event.location,
      ...(isMappableCoordinate(event.latitude, event.longitude)
        ? { lat: event.latitude, lon: event.longitude! }
        : {}),
    });
  }, []);

  const timedEvents = useMemo(
    () => filteredEvents.filter((event) => Boolean(event.startTime)),
    [filteredEvents],
  );

  return (
    <div className="board-widget-body board-widget-calendar" data-testid="board-calendar-widget">
      <BoardWidgetShell
        active={active}
        pausedLabel={t("board.common.paused", { name: modeAria })}
        pausedTestId="board-calendar-paused"
        loading={loading && !events}
        error={!events ? error : null}
        onRetry={refresh}
        empty={Array.isArray(events) && timedEvents.length === 0}
        emptyLabel={
          isEmptySourceFilter(selection)
            ? t("board.common.noTaskSelected")
            : mode === "month"
              ? t("board.calendarWidget.emptyMonth")
              : t("board.calendarWidget.emptyDay")
        }
      >
        <CalendarBoardEmbed
          events={timedEvents}
          mode={mode}
          onSelectEvent={handleSelectEvent}
        />
      </BoardWidgetShell>
    </div>
  );
}

/** Month-only board calendar. */
export function CalendarBoardWidget(props: BoardWidgetProps) {
  return <CalendarBoardWidgetContent {...props} mode="month" />;
}

/** Today-only board schedule. */
export function CalendarDayBoardWidget(props: BoardWidgetProps) {
  return <CalendarBoardWidgetContent {...props} mode="day" />;
}
