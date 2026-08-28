import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, Clock, MapPin } from "lucide-react";

import { CardFieldIcon, CardFieldRow } from "../../../components/ui";
import { EventListPhaseBadges } from "../../../components/timeline/EventListPhaseBadges";
import {
  isUserScheduleTimelineEvent,
  scheduleCardText,
} from "../../../domain/schedule/scheduleCardFields";
import { isSubscribedTimelineSource } from "../../../domain/calendarShare/subscribedCalendars";
import {
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
  dayCardMetadataClass,
  dayCardPrimaryRowClass,
  dayCardStackedFieldsClass,
  dayCardTimeChipClass,
  dayCardTitleClass,
  dayEventCardClass,
} from "./calendarCellClasses";
import { dayCardTimeLabel } from "./dayCardTimeLabel";
import { EventListTitleMark } from "../../../components/timeline/EventListTitleMark";
import { SubscribedEventSubscribeIcon } from "../../../components/timeline/SubscribedEventSubscribeIcon";

type DayEventCardProps = {
  event: TimelineItem;
  focusedDay: Date;
  status: TimelineEventStatus;
  onSelect: (event: TimelineItem) => void;
};

export function TimelineDayEventCard({
  event,
  focusedDay,
  status,
  onSelect,
}: DayEventCardProps) {
  const { t } = useTranslation("timeline");
  const [hovered, setHovered] = useState(false);
  const dismissed = Boolean(event.dismissed);
  const statusColor = getEventStatusColor(status);
  const scheduleCard = isUserScheduleTimelineEvent(event.source);
  const isSubscribed = isSubscribedTimelineSource(event.source);
  const emptyValue = t("calendar.emptyValue");
  const location = scheduleCard
    ? scheduleCardText(event.location, emptyValue)
    : calendarLocationDisplay(event.location);
  const notes = scheduleCard ? scheduleCardText(event.body, emptyValue) : event.body;
  const { leading, showRemindBadge, dayPhaseTag, title } =
    resolveEventCardDisplay(event, focusedDay);
  const timeLabel = dayCardTimeLabel(event, t("userEvent.allDay"));
  const statusLabel = t("eventList.statusWithLabel", {
    value: getEventStatusLabel(status),
  });

  const badges = (
    <EventListPhaseBadges showRemindBadge={showRemindBadge} dayPhaseTag={dayPhaseTag} />
  );

  const titleBlock = (
    <div
      className={`${dayCardTitleClass} ${dismissed ? dismissedTitleClass : ""}`}
      title={title}
    >
      <EventListTitleMark
        event={event}
        leading={leading}
        eventAvatarAria={t("eventList.eventAvatarAria")}
        markerClassName=""
        importantMarkerTestId="day-important-marker"
        itemKindMarkerTestId="day-item-kind-marker"
      />
      {isSubscribed ? <SubscribedEventSubscribeIcon /> : null}
      <span className="min-w-0 truncate">{title}</span>
    </div>
  );

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
          {scheduleCard ? (
            <div className={dayCardStackedFieldsClass}>
              <div className="flex min-w-0 items-start justify-between gap-md">
                {titleBlock}
                {showRemindBadge || dayPhaseTag ? (
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {badges}
                  </div>
                ) : null}
              </div>
              <CardFieldRow
                icon={Clock}
                text={timeLabel}
                className="text-xs leading-snug text-text-secondary"
              />
              <CardFieldRow
                icon={MapPin}
                text={t("calendar.location", { value: location })}
                empty={location === emptyValue}
                testId="timeline-day-event-location"
                className="text-xs leading-snug text-text-secondary"
              />
              <CardFieldRow
                icon={AlignLeft}
                text={t("calendar.notes", { value: notes })}
                empty={notes === emptyValue}
                clamp
                testId="timeline-day-event-notes"
                className="text-xs font-normal leading-snug text-text-secondary"
              />
            </div>
          ) : (
            <>
              <div className={dayCardPrimaryRowClass}>
                {titleBlock}
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  {badges}
                  <div className={`${dayCardTimeChipClass} inline-flex items-center gap-xs`}>
                    <CardFieldIcon icon={Clock} tone="secondary" />
                    {timeLabel}
                  </div>
                </div>
              </div>
              {event.body ? (
                <CardFieldRow
                  icon={AlignLeft}
                  text={event.body}
                  clamp
                  className="mb-1.5 text-xs font-normal leading-snug text-text-secondary"
                />
              ) : null}
              <CardFieldRow
                icon={MapPin}
                text={t("calendar.location", { value: location })}
                empty={!location}
                testId="timeline-day-event-location"
                className="mb-1.5 text-xs leading-snug text-text-secondary"
              />
            </>
          )}
          <div className={dayCardMetadataClass} data-testid="timeline-day-event-status">
            <span style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
