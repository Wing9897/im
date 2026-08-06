import { useState, type CSSProperties } from "react";

import { FloatingTooltip } from "../../../components/common/FloatingTooltip";
import {
  timelineEventDateRange,
  type TimelineScale,
} from "../../../domain/timeline/dateUtils";
import {
  getEventStatusColor,
  type TimelineEventStatusMap,
} from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import {
  buildTooltipContent,
  computeEventBarPosition,
} from "./ganttEventPositioning";
import type { GanttEventRowModel } from "../../../domain/gantt/groupRecurringGanttRows";
import {
  ganttBarClass,
  ganttDayCellClass,
  ganttEventRowClass,
} from "./timelineGanttClasses";
import { ganttColumnGap } from "./ganttGridLayout";

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
  const [tooltip, setTooltip] = useState<{
    event: TimelineItem;
    el: HTMLElement;
  } | null>(null);

  return (
    <div
      data-testid={`event-row-${row.rowId}`}
      onClick={() => onSelect?.(representative)}
      onMouseEnter={onHoverStart}
      onMouseLeave={() => {
        setTooltip(null);
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
        const { start, end } = timelineEventDateRange(event);
        const displayEnd =
          event.isAllDay && event.endTime && end > start
            ? new Date(end.getTime() - 1)
            : event.endTime
              ? end
              : null;
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
        const status = eventStatuses[event.id] ?? "pending";
        const statusColor = getEventStatusColor(status);
        const dismissed = Boolean(event.dismissed);

        return (
          <div
            key={event.id}
            data-testid={`event-bar-${event.id}`}
            data-status={status}
            className={ganttBarClass(isHovered, isCompact, dismissed)}
            style={{
              gridColumn: `${position.startColumn} / ${position.endColumn + 1}`,
              gridRow: 1,
              ...(dismissed ? {} : { backgroundColor: statusColor }),
            }}
            onMouseEnter={(e) =>
              setTooltip({ event, el: e.currentTarget })
            }
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onSelect?.(event);
            }}
          />
        );
      })}

      <FloatingTooltip
        open={tooltip != null}
        anchorEl={tooltip?.el ?? null}
        testId={`gantt-tooltip-${row.rowId}`}
      >
        {tooltip ? buildTooltipContent(tooltip.event) : null}
      </FloatingTooltip>
    </div>
  );
}
