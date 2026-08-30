import React, { Suspense } from "react";
import type { TimelineItem } from "../../../types";
import type { TimelineScale } from "../../../domain/timeline/dateUtils";
import type { TimelineEventStatusMap } from "../../../domain/timeline/status";
import { LazyLoadErrorBoundary } from "../../../components/common/LazyLoadErrorBoundary";
import { TimelineCalendarView } from "./TimelineCalendarView";
import { calendarMonthPanelClass } from "../timelineCalendarClasses";
import { timelinePanelClass } from "../timelineViewLayout";
import { useTimelinePageContext } from "../TimelinePageContext";
import { useEventListMetaLookups } from "../../../domain/timeline/useEventListMetaLookups";

const LazyTimelineGanttView = React.lazy(() =>
  import("../gantt/TimelineGanttView").then((m) => ({ default: m.TimelineGanttView }))
);

/**
 * Skeleton fallback displayed while TimelineGanttView is loading.
 * Matches approximate Gantt chart dimensions to prevent layout shift.
 */
function GanttSkeleton() {
  return (
    <div
      data-testid="gantt-skeleton"
      className="flex w-full min-h-[320px] flex-col gap-sm p-lg"
    >
      {/* Header row skeleton */}
      <div
        className="h-8 w-full rounded-sm bg-surface-border opacity-50"
      />
      {/* Gantt bar skeletons */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-7 rounded-sm bg-surface-border"
          style={{
            opacity: 0.3 + (i % 3) * 0.1,
            width: `${60 + (i % 4) * 10}%`,
          }}
        />
      ))}
    </div>
  );
}

type TimelineGridProps = {
  viewMode: "calendar" | "gantt";
  timeScale: TimelineScale;
  rangeStart: Date;
  rangeEvents: TimelineItem[];
  weekDays: Date[];
  timeCursor: Date;
  monthCursor: Date;
  monthDays: Date[];
  monthEvents: TimelineItem[];
  focusedDay: Date | null;
  eventStatuses: TimelineEventStatusMap;
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
};

/**
 * Pure presentational grid container for the timeline page. Picks between
 * {@link TimelineCalendarView} (calendar grid) and {@link TimelineGanttView}
 * (gantt grid) based on `viewMode` and wraps the chosen view in the standard
 * panel frame.
 *
 * Gantt-specific data (columns, schedule events, task selection state) is
 * consumed from TimelinePageContext, eliminating the need to drill those
 * props through multiple intermediate layers.
 */
export function TimelineGrid({
  viewMode,
  timeScale,
  rangeStart,
  rangeEvents,
  weekDays,
  timeCursor,
  monthCursor,
  monthDays,
  monthEvents,
  focusedDay,
  eventStatuses,
  onSelectEvent,
  onFocusDay,
}: TimelineGridProps) {
  // Consume gantt-specific props from context (eliminates drilling)
  const {
    ganttColumns,
    timelineEvents,
    timelineEventsInitialLoading,
    timelineEventsIsRefreshing,
    timelineEventsError,
    onRetryTimelineEvents,
    showDismissed,
    showOngoing,
    showEnding,
    weatherByDate,
    holidaysByDate,
    monthDatesRevealed = false,
    onCreateOnDay,
    monthLayout = "unified",
    monthCardModels = [],
    monthCardsOmitted = 0,
    monthCardsEmptyReason = null,
  } = useTimelinePageContext();
  const metaLookups = useEventListMetaLookups();

  const isCompactMonth = viewMode === "calendar" && timeScale === "month";
  const shellClassName = isCompactMonth ? calendarMonthPanelClass : timelinePanelClass;

  return (
    <div className={shellClassName}>
      {viewMode === "calendar" ? (
        <TimelineCalendarView
          timeScale={timeScale}
          rangeStart={rangeStart}
          rangeEvents={rangeEvents}
          weekDays={weekDays}
          timeCursor={timeCursor}
          monthCursor={monthCursor}
          monthDays={monthDays}
          monthEvents={monthEvents}
          monthLayout={monthLayout}
          monthCardModels={monthCardModels}
          monthCardsOmitted={monthCardsOmitted}
          monthCardsEmptyReason={monthCardsEmptyReason}
          focusedDay={focusedDay}
          eventStatuses={eventStatuses}
          showDismissed={showDismissed}
          showOngoing={showOngoing}
          showEnding={showEnding}
          weatherByDate={weatherByDate}
          holidaysByDate={holidaysByDate}
          datesRevealed={monthDatesRevealed}
          onSelectEvent={onSelectEvent}
          onFocusDay={onFocusDay}
          onCreateOnDay={onCreateOnDay}
          metaLookups={metaLookups}
        />
      ) : (
        <LazyLoadErrorBoundary fallbackHeight={320}>
          <Suspense fallback={<GanttSkeleton />}>
            <div className="flex min-h-0 flex-1 flex-col">
              <LazyTimelineGanttView
                events={timelineEvents}
                initialLoading={timelineEventsInitialLoading}
                isRefreshing={timelineEventsIsRefreshing}
                error={timelineEventsError}
                timeScale={timeScale}
                ganttColumns={ganttColumns}
                rangeStart={rangeStart}
                eventStatuses={eventStatuses}
                onRetry={onRetryTimelineEvents}
                onSelectEvent={onSelectEvent}
              />
            </div>
          </Suspense>
        </LazyLoadErrorBoundary>
      )}
    </div>
  );
}
