import { useTranslation } from "react-i18next";

import type { GanttOverviewWindow } from "../../../domain/gantt/ganttOverviewWindow";
import { formatDateTime, formatTickLabel } from "../../../utils/dateFormat";
import { ONE_HOUR } from "../../../domain/intelligence/timelineSliderLayout";
import {
  ganttOverviewTimebarCanvasClass,
  ganttOverviewTimebarHandleClass,
  ganttOverviewTimebarLabelClass,
  ganttOverviewTimebarPanelClass,
  ganttOverviewTimebarTickClass,
  ganttOverviewTimebarTickRowClass,
  ganttOverviewTimebarWrapClass,
} from "./timelineGanttClasses";
import { useGanttOverviewTimebar } from "./useGanttOverviewTimebar";

interface GanttOverviewTimebarProps {
  overviewWindow: GanttOverviewWindow;
  onOverviewWindowChange: (next: GanttOverviewWindow) => void;
  dataMinMs?: number;
  dataMaxMs?: number;
}

/** Map-style overview timebar: drag/resize the visible window, pan/zoom the canvas. */
export function GanttOverviewTimebar({
  overviewWindow,
  onOverviewWindowChange,
  dataMinMs,
  dataMaxMs,
}: GanttOverviewTimebarProps) {
  const { t } = useTranslation("timeline");
  const bar = useGanttOverviewTimebar({
    overviewWindow,
    onChange: onOverviewWindowChange,
    dataMinMs,
    dataMaxMs,
  });

  return (
    <div className={ganttOverviewTimebarPanelClass} data-testid="gantt-overview-timebar">
      <div ref={bar.wrapRef} className={ganttOverviewTimebarWrapClass}>
        <canvas
          ref={bar.canvasRef}
          className={ganttOverviewTimebarCanvasClass}
          data-testid="gantt-overview-timebar-canvas"
          onMouseDown={bar.onMouseDown}
          onMouseMove={bar.onHover}
          onWheel={bar.onWheel}
        />
        {(["start", "end"] as const).map((handle) => {
          const start = handle === "start";
          const value = start ? bar.wS : bar.wE;
          return (
            <div
              key={handle}
              role="slider"
              tabIndex={0}
              aria-label={start ? t("gantt.overviewRangeStartAria") : t("gantt.overviewRangeEndAria")}
              aria-orientation="horizontal"
              aria-valuemin={start ? undefined : bar.wS + ONE_HOUR}
              aria-valuemax={start ? bar.wE - ONE_HOUR : undefined}
              aria-valuenow={value}
              aria-valuetext={formatDateTime(value)}
              className={ganttOverviewTimebarHandleClass}
              style={bar.keyboardHandleStyle(value)}
              onFocus={() => bar.setFocusedHandle(start ? "left" : "right")}
              onBlur={() => bar.setFocusedHandle(null)}
            />
          );
        })}
      </div>
      <div className={ganttOverviewTimebarTickRowClass}>
        {bar.ticks.map((timestamp) => {
          const pct = bar.tsPct(timestamp);
          return pct < -5 || pct > 105 ? null : (
            <span key={timestamp} className={ganttOverviewTimebarTickClass} style={{ left: `${pct}%` }}>
              {formatTickLabel(timestamp)}
            </span>
          );
        })}
      </div>
      <div className={ganttOverviewTimebarLabelClass} data-testid="gantt-overview-timebar-label">
        {formatDateTime(bar.wS)} — {formatDateTime(bar.wE)}
      </div>
    </div>
  );
}
