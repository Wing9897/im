import { useState, type CSSProperties } from "react";

import { FloatingTooltip } from "../../../components/common/FloatingTooltip";
import { timelineEventDateRange } from "../../../domain/timeline/dateUtils";
import {
  getEventStatusColor,
  type TimelineEventStatusMap,
} from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import { buildTooltipContent } from "./ganttEventPositioning";
import { ganttBarClass } from "./timelineGanttClasses";

export type GanttBarTooltip = { event: TimelineItem; el: HTMLElement } | null;

/** Shared tooltip state for discrete-grid and continuous-% gantt rows. */
export function useGanttBarTooltip() {
  const [tooltip, setTooltip] = useState<GanttBarTooltip>(null);
  return {
    tooltip,
    showTooltip: (event: TimelineItem, el: HTMLElement) => setTooltip({ event, el }),
    hideTooltip: () => setTooltip(null),
  };
}

export function occurrenceDisplayRange(event: TimelineItem): {
  start: Date;
  displayEnd: Date | null;
} {
  const { start, end } = timelineEventDateRange(event);
  const displayEnd =
    event.isAllDay && event.endTime && end > start
      ? new Date(end.getTime() - 1)
      : event.endTime
        ? end
        : null;
  return { start, displayEnd };
}

interface GanttEventBarProps {
  event: TimelineItem;
  isHovered: boolean;
  isCompact: boolean;
  extraClassName?: string;
  style: CSSProperties;
  eventStatuses: TimelineEventStatusMap;
  onSelect?: (event: TimelineItem) => void;
  onShowTooltip: (event: TimelineItem, el: HTMLElement) => void;
}

/** Display-only occurrence bar: click opens detail. Axis layout stays in the row. */
export function GanttEventBar({
  event,
  isHovered,
  isCompact,
  extraClassName,
  style,
  eventStatuses,
  onSelect,
  onShowTooltip,
}: GanttEventBarProps) {
  const status = eventStatuses[event.id] ?? "pending";
  const statusColor = getEventStatusColor(status);
  const dismissed = Boolean(event.dismissed);

  return (
    <div
      data-testid={`event-bar-${event.id}`}
      data-status={status}
      className={[ganttBarClass(isHovered, isCompact, dismissed), extraClassName]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...style,
        ...(dismissed ? {} : { backgroundColor: statusColor }),
      }}
      onMouseEnter={(e) => onShowTooltip(event, e.currentTarget)}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect?.(event);
      }}
    />
  );
}

export function GanttEventBarTooltip({
  rowId,
  tooltip,
}: {
  rowId: string;
  tooltip: GanttBarTooltip;
}) {
  return (
    <FloatingTooltip
      open={tooltip != null}
      anchorEl={tooltip?.el ?? null}
      testId={`gantt-tooltip-${rowId}`}
    >
      {tooltip ? buildTooltipContent(tooltip.event) : null}
    </FloatingTooltip>
  );
}
