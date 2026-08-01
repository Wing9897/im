import { useTranslation } from "react-i18next";
import type { TimelineItem } from "../../../types";
import type { GanttEventRowModel } from "../../../domain/gantt/groupRecurringGanttRows";
import {
  ganttEventNameClass,
  ganttEventNamesColumnClass,
  ganttHeaderLabelClass,
  ganttLeftColumnClass,
} from "./timelineGanttClasses";

interface GanttEventLabelsColumnProps {
  rows: GanttEventRowModel[];
  hoveredRowId: string | null;
  onSelectEvent?: (event: TimelineItem) => void;
  onHoverStart: (rowId: string) => void;
  onHoverEnd: () => void;
}

export function GanttEventLabelsColumn({
  rows,
  hoveredRowId,
  onSelectEvent,
  onHoverStart,
  onHoverEnd,
}: GanttEventLabelsColumnProps) {
  const { t } = useTranslation("timeline");

  return (
    <div className={ganttLeftColumnClass}>
      <div className={ganttHeaderLabelClass}>{t("gantt.eventColumn")}</div>
      <div className={ganttEventNamesColumnClass}>
        {rows.map((row) => (
          <div
            key={row.rowId}
            title={row.label}
            onClick={() => onSelectEvent?.(row.occurrences[0])}
            className={ganttEventNameClass(
              hoveredRowId === row.rowId,
              row.dismissed,
            )}
            onMouseEnter={() => onHoverStart(row.rowId)}
            onMouseLeave={onHoverEnd}
          >
            {row.label || t("gantt.untitled")}
          </div>
        ))}
      </div>
    </div>
  );
}
