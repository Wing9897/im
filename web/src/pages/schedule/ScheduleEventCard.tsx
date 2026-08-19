import { AlignLeft, CalendarClock, CalendarDays, Clock, Layers, MapPin, Pencil, Repeat, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { UserEvent } from "../../api/userEvents";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import {
  AccentBarCard,
  Badge,
  CardFieldRow,
  cardTitleHeaderClass,
  cardTitleLeadClass,
} from "../../components/ui";
import { cardTitleClass } from "../../components/ui/pageTypography";
import { scheduleCardText } from "../../domain/schedule/scheduleCardFields";
import { rruleFreqKey } from "../../domain/schedule/rruleSummary";
import { formatOsDateTime } from "../../utils/time";
import { ScheduleCardEmoji } from "./ScheduleCardEmoji";
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

function ScheduleCardFields({
  rows,
}: {
  rows: Array<{
    key: string;
    text: string;
    testId: string;
    icon: LucideIcon;
    clamp?: boolean;
    empty?: boolean;
  }>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-testid="schedule-card-fields">
      {rows.map((row) => (
        <CardFieldRow
          key={row.key}
          icon={row.icon}
          text={row.text}
          testId={row.testId}
          clamp={row.clamp}
          empty={row.empty}
          className="text-caption leading-snug text-text-secondary"
        />
      ))}
    </div>
  );
}

export function ScheduleOneOffCard({
  event,
  worksetName,
  emoji,
  onEdit,
  onDelete,
  onEmojiChange,
}: {
  event: UserEvent;
  worksetName: string | null;
  emoji: string;
  onEdit: () => void;
  onDelete: () => void;
  onEmojiChange: (emoji: string) => void | Promise<void>;
}) {
  const { t } = useTranslation("schedule");
  const empty = t("card.empty");
  const location = scheduleCardText(event.location, empty);
  const notes = scheduleCardText(event.body, empty);
  const rows = [
    {
      key: "when",
      icon: Clock,
      text: formatEventWhen(event, t("card.allDay")),
      testId: "schedule-card-when",
    },
    {
      key: "location",
      icon: MapPin,
      text: t("card.locationLine", { value: location }),
      testId: "schedule-card-location",
      empty: location === empty,
    },
    {
      key: "notes",
      icon: AlignLeft,
      text: t("card.notesLine", { value: notes }),
      testId: "schedule-card-notes",
      empty: notes === empty,
      clamp: true,
    },
    ...(worksetName
      ? [
          {
            key: "workset",
            icon: Layers,
            text: `${t("card.workset")}: ${worksetName}`,
            testId: "schedule-card-workset",
          },
        ]
      : []),
  ];

  return (
    <AccentBarCard
      accentClass="bg-[var(--accent)]"
      className="h-full"
      data-testid={`schedule-one-off-card-${event.id}`}
    >
      <div className={cardTitleHeaderClass}>
        <span className={cardTitleLeadClass}>
          <ScheduleCardEmoji
            emoji={emoji}
            name={event.title}
            defaultIcon={CalendarDays}
            onSelect={onEmojiChange}
          />
          <div className={`min-w-0 flex-1 line-clamp-2 ${cardTitleClass}`} title={event.title}>
            {event.title}
          </div>
        </span>
        <Badge tone="neutral">{t("badge.oneOff")}</Badge>
      </div>
      <ScheduleCardFields rows={rows} />
      <div className="mt-auto flex items-center justify-end gap-1 pt-1">
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
    </AccentBarCard>
  );
}

export function ScheduleRecurringCard({
  task,
  worksetName,
  emoji,
  onEdit,
  onDelete,
  onToggleActive,
  onEmojiChange,
}: {
  task: ScheduleRecurringItem;
  worksetName: string | null;
  emoji: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => Promise<void>;
  onEmojiChange: (emoji: string) => void | Promise<void>;
}) {
  const { t } = useTranslation("schedule");
  const [toggling, setToggling] = useState(false);
  const freqKey = rruleFreqKey(task.rrule);
  const rruleLabel = task.rrule.trim()
    ? t(`rruleFreq.${freqKey}`)
    : t("card.noRrule");
  const empty = t("card.empty");
  const location = scheduleCardText(task.eventLocation, empty);
  const notes = scheduleCardText(task.eventDescription ?? task.description, empty);
  const rows = [
    {
      key: "rrule",
      icon: CalendarClock,
      text: `${t("card.rrule")}: ${rruleLabel}${task.rrule.trim() ? ` (${task.rrule.trim()})` : ""}`,
      testId: "schedule-card-rrule",
    },
    {
      key: "location",
      icon: MapPin,
      text: t("card.locationLine", { value: location }),
      testId: "schedule-card-location",
      empty: location === empty,
    },
    {
      key: "notes",
      icon: AlignLeft,
      text: t("card.notesLine", { value: notes }),
      testId: "schedule-card-notes",
      empty: notes === empty,
      clamp: true,
    },
    ...(worksetName
      ? [
          {
            key: "workset",
            icon: Layers,
            text: `${t("card.workset")}: ${worksetName}`,
            testId: "schedule-card-workset",
          },
        ]
      : []),
  ];

  return (
    <AccentBarCard
      accentClass="bg-[var(--accent)]"
      className="h-full"
      data-testid={`schedule-recurring-card-${task.id}`}
    >
      <div className={cardTitleHeaderClass}>
        <span className={cardTitleLeadClass}>
          <ScheduleCardEmoji
            emoji={emoji}
            name={task.name}
            defaultIcon={Repeat}
            onSelect={onEmojiChange}
          />
          <div className={`min-w-0 flex-1 line-clamp-2 ${cardTitleClass}`} title={task.name}>
            {task.name}
          </div>
        </span>
        <Badge tone="info">{t("badge.recurring")}</Badge>
      </div>
      <ScheduleCardFields rows={rows} />
      <div className="mt-auto flex items-center justify-end gap-1 pt-1">
        <ToggleSwitch
          checked={task.isActive}
          disabled={toggling}
          showLabel={false}
          label={task.isActive ? t("editor.pause") : t("editor.resume")}
          onChange={() => {
            setToggling(true);
            void onToggleActive().finally(() => setToggling(false));
          }}
        />
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
