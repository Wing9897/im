import { useEffect, useMemo, useState } from "react";
import { AlignLeft, Clock, ListChecks, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge, CardFieldIcon, CardFieldRow, FilterChip, SurfaceCard } from "../../../components/ui";
import { captionClass, cardTitleClass } from "../../../components/ui/pageTypography";
import {
  useTaskCatalog,
  useWorksetNameById,
} from "../../../context/TaskCatalogContext";
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
  eventListTimeLabel,
  formatEventListProvenanceLabel,
  previewEventBody,
  resolveEventCardDisplay,
  resolveEventListProvenanceKind,
  resolveEventListWorksetName,
  type EventListCardMetaLookups,
} from "../../../domain/timeline/eventListCardMeta";
import {
  filterSidebarDayGroups,
  groupSidebarDayEvents,
  type SidebarDayPhaseFilter,
} from "../../../domain/timeline/eventTimePhase";
import { startOfDay } from "../../../domain/timeline/dateUtils";
import {
  getEventStatusColor,
  getEventStatusLabel,
} from "../../../domain/timeline/status";
import { useGeneralWorksetLabel } from "../../../domain/timeline/useGeneralWorksetLabel";
import type { TimelineItem } from "../../../types";
import { dismissedSurfaceClass, dismissedTitleClass } from "../timelineDismissUtils";
import { resolveSidebarDay } from "../timelinePageUtils";
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

function EventListItem({
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
                {getEventStatusLabel(status)}
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
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-sm gap-y-0.5 text-[11px] text-text-muted">
              <span style={{ color: statusColor }} data-testid="timeline-event-list-status">
                {getEventStatusLabel(status)}
              </span>
              <span className="min-w-0 truncate" data-testid="timeline-event-list-workset">
                {worksetLabel}
              </span>
              <EventProvenanceRow event={event} label={provenanceLabel} />
            </div>
          </>
        )}
      </button>
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
    </SurfaceCard>
  );
}

function EventListGroup({
  title,
  events,
  focusedDay,
  onSelectEvent,
  testId,
  metaLookups,
}: {
  title: string;
  events: TimelineItem[];
  focusedDay: Date;
  onSelectEvent: (event: TimelineItem | null) => void;
  testId: string;
  metaLookups: EventListCardMetaLookups;
}) {
  if (events.length === 0) return null;
  return (
    <section className="flex min-w-0 shrink-0 flex-col gap-sm" data-testid={testId}>
      <div className="flex min-w-0 shrink-0 items-center gap-sm px-0.5">
        <h3 className={`${captionClass} m-0 shrink-0 font-medium text-text-secondary`}>
          {title}
        </h3>
        <div
          className="h-px min-w-0 flex-1 rounded-full bg-surface-border"
          aria-hidden="true"
          data-testid={`${testId}-divider`}
        />
      </div>
      {events.map((event) => (
        <EventListItem
          key={event.id}
          event={event}
          focusedDay={focusedDay}
          onSelectEvent={onSelectEvent}
          metaLookups={metaLookups}
        />
      ))}
    </section>
  );
}

/**
 * Right-hand event list: always scoped to one local day (selected day, default today).
 * Quick filters: 全部 + 进行中 / 未开始 (vs **real now** only).
 * Card tags: 跨日进行中 + 结束于本日/当日 (aligned with month +N chips).
 */
export function EventListPanel({
  rangeEvents,
  focusedDay,
  onSelectEvent,
}: {
  /** Day-filtered events for the sidebar (from {@link computeSidebarEvents}). */
  rangeEvents: TimelineItem[];
  focusedDay: Date | null;
  onSelectEvent: (event: TimelineItem | null) => void;
}) {
  const { t } = useTranslation("timeline");
  const { tasks } = useTaskCatalog();
  const worksetNameById = useWorksetNameById();
  const generalWorksetLabel = useGeneralWorksetLabel();
  const taskWorksetById = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (typeof task.worksetId === "string" && task.worksetId.trim()) {
        map.set(task.id, task.worksetId.trim());
      }
    }
    return map;
  }, [tasks]);
  const metaLookups = useMemo<EventListCardMetaLookups>(
    () => ({ generalWorksetLabel, worksetNameById, taskWorksetById }),
    [generalWorksetLabel, worksetNameById, taskWorksetById],
  );
  const day = resolveSidebarDay(focusedDay);
  const dayKey = startOfDay(day).getTime();
  const [phaseFilter, setPhaseFilter] = useState<SidebarDayPhaseFilter>("all");

  useEffect(() => {
    setPhaseFilter("all");
  }, [dayKey]);

  const groups = filterSidebarDayGroups(
    groupSidebarDayEvents(rangeEvents),
    phaseFilter,
  );
  const visibleCount = groups.ongoing.length + groups.upcoming.length;
  const dayLabel = startOfDay(day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-md overflow-hidden">
      <div
        className="flex w-full shrink-0 flex-wrap items-center justify-between gap-x-sm gap-y-1.5"
        data-testid="timeline-event-list-header"
      >
        {rangeEvents.length > 0 ? (
          <div
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t("eventList.phaseFilterAria")}
            data-testid="timeline-event-phase-filter"
          >
            {(
              [
                ["all", "eventList.filterAll"],
                ["ongoing", "eventList.filterOngoing"],
                ["upcoming", "eventList.filterUpcoming"],
              ] as const
            ).map(([id, labelKey]) => (
              <FilterChip
                key={id}
                size="sm"
                active={phaseFilter === id}
                onClick={() => setPhaseFilter(id)}
                data-testid={`timeline-event-phase-filter-${id}`}
              >
                {t(labelKey)}
              </FilterChip>
            ))}
          </div>
        ) : (
          <span className="min-w-0 flex-1" aria-hidden="true" />
        )}
        <p
          className={`${captionClass} m-0 shrink-0 self-center font-medium tabular-nums`}
          data-testid="timeline-event-list-day-label"
        >
          {dayLabel}
        </p>
      </div>
      <div
        className="im-auto-scrollbar im-timeline-event-list flex min-h-0 min-w-0 flex-1 flex-col gap-md overflow-x-hidden overflow-y-auto"
        data-testid="timeline-event-list-scroll"
      >
        {rangeEvents.length === 0 ? (
          <p className={`${captionClass} m-0 shrink-0`}>{t("eventList.empty")}</p>
        ) : visibleCount === 0 ? (
          <p className={`${captionClass} m-0 shrink-0`}>{t("eventList.emptyFiltered")}</p>
        ) : (
          <>
            <EventListGroup
              title={t("eventList.filterOngoing")}
              events={groups.ongoing}
              focusedDay={day}
              onSelectEvent={onSelectEvent}
              testId="timeline-event-group-ongoing"
              metaLookups={metaLookups}
            />
            <EventListGroup
              title={t("eventList.filterUpcoming")}
              events={groups.upcoming}
              focusedDay={day}
              onSelectEvent={onSelectEvent}
              testId="timeline-event-group-upcoming"
              metaLookups={metaLookups}
            />
          </>
        )}
      </div>
    </div>
  );
}
