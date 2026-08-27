import { AlignLeft, Clock, ListChecks, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge, CardFieldIcon, CardFieldRow, SurfaceCard } from "../../../components/ui";
import { captionClass, cardTitleClass } from "../../../components/ui/pageTypography";
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
  eventListAllowsDismiss,
  eventListTimeLabel,
  formatEventListProvenanceLabel,
  previewEventBody,
  resolveEventCardDisplay,
  resolveEventListProvenanceKind,
  resolveEventListWorksetName,
  type EventListCardMetaLookups,
} from "../../../domain/timeline/eventListCardMeta";
import {
  getEventStatusColor,
  getEventStatusLabel,
} from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import { dismissedSurfaceClass, dismissedTitleClass } from "../timelineDismissUtils";
import { useTimelinePageContext } from "../TimelinePageContext";
import { ScheduleEventTitleMark } from "./ScheduleEventEmojiMark";
import { IntelEventMark } from "../../../components/task/IntelEventAvatarStack";

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
  worksetLabel,
}: {
  statusColor: string;
  statusLabel: string;
  worksetLabel: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-x-sm gap-y-0.5"
      data-testid="timeline-event-list-status-workset"
    >
      <span style={{ color: statusColor }} data-testid="timeline-event-list-status">
        {statusLabel}
      </span>
      <span className="min-w-0 truncate" data-testid="timeline-event-list-workset">
        {worksetLabel}
      </span>
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
  const worksetLabel = t("sidebar.workset", {
    value: resolveEventListWorksetName(event, metaLookups),
  });
  const provenanceLabel = formatEventListProvenanceLabel(event, t);
  const statusLabel = getEventStatusLabel(status);
  const allowDismiss = eventListAllowsDismiss(event);
  const showDismissFooter = dismissed || allowDismiss;

  return (
    <SurfaceCard
      density="field"
      interactive
      className={`im-timeline-event-list-item min-w-0 shrink-0 cursor-pointer rounded-xl p-md text-left ${
        dismissed ? dismissedSurfaceClass : ""
      }`}
    >
      <button
        type="button"
        className="min-w-0 w-full border-none bg-transparent p-0 text-left font-[inherit]"
        onClick={() => onSelectEvent(event)}
      >
        <div className="flex min-w-0 items-start gap-sm">
          {leading ? (
            <span
              className={`mt-1 ${itemDateKindMarkerClass(
                leading.type === "item" ? leading.itemDateKind : null,
              )}`}
              aria-hidden="true"
              data-testid={
                leading.type === "important"
                  ? "timeline-important-marker"
                  : "timeline-item-kind-marker"
              }
            >
              {leading.emoji}
            </span>
          ) : scheduleCard ? (
            <ScheduleEventTitleMark event={event} />
          ) : resolveEventListProvenanceKind(event) === "task" ? (
            <IntelEventMark
              event={event}
              size="compact"
              label={t("eventList.eventAvatarAria")}
            />
          ) : null}
          <div
            className={`${cardTitleClass} min-w-0 flex-1 truncate ${
              dismissed ? dismissedTitleClass : ""
            }`}
            title={title}
          >
            {title}
          </div>
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
        </div>
        {scheduleCard ? (
          <div className="mt-1 flex min-w-0 flex-col gap-0.5">
            <CardFieldRow
              icon={Clock}
              text={timeLabel}
              testId="timeline-event-list-when"
              className={captionClass}
            />
            <CardFieldRow
              icon={MapPin}
              text={t("calendar.location", { value: location })}
              empty={location === emptyValue}
              testId="timeline-event-list-location"
              className={captionClass}
            />
            <CardFieldRow
              icon={AlignLeft}
              text={t("calendar.notes", { value: notes })}
              empty={notes === emptyValue}
              testId="timeline-event-list-notes"
              className="text-xs leading-snug text-text-secondary"
            />
            <div
              className="mt-0.5 flex min-w-0 flex-col gap-0.5 text-[11px] text-text-muted"
              data-testid="timeline-event-list-meta"
            >
              <span style={{ color: statusColor }} data-testid="timeline-event-list-status">
                {statusLabel}
              </span>
              <span className="min-w-0 truncate" data-testid="timeline-event-list-workset">
                {worksetLabel}
              </span>
              <EventProvenanceRow event={event} label={provenanceLabel} />
            </div>
          </div>
        ) : (
          <>
            {bodyPreview ? (
              <CardFieldRow
                icon={AlignLeft}
                text={bodyPreview}
                title={event.body}
                className="mt-1 text-xs leading-snug text-text-secondary"
              />
            ) : null}
            <CardFieldRow
              icon={MapPin}
              text={t("calendar.location", { value: location })}
              empty={!location}
              testId="timeline-event-list-location"
              className={`${captionClass} mt-1`}
            />
            <CardFieldRow
              icon={Clock}
              text={timeLabel}
              className={`${captionClass} mt-1`}
            />
            <div className="mt-1 flex min-w-0 flex-col gap-0.5 text-[11px] text-text-muted">
              <EventListStatusWorksetRow
                statusColor={statusColor}
                statusLabel={statusLabel}
                worksetLabel={worksetLabel}
              />
              <EventProvenanceRow event={event} label={provenanceLabel} />
            </div>
          </>
        )}
      </button>
      {showDismissFooter ? (
        <div className="mt-sm">
          {dismissed ? (
            <button
              type="button"
              className="border-none bg-transparent p-0 text-caption text-text-secondary hover:text-text-primary"
              disabled={userEventActionBusy}
              data-testid="timeline-event-list-restore"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onRestoreTimelineEvent?.(event);
              }}
            >
              {t("sidebar.restore")}
            </button>
          ) : (
            <button
              type="button"
              className="border-none bg-transparent p-0 text-caption text-text-secondary hover:text-text-primary"
              disabled={userEventActionBusy}
              data-testid="timeline-event-list-dismiss"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onDismissTimelineEvent?.(event);
              }}
            >
              {t("sidebar.dismiss")}
            </button>
          )}
        </div>
      ) : null}
    </SurfaceCard>
  );
}
