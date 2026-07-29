import { useState, type CSSProperties } from "react";

import { FloatingTooltip } from "../../../components/common/FloatingTooltip";
import type { TimelineScale } from "../../../domain/timeline/dateUtils";
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
          className={ganttDayCellClass(isHovered)}
          style={{ gridColumn: index + 1, gridRow: 1 }}
        />
      ))}

      {row.occurrences.map((event) => {
        const position = computeEventBarPosition(
          new Date(event.startTime),
          event.endTime ? new Date(event.endTime) : null,
          timeScale,
          rangeStart,
          columnCount,
        );
        if (!position.visible) return null;

        return (
          <div
            key={event.id}
            data-testid={`event-bar-${event.id}`}
            className={ganttBarClass(
              isHovered,
              position.isPoint,
              Boolean(event.dismissed),
            )}
            style={{
              gridColumn: `${position.startColumn} / ${position.endColumn + 1}`,
              gridRow: 1,
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
