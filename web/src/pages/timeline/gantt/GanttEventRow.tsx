import { type CSSProperties } from "react";

import type { TimelineScale } from "../../../domain/timeline/dateUtils";
import type { TimelineEventStatusMap } from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import { computeEventBarPosition } from "./ganttEventPositioning";
import type { GanttEventRowModel } from "../../../domain/gantt/groupRecurringGanttRows";
import {
  ganttDayCellClass,
  ganttEventRowClass,
} from "./timelineGanttClasses";
import { ganttColumnGap } from "./ganttGridLayout";
import {
  GanttEventBar,
  GanttEventBarTooltip,
  occurrenceDisplayRange,
  useGanttBarTooltip,
} from "./GanttEventBar";

interface GanttEventRowProps {
  row: GanttEventRowModel;
  timeScale: TimelineScale;
  rangeStart: Date;
  columnCount: number;
  needsScroll: boolean;
  gridTemplateColumns: string;
  todayColumnIndex: number | null;
  eventStatuses: TimelineEventStatusMap;
  isHovered: boolean;
  onSelect?: (event: TimelineItem) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

/** Discrete 日/週/月/季/年 gantt row: click bar → detail. No pan/zoom or trim. */
export function GanttEventRow({
  row,
  timeScale,
  rangeStart,
  columnCount,
  needsScroll,
  gridTemplateColumns,
  todayColumnIndex,
  eventStatuses,
  isHovered,
  onSelect,
  onHoverStart,
  onHoverEnd,
}: GanttEventRowProps) {
  const rowStyle: CSSProperties = {
    gridTemplateColumns,
    gap: ganttColumnGap(needsScroll),
  };

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
      className={ganttEventRowClass(isHovered)}
      style={rowStyle}
    >
      {Array.from({ length: columnCount }, (_, index) => (
        <div
          key={`cell-${index}`}
          aria-hidden="true"
          data-testid={`event-cell-${row.rowId}-${index}`}
          data-today={todayColumnIndex === index ? "true" : undefined}
          className={ganttDayCellClass(todayColumnIndex === index)}
          style={{ gridColumn: index + 1, gridRow: 1 }}
        />
      ))}

      {row.occurrences.map((event) => {
        const { start, displayEnd } = occurrenceDisplayRange(event);
        const position = computeEventBarPosition(
          start,
          displayEnd,
          timeScale,
          rangeStart,
          columnCount,
        );
        if (!position.visible) return null;

        const isCompact =
          position.isPoint || position.startColumn === position.endColumn;

        return (
          <GanttEventBar
            key={event.id}
            event={event}
            isHovered={isHovered}
            isCompact={isCompact}
            style={{
              gridColumn: `${position.startColumn} / ${position.endColumn + 1}`,
              gridRow: 1,
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
