import { CalendarClock, CalendarDays, Repeat2, ShoppingBag } from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { UserEvent } from "../../../api/userEvents";
import type { LinkedCalendarRow } from "../../../domain/items/linkedCalendarRows";
import {
  isExpiresCalendarEvent,
  isPurchaseEffectiveCalendarEvent,
} from "../../../domain/timeline/userEventCalendarKind";
import { ItemFormIconChip } from "./ItemFormIconChip";
import { LinkedCalendarKindBadges } from "./LinkedCalendarKindBadges";

function oneOffChipIcon(event: UserEvent): ReactNode {
  if (isExpiresCalendarEvent(event)) {
    return <CalendarClock size={16} strokeWidth={1.75} aria-hidden />;
  }
  if (isPurchaseEffectiveCalendarEvent(event)) {
    return <ShoppingBag size={16} strokeWidth={1.75} aria-hidden />;
  }
  return <CalendarDays size={16} strokeWidth={1.75} aria-hidden />;
}

/** One linked calendar row rendered as an icon chip (one-off event or recurring series). */
export function LinkedCalendarIconChip({
  row,
  primaryExpiryId,
  markPrimaryExpiry,
  disabled,
  onEdit,
  onDeleteOneOff,
  onDeleteRecurring,
}: {
  row: LinkedCalendarRow;
  primaryExpiryId: string | null;
  markPrimaryExpiry: boolean;
  disabled: boolean;
  onEdit?: (event: UserEvent) => void;
  onDeleteOneOff?: (event: UserEvent) => void;
  onDeleteRecurring?: (seriesId: string, title: string) => void;
}) {
  const { t } = useTranslation("items");
  const editable = row.kind === "oneOff" && Boolean(onEdit);
  const icon =
    row.kind === "recurring" ? (
      <Repeat2 size={15} strokeWidth={1.75} aria-hidden />
    ) : (
      oneOffChipIcon(row.event)
    );

  const onDelete =
    row.kind === "oneOff" && onDeleteOneOff
      ? () => onDeleteOneOff(row.event)
      : row.kind === "recurring" && onDeleteRecurring
        ? () => onDeleteRecurring(row.seriesId, row.title)
        : undefined;

  const isPrimaryExpiry =
    row.kind === "oneOff" &&
    primaryExpiryId != null &&
    row.event.id === primaryExpiryId &&
    isExpiresCalendarEvent(row.event);

  return (
    <ItemFormIconChip
      interactive={editable}
      disabled={disabled}
      icon={icon}
      label={row.title}
      sublabel={row.detail}
      title={row.title}
      testId={
        isPrimaryExpiry
          ? "item-form-linked-expiry-row"
          : row.kind === "oneOff"
            ? "item-linked-calendar-row-one-off"
            : "item-linked-calendar-row-recurring"
      }
      labelTestId="item-linked-calendar-title"
      kindTestId={
        row.kind === "recurring"
          ? "item-linked-calendar-badge-recurring"
          : "item-linked-calendar-badge-one-off"
      }
      badge={
        row.kind === "oneOff" ? (
          <LinkedCalendarKindBadges
            event={row.event}
            primaryExpiryId={primaryExpiryId}
            markPrimaryExpiry={markPrimaryExpiry}
          />
        ) : undefined
      }
      onClick={
        editable && row.kind === "oneOff"
          ? () => onEdit?.(row.event)
          : undefined
      }
      onDelete={onDelete}
      deleteAriaLabel={t("deleteLinkedCalendarAria", { name: row.title })}
      deleteTestId={
        isPrimaryExpiry
          ? "item-form-linked-expiry-delete"
          : row.kind === "oneOff"
            ? "item-form-linked-calendar-delete-one-off"
            : "item-form-linked-calendar-delete-recurring"
      }
    />
  );
}
