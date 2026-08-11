import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { UserEvent } from "../../api/userEvents";
import { AccentBarCard, Badge, FeedCard } from "../../components/ui";
import { cardTitleClass } from "../../components/ui/pageTypography";
import { rruleFreqKey } from "../../domain/schedule/rruleSummary";
import { formatOsDateTime } from "../../utils/time";
import type { ScheduleRecurringItem } from "./useScheduleRecurringFeed";

const actionIconBtnClass =
  "im-icon-btn !h-7 !w-7 !rounded-md text-text-secondary transition-colors";

function formatEventWhen(event: UserEvent, allDayLabel: string): string {
  if (event.isAllDay) {
    const start = formatOsDateTime(event.startTime, { dateStyle: "medium", timeStyle: undefined });
    return `${allDayLabel} · ${start}`;
  }
  const start = formatOsDateTime(event.startTime, { dateStyle: "medium", timeStyle: "short" });
  if (!event.endTime) return start;
  const end = formatOsDateTime(event.endTime, { dateStyle: undefined, timeStyle: "short" });
  return `${start} – ${end}`;
}

export function ScheduleOneOffCard({
  event,
  worksetName,
  itemLabel,
  onEdit,
  onDelete,
}: {
  event: UserEvent;
  worksetName: string | null;
  itemLabel: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("schedule");
  const metaBits = [
    formatEventWhen(event, t("card.allDay")),
    event.location?.trim() ? event.location.trim() : null,
    worksetName ? `${t("card.workset")}: ${worksetName}` : null,
    itemLabel ? `${t("card.item")}: ${itemLabel}` : null,
  ].filter(Boolean);

  return (
    <FeedCard
      data-testid={`schedule-one-off-card-${event.id}`}
      density="default"
      style={{ borderLeft: "3px solid var(--accent)" }}
      header={
        <div className={`min-w-0 flex-1 line-clamp-2 ${cardTitleClass}`} title={event.title}>
          {event.title}
        </div>
      }
      meta={
        <div className="flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
          {metaBits.map((bit) => (
            <span key={bit}>{bit}</span>
          ))}
        </div>
      }
      body={event.body?.trim() ? event.body.trim() : undefined}
      footer={
        <div className="mt-auto flex items-center justify-end gap-1">
          <button
            type="button"
            className={actionIconBtnClass}
            aria-label={t("card.editAria", { title: event.title })}
            title={t("card.edit")}
            onClick={onEdit}
            data-testid={`schedule-one-off-edit-${event.id}`}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={actionIconBtnClass}
            aria-label={t("card.deleteAria", { title: event.title })}
            title={t("card.delete")}
            onClick={onDelete}
            data-testid={`schedule-one-off-delete-${event.id}`}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      }
    />
  );
}

export function ScheduleRecurringCard({
  task,
  worksetName,
  onEdit,
  onDelete,
}: {
  task: ScheduleRecurringItem;
  worksetName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("schedule");
  const freqKey = rruleFreqKey(task.rrule);
  const rruleLabel = task.rrule.trim()
    ? t(`rruleFreq.${freqKey}`)
    : t("card.noRrule");

  return (
    <AccentBarCard
      accentClass="bg-[var(--accent)]"
      className="h-full"
      data-testid={`schedule-recurring-card-${task.id}`}
    >
      <div className="flex items-start gap-2">
        <div className={`min-w-0 flex-1 line-clamp-2 ${cardTitleClass}`} title={task.name}>
          {task.name}
        </div>
        <Badge tone="info">{t("tabs.recurring")}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
        <span>
          {t("card.rrule")}: {rruleLabel}
          {task.rrule.trim() ? ` (${task.rrule.trim()})` : ""}
        </span>
        {worksetName ? (
          <span>
            {t("card.workset")}: {worksetName}
          </span>
        ) : null}
      </div>
      {task.description?.trim() ? (
        <p className="line-clamp-3 text-body text-text-secondary">{task.description.trim()}</p>
      ) : null}
      <div className="mt-auto flex items-center justify-end gap-1 pt-1">
        <button
          type="button"
          className={actionIconBtnClass}
          aria-label={t("card.editAria", { title: task.name })}
          title={t("card.edit")}
          onClick={onEdit}
          data-testid={`schedule-recurring-edit-${task.id}`}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={actionIconBtnClass}
          aria-label={t("card.deleteAria", { title: task.name })}
          title={t("card.delete")}
          onClick={onDelete}
          data-testid={`schedule-recurring-delete-${task.id}`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </AccentBarCard>
  );
}
