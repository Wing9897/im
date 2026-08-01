import { useState } from "react";
import type React from "react";
import type { TimelineItem } from "../../../types";
import { formatTimeLabel } from "../../../domain/timeline/dateUtils";
import {
  getEventStatusColor,
  getEventStatusLabel,
  type TimelineEventStatus,
} from "../../../domain/timeline/status";
import {
  timelineEventCardClass,
  timelineEventCardMetaClass,
  timelineEventCardPrimaryRowClass,
  timelineEventCardSummaryClass,
  timelineEventCardTimeClass,
  timelineEventCardTitleClass,
} from "./timelineEventCardClasses";
import { dismissedSurfaceClass, dismissedTitleClass } from "../timelineDismissUtils";

type TimelineEventCardProps = {
  event: TimelineItem;
  status: TimelineEventStatus;
  onSelect: (event: TimelineItem) => void;
  /** When true, stops click propagation so the parent day cell's click handler does not also fire. */
  stopPropagation?: boolean;
  /** Force dismissed/strikethrough styling (e.g. day only has dismissed events). */
  forceDismissedStyle?: boolean;
};

export function TimelineEventCard({
  event,
  status,
  onSelect,
  stopPropagation = false,
  forceDismissedStyle = false,
}: TimelineEventCardProps) {
  const [hovered, setHovered] = useState(false);
  const dismissed = forceDismissedStyle || Boolean(event.dismissed);

  const handleClick = (clickEvent: React.MouseEvent) => {
    if (stopPropagation) {
      clickEvent.stopPropagation();
    }
    onSelect(event);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${timelineEventCardClass(hovered)} ${dismissed ? dismissedSurfaceClass : ""}`}
    >
      <div className={timelineEventCardPrimaryRowClass}>
        <div
          className={`${timelineEventCardTitleClass} ${
            dismissed ? dismissedTitleClass : ""
          }`}
        >
          {event.title}
        </div>
        <div className={timelineEventCardTimeClass}>
          {formatTimeLabel(new Date(event.startTime))}
        </div>
      </div>
      {event.body && (
        <div className={timelineEventCardSummaryClass}>{event.body}</div>
      )}
      <div className={timelineEventCardMetaClass}>
        <span style={{ color: getEventStatusColor(status) }}>
          {getEventStatusLabel(status)}
        </span>
      </div>
    </button>
  );
}
