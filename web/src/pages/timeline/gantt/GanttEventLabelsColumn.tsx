import { useTranslation } from "react-i18next";

import { itemDateKindMarkerClass } from "../../../domain/items/itemCalendarProjection";
import { resolveCalendarLeadingGlyph } from "../../../domain/timeline/importantEventDisplay";
import {
  getEventStatusColor,
  type TimelineEventStatusMap,
} from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import type { GanttEventRowModel } from "../../../domain/gantt/groupRecurringGanttRows";
import {
  ganttEventNameClass,
  ganttEventNamesColumnClass,
  ganttHeaderLabelClass,
  ganttLabelStatusDotClass,
  ganttLabelTitleClass,
  ganttLeftColumnClass,
} from "./timelineGanttClasses";

interface GanttEventLabelsColumnProps {
  rows: GanttEventRowModel[];
  hoveredRowId: string | null;
  eventStatuses: TimelineEventStatusMap;
  onSelectEvent?: (event: TimelineItem) => void;
  onHoverStart: (rowId: string) => void;
  onHoverEnd: () => void;
}

function rowDisplayTitle(row: GanttEventRowModel): string {
  return (row.label || "").trim();
}

function rowTooltip(row: GanttEventRowModel, untitled: string): string {
  const first = row.occurrences[0];
  const title = rowDisplayTitle(row) || untitled;
  if (!first?.startTime) return title;
  const start = new Date(first.startTime);
  const startLabel = Number.isNaN(start.getTime())
    ? ""
    : start.toLocaleString(undefined, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  if (!first.endTime) {
    return startLabel ? `${title}\n${startLabel}` : title;
  }
  const end = new Date(first.endTime);
  const endLabel = Number.isNaN(end.getTime())
    ? ""
    : end.toLocaleString(undefined, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  if (!startLabel) return title;
  return endLabel ? `${title}\n${startLabel} – ${endLabel}` : `${title}\n${startLabel}`;
}

export function GanttEventLabelsColumn({
  rows,
  hoveredRowId,
  eventStatuses,
  onSelectEvent,
  onHoverStart,
  onHoverEnd,
}: GanttEventLabelsColumnProps) {
  const { t } = useTranslation("timeline");
  const untitled = t("gantt.untitled");

  return (
    <div className={ganttLeftColumnClass}>
      <div className={ganttHeaderLabelClass}>{t("gantt.eventColumn")}</div>
      <div className={ganttEventNamesColumnClass}>
        {rows.map((row) => {
          const first = row.occurrences[0];
          const title = rowDisplayTitle(row) || untitled;
          const status = eventStatuses[first?.id ?? ""] ?? "pending";
          const statusColor = getEventStatusColor(status);
          const leading = first ? resolveCalendarLeadingGlyph(first) : null;

          return (
            <div
              key={row.rowId}
              title={rowTooltip(row, untitled)}
              onClick={() => onSelectEvent?.(first)}
              className={ganttEventNameClass(
                hoveredRowId === row.rowId,
                row.dismissed,
              )}
              onMouseEnter={() => onHoverStart(row.rowId)}
              onMouseLeave={onHoverEnd}
            >
              <span
                className={ganttLabelStatusDotClass}
                style={{ backgroundColor: statusColor }}
                aria-hidden="true"
                data-testid={`gantt-label-status-${row.rowId}`}
              />
              {leading ? (
                <span
                  className={itemDateKindMarkerClass(
                    leading.type === "item" ? leading.itemDateKind : null,
                  )}
                  aria-hidden="true"
                  data-testid={
                    leading.type === "important"
                      ? `gantt-label-important-${row.rowId}`
                      : `gantt-label-kind-${row.rowId}`
                  }
                >
                  {leading.emoji}
                </span>
              ) : null}
              <span className={ganttLabelTitleClass}>{title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
