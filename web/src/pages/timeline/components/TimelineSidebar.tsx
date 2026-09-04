import { ChevronLeft, ListChecks, Trash2, Undo2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Button, CardFieldIcon, PillButton, TextField } from "../../../components/ui";
import { captionClass, cardTitleClass } from "../../../components/ui/pageTypography";
import { itemDateKindLabel } from "../../../domain/items/itemCalendarProjection";
import {
  eventListAllowsDismiss,
  eventListCardTitle,
  eventShowsRemindBadge,
  formatEventListAffiliationLabel,
  formatEventListProvenanceLabel,
  resolveEventListProvenanceKind,
  resolveSubscribedCalendarDescription,
  eventListShowsProvenance,
} from "../../../domain/timeline/eventListCardMeta";
import {
  getEventStatusColor,
  getEventStatusLabel,
  type TimelineEventStatus,
} from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import { joinList } from "../../../i18n/formatMessage";
import { formatOsDateTime } from "../../../utils/time";
import { EventListPanel } from "./EventListPanel";
import { EventListTitleMark } from "../../../components/timeline/EventListTitleMark";
import { SubscribedEventSubscribeIcon } from "../../../components/timeline/SubscribedEventSubscribeIcon";
import { useTimelinePageContext } from "../TimelinePageContext";
import { dismissedTitleClass } from "../timelineDismissUtils";
import { IMPORTANT_EVENT_EMOJI } from "../../../api/timelineImportance";
import { isSubscribedTimelineSource } from "../../../domain/calendarShare/subscribedCalendars";
import { resolveCalendarLeadingGlyph } from "../../../domain/timeline/importantEventDisplay";
import { useEventListMetaLookups } from "../../../domain/timeline/useEventListMetaLookups";

const asideClass =
  "im-surface-panel relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--surface-border)_70%,transparent)] p-md";

type TimelineSidebarProps = {
  rangeEvents: TimelineItem[];
  focusedDay: Date | null;
  onClose?: () => void;
  outOfView?: boolean;
};

export function TimelineSidebar({
  rangeEvents,
  focusedDay,
  onClose,
  outOfView = false,
}: TimelineSidebarProps) {
  const { t } = useTranslation("timeline");
  const {
    selectedEvent,
    onSelectEvent,
    eventStatuses,
    editStartTime,
    editEndTime,
    setEditStartTime,
    setEditEndTime,
    onSaveTimeOverride,
    onResetTimeOverride,
    onSetEventStatus,
    onEditUserEvent,
    onEditItemEvent,
    onDismissTimelineEvent,
    onRestoreTimelineEvent,
    onToggleImportantEvent,
    userEventActionBusy,
  } = useTimelinePageContext();
  const { t: ti } = useTranslation("items");
  const metaLookups = useEventListMetaLookups();

  const isUserEvent = selectedEvent?.source === "user";
  const isItemEvent = selectedEvent?.source === "item_remind";
  const isSubscribed = isSubscribedTimelineSource(selectedEvent?.source);
  const isDismissed = Boolean(selectedEvent?.dismissed);
  const isImportant = Boolean(selectedEvent?.important);
  const showRemindBadge = selectedEvent
    ? eventShowsRemindBadge(selectedEvent)
    : false;
  const detailTitle = selectedEvent
    ? eventListCardTitle(selectedEvent, { showRemindBadge })
    : "";
  const detailLeading =
    selectedEvent && !isImportant && !showRemindBadge
      ? resolveCalendarLeadingGlyph(selectedEvent)
      : null;
  const detailStatus = selectedEvent
    ? (eventStatuses[selectedEvent.id] ?? "pending")
    : "pending";
  const detailStatusColor = getEventStatusColor(detailStatus);
  const detailStatusLabel = t("eventList.statusWithLabel", {
    value: getEventStatusLabel(detailStatus),
  });

  return (
    <aside className={asideClass}>
      {onClose ? (
        <PillButton
          type="button"
          onClick={onClose}
          aria-label={t("sidebar.closeAria")}
          padding="square"
          className="absolute right-md top-md"
        >
          <X size={16} strokeWidth={2.5} aria-hidden="true" />
        </PillButton>
      ) : null}

      {selectedEvent ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-md overflow-y-auto overflow-x-hidden">
          <PillButton
            type="button"
            onClick={() => onSelectEvent(null)}
            className="self-start"
            aria-label={t("sidebar.backAria")}
            title={t("sidebar.backAria")}
          >
            <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
          </PillButton>

          <div className="flex min-w-0 items-start justify-between gap-sm pr-8">
            <h2
              className={`m-0 flex min-w-0 flex-1 items-center gap-sm ${cardTitleClass} ${
                isDismissed ? dismissedTitleClass : ""
              }`}
              data-testid="timeline-sidebar-title"
            >
              {selectedEvent && !isImportant ? (
                <EventListTitleMark
                  event={selectedEvent}
                  leading={detailLeading}
                  metaLookups={metaLookups}
                  eventAvatarAria={t("eventList.eventAvatarAria")}
                  markerClassName=""
                />
              ) : null}
              {isSubscribed ? <SubscribedEventSubscribeIcon /> : null}
              {detailTitle}
            </h2>
            {isDismissed ? (
              <PillButton
                type="button"
                padding="square"
                className="shrink-0"
                disabled={userEventActionBusy}
                aria-label={t("sidebar.restore")}
                title={t("sidebar.restore")}
                data-testid="timeline-sidebar-restore"
                onClick={() => onRestoreTimelineEvent?.(selectedEvent)}
              >
                <Undo2 size={16} strokeWidth={2.5} aria-hidden="true" />
              </PillButton>
            ) : eventListAllowsDismiss(selectedEvent) ? (
              <Button
                type="button"
                variant="danger"
                size="icon"
                className="shrink-0"
                disabled={userEventActionBusy}
                aria-label={t("sidebar.dismiss")}
                title={t("sidebar.dismiss")}
                data-testid="timeline-sidebar-dismiss"
                onClick={() => onDismissTimelineEvent?.(selectedEvent)}
              >
                <Trash2 size={16} strokeWidth={2.5} aria-hidden="true" />
              </Button>
            ) : null}
          </div>

          {isImportant ? (
            <Badge
              tone="warning"
              className="normal-case tracking-normal self-start"
              data-testid="timeline-sidebar-important"
            >
              {IMPORTANT_EVENT_EMOJI} {t("sidebar.importantBadge")}
            </Badge>
          ) : null}

          {showRemindBadge ? (
            <Badge
              tone="warning"
              className="normal-case tracking-normal self-start"
              data-testid="timeline-sidebar-remind-badge"
            >
              {itemDateKindLabel("remind")}
            </Badge>
          ) : null}

          {selectedEvent.body ? (
            <p className="m-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-text-secondary">
              {selectedEvent.body}
            </p>
          ) : null}

          <dl className={`${captionClass} m-0 grid gap-1`}>
            <div
              data-testid="timeline-sidebar-status"
              style={{ color: detailStatusColor }}
            >
              {detailStatusLabel}
            </div>
            <div>
              {t("sidebar.start", { value: formatOsDateTime(selectedEvent.startTime) })}
            </div>
            {selectedEvent.endTime ? (
              <div>
                {t("sidebar.end", { value: formatOsDateTime(selectedEvent.endTime) })}
              </div>
            ) : null}
            {selectedEvent.location ? (
              <div>{t("sidebar.location", { value: selectedEvent.location })}</div>
            ) : null}
            {(selectedEvent.participants ?? []).length > 0 ? (
              <div>
                {t("sidebar.participants", {
                  value: joinList(selectedEvent.participants ?? []),
                })}
              </div>
            ) : null}
            <div data-testid="timeline-sidebar-workset">
              {formatEventListAffiliationLabel(selectedEvent, t, metaLookups)}
            </div>
            {resolveSubscribedCalendarDescription(selectedEvent, metaLookups) ? (
              <div
                className="text-[11px] leading-snug text-text-muted"
                data-testid="timeline-sidebar-calendar-description"
              >
                {resolveSubscribedCalendarDescription(selectedEvent, metaLookups)}
              </div>
            ) : null}
            {eventListShowsProvenance(selectedEvent) ? (
            <div
              className="flex min-w-0 items-center gap-xs"
              data-testid="timeline-sidebar-provenance"
            >
              {resolveEventListProvenanceKind(selectedEvent) === "task" ? (
                <CardFieldIcon icon={ListChecks} />
              ) : null}
              {formatEventListProvenanceLabel(selectedEvent, t)}
            </div>
            ) : null}
          </dl>

          <section className="grid gap-sm border-t border-surface-border pt-md">
            <div className="flex flex-wrap gap-sm">
              {isUserEvent ? (
                <PillButton
                  type="button"
                  disabled={userEventActionBusy}
                  onClick={() => onEditUserEvent?.(selectedEvent)}
                >
                  {t("sidebar.edit")}
                </PillButton>
              ) : null}
              {isItemEvent && selectedEvent.itemId ? (
                <PillButton
                  type="button"
                  disabled={userEventActionBusy}
                  onClick={() => onEditItemEvent?.(selectedEvent)}
                >
                  {ti("editItem")}
                </PillButton>
              ) : null}
              {isSubscribed ? null : (
              <PillButton
                type="button"
                disabled={userEventActionBusy}
                active={isImportant}
                onClick={() => onToggleImportantEvent?.(selectedEvent)}
                data-testid="timeline-toggle-important"
              >
                {isImportant ? t("sidebar.unmarkImportant") : t("sidebar.markImportant")}
              </PillButton>
              )}
            </div>
          </section>

          {!isUserEvent && !isItemEvent && !isSubscribed ? (
            <section className="grid gap-sm border-t border-surface-border pt-md">
              <h3 className="m-0 text-xs font-semibold text-text-primary">
                {t("sidebar.manualTime")}
              </h3>
              <TextField
                type="datetime-local"
                value={editStartTime}
                onChange={(event) => setEditStartTime(event.target.value)}
                className="w-full"
              />
              <TextField
                type="datetime-local"
                value={editEndTime}
                onChange={(event) => setEditEndTime(event.target.value)}
                className="w-full"
              />
              <div className="flex flex-wrap gap-sm">
                <PillButton type="button" onClick={onSaveTimeOverride}>
                  {t("sidebar.applyTime")}
                </PillButton>
                <PillButton type="button" onClick={onResetTimeOverride}>
                  {t("sidebar.resetAiTime")}
                </PillButton>
              </div>
              <p className={`${captionClass} m-0`}>{t("sidebar.overrideHint")}</p>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-sm">
            {(["pending", "confirmed", "completed"] as TimelineEventStatus[]).map(
              (status) => {
                const isActive =
                  (eventStatuses[selectedEvent.id] ?? "pending") === status;
                return (
                  <PillButton
                    key={status}
                    type="button"
                    active={isActive}
                    onClick={() => onSetEventStatus(selectedEvent.id, status)}
                    style={
                      isActive
                        ? {
                            color: getEventStatusColor(status),
                            borderColor: getEventStatusColor(status),
                          }
                        : undefined
                    }
                  >
                    {getEventStatusLabel(status)}
                  </PillButton>
                );
              },
            )}
          </div>
        </div>
      ) : (
        <EventListPanel
          rangeEvents={rangeEvents}
          focusedDay={focusedDay}
          outOfView={outOfView}
          onSelectEvent={onSelectEvent}
        />
      )}
    </aside>
  );
}
