import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent, CalendarOccurrence } from "../../types";
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
import i18n from "../../i18n";

const LazyCalendarBoardEmbed = lazy(() =>
  import("../embeds/CalendarBoardEmbed").then((m) => ({ default: m.CalendarBoardEmbed })),
);
type CalendarMode = "day" | "month";

function eventToCalendarOccurrence(event: AnalysisEvent): CalendarOccurrence | null {
  if (!event.startTime) {
    return null;
  }
  return {
    id: event.id,
    taskId: event.taskId ?? "",
    taskName: event.taskName?.trim() || String(i18n.t("board.common.unassignedTask")),
    title: event.title || String(i18n.t("board.common.untitledEvent")),
    startTime: event.startTime,
    endTime: event.endTime ?? event.startTime,
    isAllDay: event.isAllDay ?? false,
    timezone: event.timezone ?? null,
    location: event.location,
    description: event.body || null,
    rrule: "",
  };
}

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

  const handleSelectOccurrence = useCallback(
    (occurrence: CalendarOccurrence) => {
      const event = events?.find((item) => item.id === occurrence.id);
      focusBoardEvent({
        eventId: occurrence.id,
        title: occurrence.title,
        body: occurrence.description,
        location: occurrence.location,
        ...(event && isMappableCoordinate(event.latitude, event.longitude)
          ? { lat: event.latitude, lon: event.longitude! }
          : {}),
      });
    },
    [events],
  );

  const occurrences = useMemo(
    () =>
      filteredEvents
        .map(eventToCalendarOccurrence)
        .filter((event): event is CalendarOccurrence => event !== null),
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
        empty={Array.isArray(events) && occurrences.length === 0}
        emptyLabel={
          isEmptySourceFilter(selection)
            ? t("board.common.noTaskSelected")
            : mode === "month"
              ? t("board.calendarWidget.emptyMonth")
              : t("board.calendarWidget.emptyDay")
        }
      >
        <Suspense fallback={<p className="board-widget-muted">{t("board.common.loadingCalendar")}</p>}>
          <LazyCalendarBoardEmbed
            occurrences={occurrences}
            mode={mode}
            onSelectOccurrence={handleSelectOccurrence}
          />
        </Suspense>
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
