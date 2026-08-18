import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, CalendarDays, Clock, MapPin, Repeat } from "lucide-react";

import { Badge, CardFieldIcon, CardFieldRow, CardTitleIcon } from "../../../components/ui";
import {
  itemDateKindLabel,
  itemDateKindMarkerClass,
} from "../../../domain/items/itemCalendarProjection";
import {
  isUserScheduleTimelineEvent,
  scheduleCardText,
} from "../../../domain/schedule/scheduleCardFields";
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
  dayCardMetadataClass,
  dayCardPrimaryRowClass,
  dayCardStackedFieldsClass,
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
  const scheduleCard = isUserScheduleTimelineEvent(event.source);
  const emptyValue = t("calendar.emptyValue");
  const location = scheduleCard
    ? scheduleCardText(event.location, emptyValue)
    : calendarLocationDisplay(event.location);
  const notes = scheduleCard ? scheduleCardText(event.body, emptyValue) : event.body;
  const { leading, showRemindBadge, dayPhaseTag, title } =
    resolveEventCardDisplay(event, focusedDay);
  const timeLabel = dayCardTimeLabel(event, t("userEvent.allDay"));

  const badges = (
    <>
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
    </>
  );

  const titleBlock = (
    <div
      className={`${dayCardTitleClass} ${dismissed ? dismissedTitleClass : ""}`}
      title={title}
    >
      {leading ? (
        <span
          className={`inline-flex shrink-0 ${itemDateKindMarkerClass(
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
      ) : scheduleCard ? (
        <CardTitleIcon icon={event.source === "recurring" ? Repeat : CalendarDays} />
      ) : null}
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
