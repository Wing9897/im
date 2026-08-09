import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";

import { Badge } from "../../../components/ui";
import {
  itemDateKindLabel,
  itemDateKindMarkerClass,
} from "../../../domain/items/itemCalendarProjection";
import {
  EVENT_LIST_DAY_PHASE_TAG_CLASS,
  EVENT_LIST_DAY_PHASE_TAG_META,
  calendarLocationDisplay,
  resolveEventCardDisplay,
} from "../../../domain/timeline/eventListCardMeta";
import {
  getEventStatusColor,
  getEventStatusLabel,
  type TimelineEventStatus,
} from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import {
  dismissedSurfaceClass,
  dismissedTitleClass,
} from "../timelineDismissUtils";
import {
  dayCardAccentRailClass,
  dayCardBodyClass,
  dayCardInnerClass,
  dayCardLocationIconClass,
  dayCardLocationRowClass,
  dayCardLocationTextClass,
  dayCardMetadataClass,
  dayCardPrimaryRowClass,
  dayCardSummaryClass,
  dayCardTimeChipClass,
  dayCardTitleClass,
  dayEventCardClass,
} from "./calendarCellClasses";
import { dayCardTimeLabel } from "./dayCardTimeLabel";

type DayEventCardProps = {
  event: TimelineItem;
  focusedDay: Date;
  status: TimelineEventStatus;
  onSelect: (event: TimelineItem) => void;
};

export function TimelineDayEventCard({ event, focusedDay, status, onSelect }: DayEventCardProps) {
  const { t } = useTranslation("timeline");
  const [hovered, setHovered] = useState(false);
  const dismissed = Boolean(event.dismissed);
  const statusColor = getEventStatusColor(status);
  const location = calendarLocationDisplay(event.location);
  const { leading, showRemindBadge, dayPhaseTag, title } =
    resolveEventCardDisplay(event, focusedDay);
  const timeLabel = dayCardTimeLabel(event, t("userEvent.allDay"));

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${dayEventCardClass(hovered)} ${dismissed ? dismissedSurfaceClass : ""}`}
      data-testid="timeline-day-event-card"
    >
      <div className={dayCardInnerClass}>
        <span
          className={dayCardAccentRailClass}
          style={{ backgroundColor: statusColor }}
          aria-hidden="true"
        />
        <div className={dayCardBodyClass}>
          <div className={dayCardPrimaryRowClass}>
            <div
              className={`${dayCardTitleClass} ${
                dismissed ? dismissedTitleClass : ""
              }`}
              title={title}
            >
              {leading ? (
                <span
                  className={`mr-1 inline-flex align-middle ${itemDateKindMarkerClass(
                    leading.type === "item" ? leading.itemDateKind : null,
                  )}`}
                  aria-hidden="true"
                  data-testid={
                    leading.type === "important"
                      ? "day-important-marker"
                      : "day-item-kind-marker"
                  }
                >
                  {leading.emoji}
                </span>
              ) : null}
              {title}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {showRemindBadge ? (
                <Badge
                  tone="warning"
                  className="normal-case tracking-normal shrink-0"
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
              <div className={dayCardTimeChipClass}>{timeLabel}</div>
            </div>
          </div>
          {event.body ? (
            <div className={dayCardSummaryClass} title={event.body}>
              {event.body}
            </div>
          ) : null}
          <div
            className={dayCardLocationRowClass}
            data-testid="timeline-day-event-location"
          >
            <MapPin
              size={12}
              strokeWidth={2}
              className={dayCardLocationIconClass}
              aria-hidden="true"
            />
            <span className={dayCardLocationTextClass} title={location}>
              {t("calendar.location", { value: location })}
            </span>
          </div>
          <div className={dayCardMetadataClass}>
            <span style={{ color: statusColor }}>
              {getEventStatusLabel(status)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
