import { useMemo } from "react";

import {
  overviewWindowEndMs,
  ticksForOverviewWindow,
  type GanttOverviewWindow,
} from "../../../domain/gantt/ganttOverviewWindow";
import type { TimelineEventStatusMap } from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import type { GanttEventRowModel } from "../../../domain/gantt/groupRecurringGanttRows";
import { GanttOverviewEventRow } from "./GanttOverviewEventRow";
import {
  ganttOverviewAxisClass,
  ganttOverviewNowMarkerClass,
  ganttOverviewPanelClass,
  ganttOverviewTickClass,
  ganttOverviewTrackClass,
  ganttEventBarRowsContainerClass,
} from "./timelineGanttClasses";
import { useGanttOverviewPanZoom } from "./useGanttOverviewPanZoom";

interface GanttOverviewPanelProps {
  rows: GanttEventRowModel[];
  overviewWindow: GanttOverviewWindow;
  onOverviewWindowChange: (next: GanttOverviewWindow) => void;
  eventStatuses: TimelineEventStatusMap;
  hoveredRowId: string | null;
  onSelectEvent?: (event: TimelineItem) => void;
  onHoverStart: (rowId: string) => void;
  onHoverEnd: () => void;
}

export function GanttOverviewPanel({
  rows,
  overviewWindow,
  onOverviewWindowChange,
  eventStatuses,
  hoveredRowId,
  onSelectEvent,
  onHoverStart,
  onHoverEnd,
}: GanttOverviewPanelProps) {
  const { trackRef, beginPan } = useGanttOverviewPanZoom({
    window: overviewWindow,
    onChange: onOverviewWindowChange,
  });
  const ticks = useMemo(() => ticksForOverviewWindow(overviewWindow, 12), [overviewWindow]);
  const nowMs = Date.now();
  const nowRatio =
    nowMs >= overviewWindow.startMs && nowMs < overviewWindowEndMs(overviewWindow)
      ? ((nowMs - overviewWindow.startMs) / overviewWindow.spanMs) * 100
      : null;

  return (
    <div className={ganttOverviewPanelClass} data-testid="gantt-overview-panel">
      <div
        ref={trackRef}
        className={ganttOverviewTrackClass}
        onPointerDown={beginPan}
      >
        <div className={ganttOverviewAxisClass} data-testid="gantt-overview-axis">
          {ticks.map((tick) => (
            <span
              key={tick.ms}
              data-testid="gantt-overview-tick"
              data-major={tick.major ? "true" : undefined}
              className={ganttOverviewTickClass(tick.major)}
              style={{
                left: `${((tick.ms - overviewWindow.startMs) / overviewWindow.spanMs) * 100}%`,
              }}
            >
              {tick.label}
            </span>
          ))}
          {nowRatio != null ? (
            <span
              data-testid="gantt-overview-now"
              className={ganttOverviewNowMarkerClass}
              style={{ left: `${nowRatio}%` }}
            />
          ) : null}
        </div>

        <div className={ganttEventBarRowsContainerClass}>
          {rows.map((row) => (
            <GanttOverviewEventRow
              key={row.rowId}
              row={row}
              overviewWindow={overviewWindow}
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
