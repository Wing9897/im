import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyStateGlyph } from "../../../components/common/EmptyStateGlyph";

import type { GanttOverviewWindow } from "../../../domain/gantt/ganttOverviewWindow";
import { overviewWindowEndMs } from "../../../domain/gantt/ganttOverviewWindow";
import type { GanttColumn, TimelineScale } from "../../../domain/timeline/dateUtils";
import type { TimelineEventStatusMap } from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import { GanttEventLabelsColumn } from "./GanttEventLabelsColumn";
import { GanttStatusLegend } from "./GanttStatusLegend";
import { GanttTimelinePanel } from "./GanttTimelinePanel";
import { GanttOverviewPanel } from "./GanttOverviewPanel";
import { GanttOverviewTimebar } from "./GanttOverviewTimebar";
import { filterVisibleEvents } from "./ganttEventPositioning";
import { groupRecurringGanttRows } from "../../../domain/gantt/groupRecurringGanttRows";
import { computeRangeEnd } from "./timelineGanttViewUtils";
import { sortActiveThenDismissed } from "../timelineDismissUtils";
import {
  ganttEmptyStateClass,
  ganttErrorContainerClass,
  ganttErrorTextClass,
  ganttMainFlexContainerClass,
  ganttRetryButtonClass,
  ganttRootClass,
  ganttVerticalScrollClass,
} from "./timelineGanttClasses";

type TimelineGanttViewProps = {
  events: TimelineItem[];
  initialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  timeScale: TimelineScale;
  ganttColumns: GanttColumn[];
  rangeStart: Date;
  eventStatuses?: TimelineEventStatusMap;
  onRetry: () => void;
  onSelectEvent?: (event: TimelineItem) => void;
  overviewMode?: boolean;
  overviewWindow?: GanttOverviewWindow;
  onOverviewWindowChange?: (next: GanttOverviewWindow) => void;
};

export function TimelineGanttView({
  events,
  initialLoading,
  isRefreshing,
  error,
  timeScale,
  ganttColumns,
  rangeStart,
  eventStatuses = {},
  onRetry,
  onSelectEvent,
  overviewMode = false,
  overviewWindow,
  onOverviewWindowChange,
}: TimelineGanttViewProps) {
  const { t } = useTranslation(["timeline", "common"]);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const rangeEnd = useMemo(() => {
    if (overviewMode && overviewWindow) {
      return new Date(overviewWindowEndMs(overviewWindow));
    }
    return computeRangeEnd(timeScale, rangeStart, ganttColumns.length);
  }, [overviewMode, overviewWindow, timeScale, rangeStart, ganttColumns.length]);

  const visibleStart =
    overviewMode && overviewWindow ? new Date(overviewWindow.startMs) : rangeStart;

  const ganttRows = useMemo(
    () =>
      groupRecurringGanttRows(
        sortActiveThenDismissed(filterVisibleEvents(events, visibleStart, rangeEnd)),
      ),
    [events, visibleStart, rangeEnd],
  );

  const needsScroll = timeScale === "quarter" || timeScale === "year";
  const overviewActive = Boolean(
    overviewMode && overviewWindow && onOverviewWindowChange,
  );

  const dataExtent = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const event of events) {
      const start = new Date(event.startTime).getTime();
      const end = event.endTime ? new Date(event.endTime).getTime() : start;
      if (Number.isFinite(start)) min = Math.min(min, start);
      if (Number.isFinite(end)) max = Math.max(max, end);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
    return { min, max };
  }, [events]);

  if (error && events.length === 0 && !isRefreshing) {
    return (
      <div className={ganttErrorContainerClass}>
        <div className={ganttErrorTextClass}>{error}</div>
        <button type="button" onClick={onRetry} className={ganttRetryButtonClass}>
          {t("common:sectionError.retry")}
        </button>
      </div>
    );
  }

  if (initialLoading) {
    return <div className={ganttEmptyStateClass}>{t("gantt.loading")}</div>;
  }

  if (ganttRows.length === 0 && !overviewActive) {
    return (
      <div className={`${ganttEmptyStateClass} flex flex-col items-center gap-sm`}>
        <EmptyStateGlyph icon={CalendarDays} />
        {t("gantt.empty")}
      </div>
    );
  }

  return (
    <div className={ganttRootClass} data-testid="timeline-gantt-view">
      <div className={ganttVerticalScrollClass} data-testid="gantt-vertical-scroll">
        <div className={ganttMainFlexContainerClass}>
          <GanttEventLabelsColumn
            rows={ganttRows}
            hoveredRowId={hoveredRowId}
            eventStatuses={eventStatuses}
            onSelectEvent={onSelectEvent}
            onHoverStart={setHoveredRowId}
            onHoverEnd={() => setHoveredRowId(null)}
          />
          {overviewActive && overviewWindow && onOverviewWindowChange ? (
            <GanttOverviewPanel
              rows={ganttRows}
              overviewWindow={overviewWindow}
              onOverviewWindowChange={onOverviewWindowChange}
              eventStatuses={eventStatuses}
              hoveredRowId={hoveredRowId}
              onSelectEvent={onSelectEvent}
              onHoverStart={setHoveredRowId}
              onHoverEnd={() => setHoveredRowId(null)}
            />
          ) : (
            <GanttTimelinePanel
              rows={ganttRows}
              timeScale={timeScale}
              rangeStart={rangeStart}
              ganttColumns={ganttColumns}
              needsScroll={needsScroll}
              eventStatuses={eventStatuses}
              hoveredRowId={hoveredRowId}
              onSelectEvent={onSelectEvent}
              onHoverStart={setHoveredRowId}
              onHoverEnd={() => setHoveredRowId(null)}
            />
          )}
        </div>
      </div>
      {overviewActive && overviewWindow && onOverviewWindowChange ? (
        <GanttOverviewTimebar
          overviewWindow={overviewWindow}
          onOverviewWindowChange={onOverviewWindowChange}
          dataMinMs={dataExtent?.min}
          dataMaxMs={dataExtent?.max}
        />
      ) : null}
      <GanttStatusLegend />
    </div>
  );
}
