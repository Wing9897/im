import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";

import { listTasks } from "../../api/tasks";
import { listUserEvents, type UserEvent } from "../../api/userEvents";
import type { AnalysisTask } from "../../types";
import { Button, PillButton, captionClass } from "../../components/ui";
import {
  LINKED_CALENDAR_QUICK_KINDS,
  linkedCalendarQuickLabelKey,
  type LinkedCalendarQuickKind,
} from "../../domain/items/linkedCalendarQuickCreate";
import { formatDateOnly, formatDateTime } from "../../utils/dateFormat";

type Props = {
  itemId: string;
  /** Bump to reload after an in-place create/edit. */
  refreshKey?: number;
  disabled?: boolean;
  onAdd: () => void;
  /** Quick title presets → same create dialog as onAdd. */
  onQuickAdd?: (kind: LinkedCalendarQuickKind) => void;
  /** Edit a one-off linked user event (same dialog as Timeline). */
  onEditOneOff?: (event: UserEvent) => void;
};

type LinkedRowBase = {
  id: string;
  title: string;
  detail: string;
  sortKey: string;
};

type LinkedRow =
  | (LinkedRowBase & { kind: "oneOff"; event: UserEvent })
  | (LinkedRowBase & { kind: "recurring" });

const ROW_CLASS =
  "flex flex-wrap items-baseline justify-between gap-x-sm gap-y-0.5 rounded border border-surface-border/45 bg-surface px-sm py-0.5";

function formatEventWhen(event: UserEvent): string {
  const startMs = Date.parse(event.startTime);
  if (!Number.isFinite(startMs)) return event.startTime;
  if (event.isAllDay) return formatDateOnly(startMs) || event.startTime.slice(0, 10);
  return formatDateTime(startMs) || event.startTime;
}

function toOneOffRow(event: UserEvent): LinkedRow {
  return {
    kind: "oneOff",
    id: `ue:${event.id}`,
    title: event.title,
    detail: formatEventWhen(event),
    sortKey: String(event.startTime),
    event,
  };
}

function toRecurringRow(task: AnalysisTask): LinkedRow {
  return {
    kind: "recurring",
    id: `rs:${task.id}`,
    title: task.name,
    detail: task.scheduleRrule?.trim() || "RRULE",
    sortKey: String(task.createdAt || task.name),
  };
}

function LinkedCalendarRow({
  row,
  disabled,
  kindLabel,
  onEdit,
}: {
  row: LinkedRow;
  disabled: boolean;
  kindLabel: string;
  onEdit?: (event: UserEvent) => void;
}) {
  const editable = row.kind === "oneOff" && Boolean(onEdit);

  const activate = () => {
    if (!editable || disabled || row.kind !== "oneOff") return;
    onEdit?.(row.event);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (!editable || disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  return (
    <li
      className={
        editable
          ? `${ROW_CLASS} cursor-pointer hover:border-surface-border`
          : ROW_CLASS
      }
      data-kind={row.kind}
      data-testid={
        row.kind === "oneOff"
          ? "item-linked-calendar-row-one-off"
          : "item-linked-calendar-row-recurring"
      }
      role={editable ? "button" : undefined}
      tabIndex={editable && !disabled ? 0 : undefined}
      onClick={editable ? activate : undefined}
      onKeyDown={editable ? onKeyDown : undefined}
    >
      <span className="flex min-w-0 items-baseline gap-xs">
        <span
          className="shrink-0 rounded border border-surface-border/60 px-xs text-caption text-text-secondary"
          data-testid={
            row.kind === "recurring"
              ? "item-linked-calendar-badge-recurring"
              : "item-linked-calendar-badge-one-off"
          }
        >
          {kindLabel}
        </span>
        <span className="min-w-0 truncate text-caption font-medium text-text-primary">
          {row.title}
        </span>
      </span>
      <span className={`shrink-0 ${captionClass}`}>{row.detail}</span>
    </li>
  );
}

/** Lists one-off + recurring calendars linked to an inventory item + CTA to add. */
export function ItemFormLinkedCalendarsSection({
  itemId,
  refreshKey = 0,
  disabled = false,
  onAdd,
  onQuickAdd,
  onEditOneOff,
}: Props) {
  const { t } = useTranslation("items");
  const [rows, setRows] = useState<LinkedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [events, recurring] = await Promise.all([
        listUserEvents({ itemId }),
        listTasks({ itemId, analysisMode: "recurring" }),
      ]);
      const merged: LinkedRow[] = [
        ...events.map(toOneOffRow),
        ...recurring.map(toRecurringRow),
      ];
      merged.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      setRows(merged);
    } catch {
      setRows([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return (
    <section
      className="flex flex-col gap-xs rounded-md border border-surface-border/60 bg-[color-mix(in_srgb,var(--surface-raised)_28%,transparent)] px-sm py-xs"
      aria-label={t("sectionLinkedCalendars")}
      data-testid="item-form-linked-calendars"
    >
      <div className="flex flex-wrap items-center justify-between gap-xs">
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-caption font-semibold text-text-primary">
            {t("sectionLinkedCalendars")}
          </h3>
          <p className={`${captionClass} mt-0.5`}>{t("sectionLinkedCalendarsHint")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-xs">
          {onQuickAdd ? (
            <div
              className="flex flex-wrap items-center gap-0.5"
              role="group"
              aria-label={t("quickLinkedCalendarGroupAria")}
              data-testid="item-form-quick-linked-calendars"
            >
              {LINKED_CALENDAR_QUICK_KINDS.map((kind) => (
                <PillButton
                  key={kind}
                  disabled={disabled}
                  data-testid={`item-form-quick-linked-calendar-${kind}`}
                  onClick={() => onQuickAdd(kind)}
                >
                  {t(linkedCalendarQuickLabelKey(kind))}
                </PillButton>
              ))}
            </div>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            data-testid="item-form-add-linked-calendar"
            onClick={onAdd}
          >
            {t("addLinkedCalendar")}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className={`m-0 ${captionClass}`}>{t("linkedCalendarsLoading")}</p>
      ) : loadError ? (
        <p className="m-0 text-caption text-error" role="alert">
          {t("linkedCalendarsLoadFailed")}
        </p>
      ) : rows.length === 0 ? (
        <div
          className="flex items-center gap-xs rounded border border-dashed border-surface-border/50 px-sm py-1"
          data-testid="item-form-linked-calendars-empty"
        >
          <CalendarDays
            size={14}
            strokeWidth={1.75}
            className="shrink-0 text-text-muted"
            aria-hidden
          />
          <p className={`m-0 ${captionClass}`}>{t("linkedCalendarsEmpty")}</p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0" data-testid="item-form-linked-calendar-list">
          {rows.map((row) => (
            <LinkedCalendarRow
              key={row.id}
              row={row}
              disabled={disabled}
              kindLabel={
                row.kind === "recurring"
                  ? t("linkedCalendarKindRecurring")
                  : t("linkedCalendarKindOneOff")
              }
              onEdit={onEditOneOff}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
