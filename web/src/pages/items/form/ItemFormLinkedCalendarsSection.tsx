import { CalendarClock, CalendarDays, Repeat2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { UserEvent } from "../../../api/userEvents";
import { Badge } from "../../../components/ui";
import {
  LINKED_CALENDAR_QUICK_KINDS,
  linkedCalendarQuickLabelKey,
  type LinkedCalendarQuickKind,
} from "../../../domain/items/linkedCalendarQuickCreate";
import {
  expiryToneBadgeTone,
  type ExpiryTone,
} from "../../../domain/items/itemAttributes";
import {
  itemCardExpirySubtitle,
  itemExpiryBadgeLabel,
  type ItemCardExpiry,
} from "../../../domain/items/itemCardExpiry";
import type { LinkedCalendarRow } from "../../../domain/items/linkedCalendarRows";
import { ItemFormCvSection } from "./ItemFormCvSection";
import { ItemFormDashedAddChip } from "./ItemFormDashedAddChip";
import {
  itemFormEmptyHintClass,
  itemFormSecondaryHintClass,
  itemFormSectionBodyClass,
} from "./itemFormClasses";
import {
  ITEM_FORM_CHIP_GRID_CLASS,
  ItemFormIconChip,
} from "./ItemFormIconChip";
import { useLinkedCalendarRows } from "./useLinkedCalendarRows";

type Props = {
  /** Parent item id; null in create mode (section visible but add disabled). */
  itemId: string | null;
  /** Denormalized expiry cache from the item row (may lag until server reconcile). */
  itemExpiresAt?: string | null;
  remindBeforeDays?: number | null;
  /** Bump to reload after an in-place create/edit/delete. */
  refreshKey?: number;
  disabled?: boolean;
  /** When false in create mode, add chips stay disabled (e.g. missing title). */
  canAdd?: boolean;
  /** Category preset for remind-before-days prefill on linked calendar create. */
  categoryDefaultRemindBeforeDays?: number | null;
  onAdd: () => void;
  /** Quick title presets → same create dialog as onAdd. */
  onQuickAdd?: (kind: LinkedCalendarQuickKind) => void;
  /** Edit a one-off linked user event (same dialog as Timeline). */
  onEditOneOff?: (event: UserEvent) => void;
  /** Soft-delete / dismiss a one-off linked user event (incl. expiry). */
  onDeleteOneOff?: (event: UserEvent) => void;
  /** Soft-delete a recurring analysis task linked to this item. */
  onDeleteRecurring?: (taskId: string, title: string) => void;
  /** Notify parent when active linked expiry changes (for duplicate guard). */
  onActiveExpiryChange?: (event: UserEvent | null) => void;
};

function LinkedExpiryIconChip({
  event,
  expiry,
  disabled,
  onEdit,
  onDelete,
}: {
  event: UserEvent;
  expiry: ItemCardExpiry;
  disabled: boolean;
  onEdit?: (event: UserEvent) => void;
  onDelete?: (event: UserEvent) => void;
}) {
  const { t } = useTranslation("items");
  const badge = itemExpiryBadgeLabel(expiry, t);
  const subtitle = itemCardExpirySubtitle(expiry, t);
  const tone: ExpiryTone = expiry.tone;

  return (
    <ItemFormIconChip
      variant="expiry"
      interactive
      disabled={disabled}
      icon={<CalendarClock size={16} strokeWidth={1.75} aria-hidden />}
      label={t("quickLinkedCalendar.expires")}
      sublabel={subtitle}
      title={t("linkedExpiryFeatureTitle")}
      testId="item-form-linked-expiry-row"
      labelTestId="item-linked-calendar-title"
      onClick={() => onEdit?.(event)}
      onDelete={onDelete ? () => onDelete(event) : undefined}
      deleteAriaLabel={t("deleteLinkedCalendarAria", {
        name: t("quickLinkedCalendar.expires"),
      })}
      deleteTestId="item-form-linked-expiry-delete"
      badge={
        badge ? (
          <Badge
            tone={expiryToneBadgeTone(tone)}
            className="max-w-full truncate normal-case tracking-normal"
            data-testid="item-form-expiry-badge-preview"
          >
            {badge}
          </Badge>
        ) : undefined
      }
    />
  );
}

function LinkedCalendarIconChip({
  row,
  disabled,
  onEdit,
  onDeleteOneOff,
  onDeleteRecurring,
}: {
  row: LinkedCalendarRow;
  disabled: boolean;
  onEdit?: (event: UserEvent) => void;
  onDeleteOneOff?: (event: UserEvent) => void;
  onDeleteRecurring?: (taskId: string, title: string) => void;
}) {
  const { t } = useTranslation("items");
  const editable = row.kind === "oneOff" && Boolean(onEdit);
  const icon =
    row.kind === "recurring" ? (
      <Repeat2 size={15} strokeWidth={1.75} aria-hidden />
    ) : (
      <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
    );

  const onDelete =
    row.kind === "oneOff" && onDeleteOneOff
      ? () => onDeleteOneOff(row.event)
      : row.kind === "recurring" && onDeleteRecurring
        ? () => onDeleteRecurring(row.taskId, row.title)
        : undefined;

  return (
    <ItemFormIconChip
      interactive={editable}
      disabled={disabled}
      icon={icon}
      label={row.title}
      sublabel={row.detail}
      title={row.title}
      testId={
        row.kind === "oneOff"
          ? "item-linked-calendar-row-one-off"
          : "item-linked-calendar-row-recurring"
      }
      labelTestId="item-linked-calendar-title"
      kindTestId={
        row.kind === "recurring"
          ? "item-linked-calendar-badge-recurring"
          : "item-linked-calendar-badge-one-off"
      }
      onClick={
        editable && row.kind === "oneOff"
          ? () => onEdit?.(row.event)
          : undefined
      }
      onDelete={onDelete}
      deleteAriaLabel={t("deleteLinkedCalendarAria", { name: row.title })}
      deleteTestId={
        row.kind === "oneOff"
          ? "item-form-linked-calendar-delete-one-off"
          : "item-form-linked-calendar-delete-recurring"
      }
    />
  );
}

/** Lists one-off + recurring calendars linked to an inventory item + CTA to add. */
export function ItemFormLinkedCalendarsSection({
  itemId,
  itemExpiresAt = null,
  remindBeforeDays = null,
  refreshKey = 0,
  disabled = false,
  canAdd = true,
  categoryDefaultRemindBeforeDays = null,
  onAdd,
  onQuickAdd,
  onEditOneOff,
  onDeleteOneOff,
  onDeleteRecurring,
  onActiveExpiryChange,
}: Props) {
  const { t } = useTranslation("items");
  const {
    rows,
    activeExpiry,
    expiryPreview,
    loading,
    loadError,
    createLocked,
    hasLinkedExpiry,
  } = useLinkedCalendarRows({
    itemId,
    itemExpiresAt,
    remindBeforeDays,
    refreshKey,
    onActiveExpiryChange,
  });

  const showGrid = createLocked || (!loading && !loadError);
  const showEmptyHint = showGrid && !createLocked && rows.length === 0 && hasLinkedExpiry;
  const chipsDisabled = disabled || !canAdd;
  const showCreateHint = createLocked;

  return (
    <ItemFormCvSection
      title={t("sectionLinkedCalendars")}
      hint={createLocked ? t("sectionLinkedCalendarsCreateHint") : t("sectionLinkedCalendarsHint")}
      testId="item-form-linked-calendars"
      ariaLabel={t("sectionLinkedCalendars")}
    >
      <div className={itemFormSectionBodyClass}>
        {!createLocked && loading ? (
          <p className={itemFormEmptyHintClass}>{t("linkedCalendarsLoading")}</p>
        ) : null}

        {!createLocked && loadError ? (
          <p className="m-0 text-caption leading-normal text-error" role="alert">
            {t("linkedCalendarsLoadFailed")}
          </p>
        ) : null}

        {showGrid && (createLocked || (!loading && !loadError)) ? (
          <div
            className={ITEM_FORM_CHIP_GRID_CLASS}
            data-testid="item-form-linked-calendar-grid"
            aria-label={t("linkedCalendarGridAria")}
          >
            {!createLocked && hasLinkedExpiry && activeExpiry ? (
              <LinkedExpiryIconChip
                event={activeExpiry}
                expiry={expiryPreview}
                disabled={chipsDisabled}
                onEdit={onEditOneOff}
                onDelete={onDeleteOneOff}
              />
            ) : onQuickAdd || createLocked ? (
              LINKED_CALENDAR_QUICK_KINDS.map((kind) => (
                <ItemFormDashedAddChip
                  key={kind}
                  variant="expiry"
                  disabled={chipsDisabled}
                  icon={<CalendarClock size={16} strokeWidth={1.75} aria-hidden />}
                  label={t(linkedCalendarQuickLabelKey(kind))}
                  ariaLabel={t("quickLinkedCalendarAddAria", {
                    name: t(linkedCalendarQuickLabelKey(kind)),
                  })}
                  testId={`item-form-quick-linked-calendar-${kind}`}
                  onClick={() => onQuickAdd?.(kind)}
                />
              ))
            ) : null}

            {!createLocked
              ? rows.map((row) => (
                  <LinkedCalendarIconChip
                    key={row.id}
                    row={row}
                    disabled={chipsDisabled}
                    onEdit={onEditOneOff}
                    onDeleteOneOff={onDeleteOneOff}
                    onDeleteRecurring={onDeleteRecurring}
                  />
                ))
              : null}

            <ItemFormDashedAddChip
              disabled={chipsDisabled}
              icon={<CalendarDays size={16} strokeWidth={1.75} aria-hidden />}
              label={t("addLinkedCalendar")}
              ariaLabel={t("addLinkedCalendarAria")}
              testId="item-form-add-linked-calendar"
              onClick={onAdd}
            />
          </div>
        ) : null}

        {showCreateHint ? (
          <p
            className={itemFormSecondaryHintClass}
            data-testid="item-form-linked-calendars-create-hint"
          >
            {canAdd ? t("linkedCalendarsAutoSaveHint") : t("linkedCalendarsTitleRequiredHint")}
          </p>
        ) : null}

        {showEmptyHint ? (
          <p className={itemFormEmptyHintClass} data-testid="item-form-linked-calendars-empty">
            {t("linkedCalendarsEmpty")}
          </p>
        ) : null}

        {!createLocked && hasLinkedExpiry && activeExpiry ? (
          <p
            className={itemFormSecondaryHintClass}
            data-testid="item-form-linked-expiry-callout"
          >
            {t("linkedExpiryBadgeCalloutShort")}
          </p>
        ) : null}

        {!createLocked && !hasLinkedExpiry && !loading ? (
          <p className={itemFormSecondaryHintClass} data-testid="item-form-linked-expiry-panel">
            {t("linkedExpiryFeatureHint")}
          </p>
        ) : null}

        {categoryDefaultRemindBeforeDays != null && categoryDefaultRemindBeforeDays > 0 ? (
          <p
            className={itemFormSecondaryHintClass}
            data-testid="item-form-linked-remind-prefill-hint"
          >
            {t("linkedCalendarRemindPrefillHint", { days: categoryDefaultRemindBeforeDays })}
          </p>
        ) : null}
      </div>
    </ItemFormCvSection>
  );
}
