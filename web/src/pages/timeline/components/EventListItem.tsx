import { AlignLeft, Clock, ListChecks, MapPin, Trash2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button, CardFieldIcon, CardFieldRow, SurfaceCard } from "../../../components/ui";
import { captionClass, cardTitleClass } from "../../../components/ui/pageTypography";
import { EventListPhaseBadges } from "../../../components/timeline/EventListPhaseBadges";
import {
  isUserScheduleTimelineEvent,
  scheduleCardText,
} from "../../../domain/schedule/scheduleCardFields";
import {
  calendarLocationDisplay,
  eventListAllowsDismiss,
  eventListTimeLabel,
  formatEventListAffiliationLabel,
  formatEventListProvenanceLabel,
  previewEventBody,
  resolveEventCardDisplay,
  resolveEventListProvenanceKind,
  resolveSubscribedCalendarDescription,
  eventListShowsProvenance,
  type EventListCardMetaLookups,
} from "../../../domain/timeline/eventListCardMeta";
import { isSubscribedTimelineSource } from "../../../domain/calendarShare/subscribedCalendars";
import {
  getEventStatusColor,
  getEventStatusLabel,
} from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import { dismissedSurfaceClass, dismissedTitleClass } from "../timelineDismissUtils";
import { useTimelinePageContext } from "../TimelinePageContext";
import { EventListTitleMark } from "../../../components/timeline/EventListTitleMark";
import { SubscribedEventSubscribeIcon } from "../../../components/timeline/SubscribedEventSubscribeIcon";

function EventProvenanceRow({
  event,
  label,
}: {
  event: TimelineItem;
  label: string;
}) {
  const isTask = resolveEventListProvenanceKind(event) === "task";
  return (
    <span
      className="inline-flex min-w-0 items-center gap-xs truncate"
      data-testid="timeline-event-list-provenance"
    >
      {isTask ? <CardFieldIcon icon={ListChecks} /> : null}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

function EventListStatusWorksetRow({
  statusColor,
  statusLabel,
  affiliationLabel,
  calendarDescription,
}: {
  statusColor: string;
  statusLabel: string;
  affiliationLabel: string;
  calendarDescription?: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-0.5"
      data-testid="timeline-event-list-status-workset"
    >
      <span
        className="min-w-0 truncate"
        style={{ color: statusColor }}
        data-testid="timeline-event-list-status"
      >
        {statusLabel}
      </span>
      <span className="min-w-0 truncate" data-testid="timeline-event-list-workset">
        {affiliationLabel}
      </span>
      {calendarDescription ? (
        <span
          className="min-w-0 truncate text-[10px] leading-snug text-text-muted"
          data-testid="timeline-event-list-calendar-description"
        >
          {calendarDescription}
        </span>
      ) : null}
    </div>
  );
}

export function EventListItem({
  event,
  focusedDay,
  onSelectEvent,
  metaLookups,
}: {
  event: TimelineItem;
  focusedDay: Date;
  onSelectEvent: (event: TimelineItem | null) => void;
  metaLookups: EventListCardMetaLookups;
}) {
  const { t } = useTranslation("timeline");
  const { eventStatuses, onDismissTimelineEvent, onRestoreTimelineEvent, userEventActionBusy } =
    useTimelinePageContext();
  const scheduleCard = isUserScheduleTimelineEvent(event.source);
  const isSubscribed = isSubscribedTimelineSource(event.source);
  const emptyValue = t("calendar.emptyValue");
  const bodyPreview = event.body ? previewEventBody(event.body) : "";
  const notes = scheduleCard ? scheduleCardText(event.body, emptyValue) : bodyPreview;
  const dismissed = Boolean(event.dismissed);
  const { leading, showRemindBadge, dayPhaseTag, title } =
    resolveEventCardDisplay(event, focusedDay);
  const location = scheduleCard
    ? scheduleCardText(event.location, emptyValue)
    : calendarLocationDisplay(event.location);
  const status = eventStatuses[event.id] ?? "pending";
  const statusColor = getEventStatusColor(status);
  const timeLabel = eventListTimeLabel(event, t("userEvent.allDay"));
  const affiliationLabel = formatEventListAffiliationLabel(event, t, metaLookups);
  const calendarDescription = resolveSubscribedCalendarDescription(event, metaLookups);
  const provenanceLabel = formatEventListProvenanceLabel(event, t);
  const showProvenance = eventListShowsProvenance(event);
  const statusLabel = t("eventList.statusWithLabel", {
    value: getEventStatusLabel(status),
  });
  const allowDismiss = eventListAllowsDismiss(event);
  const showDismissFooter = dismissed || allowDismiss;
  const showNotes = scheduleCard || Boolean(bodyPreview);

  return (
    <SurfaceCard
      density="field"
      interactive
      className={`im-timeline-event-list-item min-w-0 shrink-0 cursor-pointer rounded-xl p-md text-left ${
        dismissed ? dismissedSurfaceClass : ""
      }`}
    >
      <div className="flex min-w-0 items-start gap-sm">
        <button
          type="button"
          className="min-w-0 flex-1 border-none bg-transparent p-0 text-left font-[inherit]"
          onClick={() => onSelectEvent(event)}
        >
          <div className="flex min-w-0 items-start gap-sm">
            <EventListTitleMark
              event={event}
              leading={leading}
              metaLookups={metaLookups}
              eventAvatarAria={t("eventList.eventAvatarAria")}
            />
            {isSubscribed ? <SubscribedEventSubscribeIcon className="mt-1" /> : null}
            <div
              className={`${cardTitleClass} min-w-0 flex-1 truncate ${
                dismissed ? dismissedTitleClass : ""
              }`}
              title={title}
            >
              {title}
            </div>
            <EventListPhaseBadges
              showRemindBadge={showRemindBadge}
              dayPhaseTag={dayPhaseTag}
            />
          </div>
        {showNotes ? (
          <CardFieldRow
            icon={AlignLeft}
            text={
              scheduleCard
                ? t("calendar.notes", { value: notes })
                : notes
            }
            empty={scheduleCard ? notes === emptyValue : false}
            title={scheduleCard ? undefined : event.body}
            testId={scheduleCard ? "timeline-event-list-notes" : undefined}
            className="mt-1 text-xs leading-snug text-text-secondary"
          />
        ) : null}
        <CardFieldRow
          icon={MapPin}
          text={t("calendar.location", { value: location })}
          empty={scheduleCard ? location === emptyValue : !location}
          testId="timeline-event-list-location"
          className={`${captionClass} mt-1`}
        />
        <CardFieldRow
          icon={Clock}
          text={timeLabel}
          testId="timeline-event-list-when"
          className={`${captionClass} mt-1`}
        />
        <div
          className="mt-1 flex min-w-0 flex-col gap-0.5 text-[11px] text-text-muted"
          data-testid="timeline-event-list-meta"
        >
          <EventListStatusWorksetRow
            statusColor={statusColor}
            statusLabel={statusLabel}
            affiliationLabel={affiliationLabel}
            calendarDescription={calendarDescription || undefined}
          />
          {showProvenance ? (
            <EventProvenanceRow event={event} label={provenanceLabel} />
          ) : null}
        </div>
        </button>
        {showDismissFooter ? (
          dismissed ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="shrink-0"
              disabled={userEventActionBusy}
              aria-label={t("sidebar.restore")}
              title={t("sidebar.restore")}
              data-testid="timeline-event-list-restore"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onRestoreTimelineEvent?.(event);
              }}
            >
              <Undo2 size={16} strokeWidth={2.5} aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              size="icon"
              className="shrink-0"
              disabled={userEventActionBusy}
              aria-label={t("sidebar.dismiss")}
              title={t("sidebar.dismiss")}
              data-testid="timeline-event-list-dismiss"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onDismissTimelineEvent?.(event);
              }}
            >
              <Trash2 size={16} strokeWidth={2.5} aria-hidden="true" />
            </Button>
          )
        ) : null}
      </div>
    </SurfaceCard>
  );
}
