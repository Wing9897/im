import {
  overviewBarLayout,
  type GanttOverviewWindow,
} from "../../../domain/gantt/ganttOverviewWindow";
import type { TimelineEventStatusMap } from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import type { GanttEventRowModel } from "../../../domain/gantt/groupRecurringGanttRows";
import { ganttOverviewTrackRowClass } from "./timelineGanttClasses";
import {
  GanttEventBar,
  GanttEventBarTooltip,
  occurrenceDisplayRange,
  useGanttBarTooltip,
} from "./GanttEventBar";

interface GanttOverviewEventRowProps {
  row: GanttEventRowModel;
  overviewWindow: GanttOverviewWindow;
  eventStatuses: TimelineEventStatusMap;
  isHovered: boolean;
  onSelect?: (event: TimelineItem) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

/** Continuous 全局/Overview track row: display-only bars, click opens detail. */
export function GanttOverviewEventRow({
  row,
  overviewWindow,
  eventStatuses,
  isHovered,
  onSelect,
  onHoverStart,
  onHoverEnd,
}: GanttOverviewEventRowProps) {
  const representative = row.occurrences[0];
  const { tooltip, showTooltip, hideTooltip } = useGanttBarTooltip();

  return (
    <div
      data-testid={`event-row-${row.rowId}`}
      onClick={() => onSelect?.(representative)}
      onMouseEnter={onHoverStart}
      onMouseLeave={() => {
        hideTooltip();
        onHoverEnd();
      }}
      className={ganttOverviewTrackRowClass(isHovered)}
    >
      {row.occurrences.map((event) => {
        const { start, displayEnd } = occurrenceDisplayRange(event);
        const layout = overviewBarLayout(
          start.getTime(),
          displayEnd ? displayEnd.getTime() : null,
          overviewWindow,
        );
        if (!layout) return null;

        return (
          <GanttEventBar
            key={event.id}
            event={event}
            isHovered={isHovered}
            isCompact={layout.isPoint}
            extraClassName="absolute top-1/2 !mx-0 -translate-y-1/2"
            style={{
              left: `${layout.leftPct}%`,
              width: `${layout.widthPct}%`,
            }}
            eventStatuses={eventStatuses}
            onSelect={onSelect}
            onShowTooltip={showTooltip}
          />
        );
      })}

      <GanttEventBarTooltip rowId={row.rowId} tooltip={tooltip} />
    </div>
  );
}
