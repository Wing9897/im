import { useMemo } from "react";

import {
  overviewTickLabelPct,
  overviewTickLeftPct,
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
  ganttOverviewGridLineClass,
  ganttOverviewGridOverlayClass,
  ganttOverviewNowMarkerClass,
  ganttOverviewPanelClass,
  ganttOverviewTickClass,
  ganttOverviewTrackClass,
} from "./timelineGanttClasses";
import { useGanttOverviewPanZoom } from "./useGanttOverviewPanZoom";

interface GanttOverviewPanelProps {
  rows: GanttEventRowModel[];
  overviewWindow: GanttOverviewWindow;
  onOverviewWindowChange: (next: GanttOverviewWindow) => void;
  onOverviewFetchCommit?: () => void;
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
  onOverviewFetchCommit,
  eventStatuses,
  hoveredRowId,
  onSelectEvent,
  onHoverStart,
  onHoverEnd,
}: GanttOverviewPanelProps) {
  const { trackRef, beginPan } = useGanttOverviewPanZoom({
    window: overviewWindow,
    onChange: onOverviewWindowChange,
    onCommit: onOverviewFetchCommit,
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
        <div
          aria-hidden="true"
          className={ganttOverviewGridOverlayClass}
          style={{ gridColumn: 1, gridRow: "1 / -1" }}
          data-testid="gantt-overview-grid"
        >
          {ticks.map((tick) => (
            <span
              key={`grid-${tick.ms}`}
              className={ganttOverviewGridLineClass}
              style={{ left: `${overviewTickLeftPct(tick.ms, overviewWindow)}%` }}
            />
          ))}
          {nowRatio != null ? (
            <span
              data-testid="gantt-overview-now"
              className={ganttOverviewNowMarkerClass}
              style={{ left: `${nowRatio}%` }}
            />
          ) : null}
        </div>

        <div className={ganttOverviewAxisClass} data-testid="gantt-overview-axis">
          {ticks.map((tick, index) => (
            <span
              key={tick.ms}
              data-testid="gantt-overview-tick"
              data-major={tick.major ? "true" : undefined}
              className={ganttOverviewTickClass(tick.major)}
              style={{
                left: `${overviewTickLabelPct(tick, ticks[index + 1]?.ms ?? null, overviewWindow)}%`,
              }}
            >
              {tick.label}
            </span>
          ))}
        </div>

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
  );
}
