import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EventListPhaseBadges } from "../../../components/timeline/EventListPhaseBadges";
import { EventListTitleMark } from "../../../components/timeline/EventListTitleMark";
import { SubscribedEventSubscribeIcon } from "../../../components/timeline/SubscribedEventSubscribeIcon";
import { isSubscribedTimelineSource } from "../../../domain/calendarShare/subscribedCalendars";
import {
  resolveEventCardDisplay,
  type EventListCardMetaLookups,
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
import { dayCardTimeLabel } from "../../../domain/timeline/dateUtils";

type WeekEventChipProps = {
  event: TimelineItem;
  focusedDay: Date;
  status: TimelineEventStatus;
  metaLookups?: EventListCardMetaLookups;
  onSelect: (event: TimelineItem) => void;
};

export function WeekEventChip({
  event,
  focusedDay,
  status,
  metaLookups = {},
  onSelect,
}: WeekEventChipProps) {
  const { t } = useTranslation("timeline");
  const [hovered, setHovered] = useState(false);
  const dismissed = Boolean(event.dismissed);
  const isSubscribed = isSubscribedTimelineSource(event.source);
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
              className={`${weekEventChipTitleClass} min-w-0 flex flex-1 items-start gap-0.5 ${
                dismissed ? dismissedTitleClass : ""
              }`}
            >
              <EventListTitleMark
                event={event}
                leading={leading}
                metaLookups={metaLookups}
                eventAvatarAria={t("eventList.eventAvatarAria")}
                markerClassName=""
                importantMarkerTestId="week-important-marker"
                itemKindMarkerTestId="week-item-kind-marker"
              />
              {isSubscribed ? <SubscribedEventSubscribeIcon /> : null}
              <span className="min-w-0 truncate">{title}</span>
            </div>
            <EventListPhaseBadges
              showRemindBadge={showRemindBadge}
              dayPhaseTag={dayPhaseTag}
              remindBadgeClassName="normal-case tracking-normal shrink-0 !px-1 !py-0 text-[9px] leading-none"
            />
          </div>
          <div className={weekEventChipTimeClass}>{timeLabel}</div>
        </div>
      </div>
    </button>
  );
}
