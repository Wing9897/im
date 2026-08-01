import {
  type EventStatus,
  EVENT_STATUS_COLORS,
  getEventStatusLabel,
} from "../../../domain/timeline/status";
import {
  ganttLegendContainerClass,
  ganttLegendDotBaseClass,
  ganttLegendItemClass,
  ganttLegendLabelClass,
} from "./timelineGanttClasses";

export function GanttStatusLegend() {
  return (
    <div className={ganttLegendContainerClass}>
      {(Object.keys(EVENT_STATUS_COLORS) as EventStatus[]).map((status) => (
        <div key={status} className={ganttLegendItemClass}>
          <div
            className={ganttLegendDotBaseClass}
            style={{
              background: EVENT_STATUS_COLORS[status],
              opacity: status === "cancelled" ? 0.5 : 1,
            }}
          />
          <span className={ganttLegendLabelClass}>{getEventStatusLabel(status)}</span>
        </div>
      ))}
    </div>
  );
}
