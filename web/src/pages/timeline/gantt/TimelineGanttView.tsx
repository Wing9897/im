import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyStateGlyph } from "../../../components/common/EmptyStateGlyph";

import type { GanttColumn, TimelineScale } from "../../../domain/timeline/dateUtils";
import type { TimelineEventStatusMap } from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import { GanttEventLabelsColumn } from "./GanttEventLabelsColumn";
import { GanttStatusLegend } from "./GanttStatusLegend";
import { GanttTimelinePanel } from "./GanttTimelinePanel";
import { filterVisibleEvents } from "./ganttEventPositioning";
import { groupRecurringGanttRows } from "../../../domain/gantt/groupRecurringGanttRows";
import { computeRangeEnd } from "./timelineGanttViewUtils";
import { sortActiveThenDismissed } from "../timelineDismissUtils";
import { useScheduleEmojisMap } from "../../schedule/useScheduleEmojis";
import type { ScheduleEmojiMap } from "../../schedule/scheduleEmojisStore";
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
  /** Test override; production hydrates `schedule_emojis` from ui-prefs. */
  scheduleEmojis?: ScheduleEmojiMap;
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
  scheduleEmojis,
}: TimelineGanttViewProps) {
  const { t } = useTranslation(["timeline", "common"]);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const hydratedEmojis = useScheduleEmojisMap();
  const emojis = scheduleEmojis ?? hydratedEmojis;

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
            emojis={emojis}
          />
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
        </div>
      </div>
      <GanttStatusLegend />
    </div>
  );
}
