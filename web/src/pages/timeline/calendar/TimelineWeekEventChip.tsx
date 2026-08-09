import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "../../../components/ui";
import {
  itemDateKindLabel,
  itemDateKindMarkerClass,
} from "../../../domain/items/itemCalendarProjection";
import {
  EVENT_LIST_DAY_PHASE_TAG_CLASS,
  EVENT_LIST_DAY_PHASE_TAG_META,
  resolveEventCardDisplay,
} from "../../../domain/timeline/eventListCardMeta";
import {
  getEventStatusColor,
  type TimelineEventStatus,
} from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import {
  dismissedSurfaceClass,
  dismissedTitleClass,
} from "../timelineDismissUtils";
import {
  weekEventChipBodyClass,
  weekEventChipClass,
  weekEventChipInnerClass,
  weekEventChipRailClass,
  weekEventChipTimeClass,
  weekEventChipTitleClass,
} from "./calendarCellClasses";
import { dayCardTimeLabel } from "./dayCardTimeLabel";

type WeekEventChipProps = {
  event: TimelineItem;
  focusedDay: Date;
  status: TimelineEventStatus;
  onSelect: (event: TimelineItem) => void;
};

export function WeekEventChip({ event, focusedDay, status, onSelect }: WeekEventChipProps) {
  const { t } = useTranslation("timeline");
  const [hovered, setHovered] = useState(false);
  const dismissed = Boolean(event.dismissed);
  const statusColor = getEventStatusColor(status);
  const { leading, showRemindBadge, dayPhaseTag, title } =
    resolveEventCardDisplay(event, focusedDay);
  const timeLabel = dayCardTimeLabel(event, t("userEvent.allDay"));

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect(event);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${weekEventChipClass(hovered)} ${dismissed ? dismissedSurfaceClass : ""}`}
      data-testid="timeline-week-event-chip"
      title={title}
    >
      <div className={weekEventChipInnerClass}>
        <span
          className={weekEventChipRailClass}
          style={{ backgroundColor: statusColor }}
          aria-hidden="true"
        />
        <div className={weekEventChipBodyClass}>
          <div className="flex min-w-0 items-start gap-0.5">
            <div
              className={`${weekEventChipTitleClass} min-w-0 flex-1 ${
                dismissed ? dismissedTitleClass : ""
              }`}
            >
              {leading ? (
                <span
                  className={`mr-0.5 inline-flex align-middle ${itemDateKindMarkerClass(
                    leading.type === "item" ? leading.itemDateKind : null,
                  )}`}
                  aria-hidden="true"
                  data-testid={
                    leading.type === "important"
                      ? "week-important-marker"
                      : "week-item-kind-marker"
                  }
                >
                  {leading.emoji}
                </span>
              ) : null}
              {title}
            </div>
            {showRemindBadge ? (
              <Badge
                tone="warning"
                className="normal-case tracking-normal shrink-0 !px-1 !py-0 text-[9px] leading-none"
                data-testid="timeline-remind-badge"
              >
                {itemDateKindLabel("remind")}
              </Badge>
            ) : null}
            {dayPhaseTag ? (
              <span
                className={EVENT_LIST_DAY_PHASE_TAG_CLASS}
                data-testid={EVENT_LIST_DAY_PHASE_TAG_META[dayPhaseTag].testId}
              >
                {t(EVENT_LIST_DAY_PHASE_TAG_META[dayPhaseTag].labelKey)}
              </span>
            ) : null}
          </div>
          <div className={weekEventChipTimeClass}>{timeLabel}</div>
        </div>
      </div>
    </button>
  );
}
