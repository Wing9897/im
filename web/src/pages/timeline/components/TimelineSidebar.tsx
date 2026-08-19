import { useMemo } from "react";
import { ChevronLeft, ListChecks, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, CardFieldIcon, PillButton, TextField } from "../../../components/ui";
import { captionClass, cardTitleClass } from "../../../components/ui/pageTypography";
import {
  useTaskCatalog,
  useWorksetNameById,
} from "../../../context/TaskCatalogContext";
import { itemDateKindLabel } from "../../../domain/items/itemCalendarProjection";
import {
  eventListCardTitle,
  eventShowsRemindBadge,
  formatEventListProvenanceLabel,
  resolveEventListProvenanceKind,
  resolveEventListWorksetName,
  type EventListCardMetaLookups,
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
import { ScheduleEventCompactEmoji } from "./ScheduleEventEmojiMark";
import { IntelEventMark } from "../../../components/task/IntelEventAvatarStack";
import { useTimelinePageContext } from "../TimelinePageContext";
import { dismissedTitleClass } from "../timelineDismissUtils";
import { useGeneralWorksetLabel } from "../../../domain/timeline/useGeneralWorksetLabel";
import { IMPORTANT_EVENT_EMOJI } from "../../../api/timelineImportance";
import { isUserScheduleTimelineEvent } from "../../../domain/schedule/scheduleCardFields";

const asideClass =
  "im-surface-panel relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--surface-border)_70%,transparent)] p-md";

type TimelineSidebarProps = {
  rangeEvents: TimelineItem[];
  focusedDay: Date | null;
  onClose?: () => void;
};

export function TimelineSidebar({
  rangeEvents,
  focusedDay,
  onClose,
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

  const isUserEvent = selectedEvent?.source === "user";
  const isItemEvent = selectedEvent?.source === "item_remind";
  const isDismissed = Boolean(selectedEvent?.dismissed);
  const isImportant = Boolean(selectedEvent?.important);
  const showRemindBadge = selectedEvent
    ? eventShowsRemindBadge(selectedEvent)
    : false;
  const detailTitle = selectedEvent
    ? eventListCardTitle(selectedEvent, { showRemindBadge })
    : "";

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

          <h2
            className={`m-0 flex min-w-0 items-center gap-sm pr-8 ${cardTitleClass} ${
              isDismissed ? dismissedTitleClass : ""
            }`}
            data-testid="timeline-sidebar-title"
          >
            {selectedEvent && !isImportant ? (
              isUserScheduleTimelineEvent(selectedEvent.source) ? (
                <ScheduleEventCompactEmoji event={selectedEvent} />
              ) : resolveEventListProvenanceKind(selectedEvent) === "task" ? (
                <IntelEventMark
                  event={selectedEvent}
                  size="compact"
                  label={t("eventList.eventAvatarAria")}
                />
              ) : null
            ) : null}
            {detailTitle}
          </h2>

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
              {t("sidebar.workset", {
                value: resolveEventListWorksetName(selectedEvent, metaLookups),
              })}
            </div>
            <div
              className="flex min-w-0 items-center gap-xs"
              data-testid="timeline-sidebar-provenance"
            >
              {resolveEventListProvenanceKind(selectedEvent) === "task" ? (
                <CardFieldIcon icon={ListChecks} />
              ) : null}
              {formatEventListProvenanceLabel(selectedEvent, t)}
            </div>
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
              <PillButton
                type="button"
                disabled={userEventActionBusy}
                active={isImportant}
                onClick={() => onToggleImportantEvent?.(selectedEvent)}
                data-testid="timeline-toggle-important"
              >
                {isImportant ? t("sidebar.unmarkImportant") : t("sidebar.markImportant")}
              </PillButton>
              {isDismissed ? (
                <PillButton
                  type="button"
                  disabled={userEventActionBusy}
                  onClick={() => onRestoreTimelineEvent?.(selectedEvent)}
                >
                  {t("sidebar.restore")}
                </PillButton>
              ) : (
                <PillButton
                  type="button"
                  disabled={userEventActionBusy}
                  onClick={() => onDismissTimelineEvent?.(selectedEvent)}
                >
                  {t("sidebar.dismiss")}
                </PillButton>
              )}
            </div>
          </section>

          {!isUserEvent && !isItemEvent ? (
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
          onSelectEvent={onSelectEvent}
        />
      )}
    </aside>
  );
}
