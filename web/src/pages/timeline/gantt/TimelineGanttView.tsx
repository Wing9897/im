import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { RefreshIndicator } from "../../../components/common/RefreshIndicator";
import type { GanttColumn, TimelineScale } from "../../../domain/timeline/dateUtils";
import type { TimelineItem } from "../../../types";
import { GanttEventLabelsColumn } from "./GanttEventLabelsColumn";
import { GanttStatusLegend } from "./GanttStatusLegend";
import { GanttTimelinePanel } from "./GanttTimelinePanel";
import { filterVisibleEvents } from "./ganttEventPositioning";
import { groupRecurringGanttRows } from "../../../domain/gantt/groupRecurringGanttRows";
import { computeRangeEnd } from "./timelineGanttViewUtils";
import { sortActiveThenDismissed } from "../timelineDismissUtils";
import {
  ganttEmptyStateClass,
  ganttErrorContainerClass,
  ganttErrorTextClass,
  ganttMainFlexContainerClass,
  ganttRefreshRowClass,
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
  onRetry: () => void;
  onSelectEvent?: (event: TimelineItem) => void;
};

export function TimelineGanttView({
  events,
  initialLoading,
  isRefreshing,
  error,
  timeScale,
  ganttColumns,
  rangeStart,
  onRetry,
  onSelectEvent,
}: TimelineGanttViewProps) {
  const { t } = useTranslation(["timeline", "common"]);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const rangeEnd = useMemo(
    () => computeRangeEnd(timeScale, rangeStart, ganttColumns.length),
    [timeScale, rangeStart, ganttColumns.length],
  );

  const ganttRows = useMemo(
    () =>
      groupRecurringGanttRows(
        sortActiveThenDismissed(filterVisibleEvents(events, rangeStart, rangeEnd)),
      ),
    [events, rangeStart, rangeEnd],
  );

  const needsScroll = timeScale === "quarter" || timeScale === "year";

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

  if (ganttRows.length === 0) {
    return <div className={ganttEmptyStateClass}>{t("gantt.empty")}</div>;
  }

  return (
    <div className={ganttRootClass} data-testid="timeline-gantt-view">
      {isRefreshing && (
        <div className={ganttRefreshRowClass} data-testid="gantt-refresh-indicator">
          <RefreshIndicator label={t("gantt.refreshing")} />
        </div>
      )}
      <div className={ganttVerticalScrollClass} data-testid="gantt-vertical-scroll">
        <div className={ganttMainFlexContainerClass}>
          <GanttEventLabelsColumn
            rows={ganttRows}
            hoveredRowId={hoveredRowId}
            onSelectEvent={onSelectEvent}
            onHoverStart={setHoveredRowId}
            onHoverEnd={() => setHoveredRowId(null)}
          />
          <GanttTimelinePanel
            rows={ganttRows}
            timeScale={timeScale}
            rangeStart={rangeStart}
            ganttColumns={ganttColumns}
            needsScroll={needsScroll}
            hoveredRowId={hoveredRowId}
            onSelectEvent={onSelectEvent}
            onHoverStart={setHoveredRowId}
            onHoverEnd={() => setHoveredRowId(null)}
          />
        </div>
      </div>
      <GanttStatusLegend />
    </div>
  );
}
