import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent, CalendarOccurrence } from "../../types";
import { useTaskCatalog, useTaskNameById } from "../../context/TaskCatalogContext";
import { addDays, addMonths, startOfDay, startOfMonth } from "../../domain/timeline/dateUtils";
import { useUserEventsFilterLabel } from "../../domain/timeline/useUserEventsFilterLabel";
import { TaskFilterControl } from "../../components/TaskFilterControl";
import {
  fetchMergedTimedBoardEvents,
  withResolvedUserEventTaskNames,
} from "../../domain/timeline/timedEventMerge";
import { catalogOrEventFilterOptions } from "../../domain/timeline/taskFilterOptions";
import { useBoardWidgetHeaderActions } from "../BoardWidgetFrame";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { useBoardTaskFilter } from "../useBoardTaskFilter";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import { focusBoardEvent } from "../boardFocusStore";
import type { BoardWidgetProps } from "../types";
import { isMappableCoordinate } from "../../domain/intelligence/mapFilters";
import i18n from "../../i18n";

const LazyCalendarBoardEmbed = lazy(() =>
  import("../embeds/CalendarBoardEmbed").then((m) => ({ default: m.CalendarBoardEmbed })),
);
type CalendarMode = "day" | "month";

function monthWindowIso(): { startDate: string; endDate: string } {
  const start = startOfMonth(new Date());
  // Pad so the 42-day month grid is covered.
  const paddedStart = new Date(start);
  paddedStart.setDate(paddedStart.getDate() - 7);
  const end = addMonths(start, 1);
  end.setDate(end.getDate() + 7);
  return { startDate: paddedStart.toISOString(), endDate: end.toISOString() };
}

/** ~3-day window around today for the day schedule widget (yesterday–tomorrow). */
function dayWindowIso(): { startDate: string; endDate: string } {
  const today = startOfDay(new Date());
  const start = addDays(today, -1);
  const end = addDays(today, 2);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

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
  const { selectedTaskIds, setSelectedTaskIds, filterByTaskId } = useBoardTaskFilter(widgetId);
  const fetcher = useCallback(() => {
    const { startDate, endDate } = mode === "day" ? dayWindowIso() : monthWindowIso();
    return fetchMergedTimedBoardEvents({
      startDate,
      endDate,
      limit: mode === "day" ? 100 : 200,
    });
  }, [mode]);
  const { data: fetchedEvents, error, loading, refresh } = useBoardWidgetPoll<AnalysisEvent[]>(
    fetcher,
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

  const filterOptions = useMemo(
    () => catalogOrEventFilterOptions(tasks, events, userEventsLabel),
    [events, tasks, userEventsLabel],
  );
  const occurrences = useMemo(
    () => filterByTaskId(events ?? []).map(eventToCalendarOccurrence).filter(
      (event): event is CalendarOccurrence => event !== null,
    ),
    [events, filterByTaskId],
  );
  const modeAria =
    mode === "month" ? t("board.calendarWidget.monthAria") : t("board.calendarWidget.dayAria");
  const headerActions = useMemo(
    () => (
      <>
        <TaskFilterControl
          tasks={filterOptions}
          selectedTaskIds={selectedTaskIds}
          onChange={setSelectedTaskIds}
          ariaLabelPrefix={modeAria}
        />
      </>
    ),
    [filterOptions, modeAria, selectedTaskIds, setSelectedTaskIds],
  );
  useBoardWidgetHeaderActions(headerActions);

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
          selectedTaskIds !== null && selectedTaskIds.length === 0
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
