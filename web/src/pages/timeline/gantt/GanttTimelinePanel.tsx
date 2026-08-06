import type { GanttColumn, TimelineScale } from "../../../domain/timeline/dateUtils";
import type { TimelineEventStatusMap } from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import { GanttEventRow } from "./GanttEventRow";
import type { GanttEventRowModel } from "../../../domain/gantt/groupRecurringGanttRows";
import {
  ganttColumnGap,
  ganttGridTemplateColumns,
  ganttTimelineMinWidth,
} from "./ganttGridLayout";
import { findGanttTodayColumnIndex } from "./ganttTodayColumn";
import {
  ganttColumnHeaderClass,
  ganttEventBarRowsContainerClass,
  ganttRightAreaBaseClass,
  ganttScrollInnerFullClass,
  ganttTimeAxisGridClass,
} from "./timelineGanttClasses";

interface GanttTimelinePanelProps {
  rows: GanttEventRowModel[];
  timeScale: TimelineScale;
  rangeStart: Date;
  ganttColumns: GanttColumn[];
  needsScroll: boolean;
  eventStatuses: TimelineEventStatusMap;
  hoveredRowId: string | null;
  onSelectEvent?: (event: TimelineItem) => void;
  onHoverStart: (rowId: string) => void;
  onHoverEnd: () => void;
}

export function GanttTimelinePanel({
  rows,
  timeScale,
  rangeStart,
  ganttColumns,
  needsScroll,
  eventStatuses,
  hoveredRowId,
  onSelectEvent,
  onHoverStart,
  onHoverEnd,
}: GanttTimelinePanelProps) {
  const columnCount = ganttColumns.length;
  const gridTemplateColumns = ganttGridTemplateColumns(columnCount, needsScroll);
  const columnGap = ganttColumnGap(needsScroll);
  const scrollMinWidth = ganttTimelineMinWidth(columnCount, needsScroll);
  const todayColumnIndex = findGanttTodayColumnIndex(
    ganttColumns,
    timeScale,
    rangeStart,
  );

  const rightAreaClassName = [
    ganttRightAreaBaseClass,
    needsScroll ? "overflow-x-auto [scrollbar-gutter:stable]" : "overflow-x-hidden",
  ].join(" ");

  const scrollInnerStyle =
    scrollMinWidth === undefined
      ? { width: "100%" as const, minWidth: 0 }
      : { minWidth: scrollMinWidth };

  const timeAxisGridStyle = {
    gridTemplateColumns,
    gap: columnGap,
  };

  return (
    <div className={rightAreaClassName}>
      <div
        style={scrollInnerStyle}
        className={scrollMinWidth === undefined ? ganttScrollInnerFullClass : undefined}
      >
        <div className={ganttTimeAxisGridClass} style={timeAxisGridStyle}>
          {ganttColumns.map((column, index) => (
            <div
              key={column.key}
              data-testid={
                todayColumnIndex === index ? "gantt-today-header" : undefined
              }
              className={ganttColumnHeaderClass(todayColumnIndex === index)}
            >
              {column.label}
            </div>
          ))}
        </div>

        <div className={ganttEventBarRowsContainerClass}>
          {rows.map((row) => (
            <GanttEventRow
              key={row.rowId}
              row={row}
              timeScale={timeScale}
              rangeStart={rangeStart}
              columnCount={columnCount}
              needsScroll={needsScroll}
              gridTemplateColumns={gridTemplateColumns}
              todayColumnIndex={todayColumnIndex}
              eventStatuses={eventStatuses}
              isHovered={hoveredRowId === row.rowId}
              onSelect={onSelectEvent}
              onHoverStart={() => onHoverStart(row.rowId)}
              onHoverEnd={onHoverEnd}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
