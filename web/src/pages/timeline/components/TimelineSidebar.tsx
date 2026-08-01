import { ChevronLeft, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PillButton, TextField } from "../../../components/ui";
import { captionClass, cardTitleClass } from "../../../components/ui/pageTypography";
import {
  getEventStatusColor,
  getEventStatusLabel,
  type TimelineEventStatus,
} from "../../../domain/timeline/status";
import type { TimelineItem } from "../../../types";
import { joinList } from "../../../i18n/formatMessage";
import { formatOsDateTime } from "../../../utils/time";
import { isNullProvenanceTaskId } from "../../../domain/timeline/userEvents";
import { EventListPanel } from "./EventListPanel";
import { useTimelinePageContext } from "../TimelinePageContext";
import { dismissedTitleClass } from "../timelineDismissUtils";

const asideClass =
  "relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-[color-mix(in_srgb,var(--surface-border)_70%,transparent)] pl-lg";

type TimelineSidebarProps = {
  rangeEvents: TimelineItem[];
  allRangeEvents: TimelineItem[];
  hasDayFocus: boolean;
  onClose?: () => void;
};

export function TimelineSidebar({
  rangeEvents,
  allRangeEvents,
  hasDayFocus,
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
    onDismissTimelineEvent,
    onRestoreTimelineEvent,
    userEventActionBusy,
  } = useTimelinePageContext();

  const isUserEvent = selectedEvent?.source === "user";
  const isDismissed = Boolean(selectedEvent?.dismissed);

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
            className={`m-0 pr-8 ${cardTitleClass} ${
              isDismissed ? dismissedTitleClass : ""
            }`}
          >
            {selectedEvent.title}
          </h2>

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
            {selectedEvent.taskName ? (
              isUserEvent && isNullProvenanceTaskId(selectedEvent.taskId) ? (
                <div>
                  {t("sidebar.workset", { value: selectedEvent.taskName })}
                </div>
              ) : (
                <div>{t("sidebar.task", { value: selectedEvent.taskName })}</div>
              )
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

          {!isUserEvent ? (
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
          allRangeEvents={allRangeEvents}
          hasDayFocus={hasDayFocus}
          onSelectEvent={onSelectEvent}
        />
      )}
    </aside>
  );
}
