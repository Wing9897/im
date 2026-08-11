import { CalendarClock, CalendarDays, CalendarPlus, Repeat2, ShoppingBag } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { UserEvent } from "../../../api/userEvents";
import { Badge } from "../../../components/ui";
import {
  LINKED_CALENDAR_QUICK_KINDS,
  linkedCalendarModeLabelKey,
  type LinkedCalendarQuickKind,
} from "../../../domain/items/linkedCalendarQuickCreate";
import type { LinkedCalendarRow } from "../../../domain/items/linkedCalendarRows";
import {
  isExpiresCalendarEvent,
  isPurchaseEffectiveCalendarEvent,
} from "../../../domain/timeline/userEventCalendarKind";
import { useAnchoredMenu } from "../../../hooks/useAnchoredMenu";
import { spacing } from "../../../styles/tokens";
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
  /** Quick add presets → same create dialog. */
  onQuickAdd?: (kind: LinkedCalendarQuickKind) => void;
  /** Edit a one-off linked user event (same dialog as Timeline). */
  onEditOneOff?: (event: UserEvent) => void;
  /** Soft-delete / dismiss a one-off linked user event (incl. expiry). */
  onDeleteOneOff?: (event: UserEvent) => void;
  /** Soft-delete a recurring analysis task linked to this item. */
  onDeleteRecurring?: (taskId: string, title: string) => void;
  /** Notify parent when primary linked expiry changes. */
  onActiveExpiryChange?: (event: UserEvent | null) => void;
};

function quickKindIcon(kind: LinkedCalendarQuickKind) {
  switch (kind) {
    case "expires":
      return <CalendarClock size={16} strokeWidth={1.75} aria-hidden />;
    case "purchaseEffective":
      return <ShoppingBag size={16} strokeWidth={1.75} aria-hidden />;
    case "other":
      return <CalendarDays size={16} strokeWidth={1.75} aria-hidden />;
  }
}

function oneOffChipIcon(event: UserEvent): ReactNode {
  if (isExpiresCalendarEvent(event)) {
    return <CalendarClock size={16} strokeWidth={1.75} aria-hidden />;
  }
  if (isPurchaseEffectiveCalendarEvent(event)) {
    return <ShoppingBag size={16} strokeWidth={1.75} aria-hidden />;
  }
  return <CalendarDays size={16} strokeWidth={1.75} aria-hidden />;
}

function LinkedCalendarKindBadges({
  event,
  primaryExpiryId,
  markPrimaryExpiry,
}: {
  event: UserEvent;
  primaryExpiryId: string | null;
  markPrimaryExpiry: boolean;
}) {
  const { t } = useTranslation("items");
  const badges: ReactNode[] = [];

  if (isExpiresCalendarEvent(event)) {
    badges.push(
      <Badge
        key="expires"
        tone="warning"
        className="max-w-full truncate normal-case tracking-normal"
        data-testid="item-linked-calendar-badge-expires"
      >
        {t("linkedCalendarBadge.expires")}
      </Badge>,
    );
    if (markPrimaryExpiry && primaryExpiryId != null && event.id === primaryExpiryId) {
      badges.push(
        <Badge
          key="primary"
          tone="accent"
          className="max-w-full truncate normal-case tracking-normal"
          data-testid="item-linked-calendar-badge-primary"
        >
          {t("linkedCalendarBadge.primary")}
        </Badge>,
      );
    }
  }

  if (isPurchaseEffectiveCalendarEvent(event)) {
    badges.push(
      <Badge
        key="purchase"
        tone="info"
        className="max-w-full truncate normal-case tracking-normal"
        data-testid="item-linked-calendar-badge-purchase-effective"
      >
        {t("linkedCalendarBadge.purchaseEffective")}
      </Badge>,
    );
    const direction = event.direction === "income" ? "income" : "expense";
    badges.push(
      <Badge
        key="finance"
        tone={direction === "income" ? "success" : "neutral"}
        className="max-w-full truncate normal-case tracking-normal"
        data-testid={`item-linked-calendar-badge-${direction}`}
      >
        {t(`finance.direction.${direction}`)}
      </Badge>,
    );
  }

  if (badges.length === 0) return null;
  return <span className="flex max-w-full flex-wrap justify-center gap-0.5">{badges}</span>;
}

function LinkedCalendarIconChip({
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
  onDeleteRecurring?: (taskId: string, title: string) => void;
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
        ? () => onDeleteRecurring(row.taskId, row.title)
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

/** One dashed add chip → compact mode menu → existing create dialog. */
function LinkedCalendarAddControl({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick?: (kind: LinkedCalendarQuickKind) => void;
}) {
  const { t } = useTranslation("items");
  const reactId = useId();
  const menuId = `item-linked-calendar-mode-menu-${reactId.replace(/:/g, "")}`;
  const { open, toggle, close, menuPos, menuRef, rootRef } = useAnchoredMenu({
    enabled: !disabled,
    align: "start",
    gap: spacing.xs,
    edge: 8,
    fallbackMenuWidth: 180,
    flip: true,
    dismissPointerEvent: "mousedown",
    restoreFocusOnEscape: true,
  });

  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);

  const pick = (kind: LinkedCalendarQuickKind) => {
    close();
    onPick?.(kind);
  };

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={menuRef as RefObject<HTMLUListElement>}
            id={menuId}
            role="menu"
            aria-label={t("linkedCalendarModeMenuAria")}
            data-testid="item-form-linked-calendar-mode-menu"
            className="im-menu-surface fixed z-[3000] m-0 min-w-[11rem] list-none rounded-md border border-surface-border bg-surface-card p-1 shadow-md"
            style={
              menuPos
                ? { top: menuPos.top, left: menuPos.left }
                : { top: -9999, left: -9999, visibility: "hidden" }
            }
          >
            {LINKED_CALENDAR_QUICK_KINDS.map((kind) => (
              <li key={kind} role="none">
                <button
                  type="button"
                  role="menuitem"
                  data-testid={`item-form-linked-calendar-mode-${kind}`}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-sm py-1.5 text-left text-caption font-medium leading-snug text-text-primary outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-card))] focus-visible:bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-card))]"
                  onClick={() => pick(kind)}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-secondary">
                    {quickKindIcon(kind)}
                  </span>
                  <span className="min-w-0 truncate">{t(linkedCalendarModeLabelKey(kind))}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef as RefObject<HTMLDivElement>} className="relative">
      <ItemFormDashedAddChip
        disabled={disabled}
        icon={<CalendarPlus size={16} strokeWidth={1.75} aria-hidden />}
        label={t("addLinkedCalendar")}
        ariaLabel={t("addLinkedCalendarAria")}
        ariaHasPopup="menu"
        ariaExpanded={open}
        ariaControls={menuId}
        testId="item-form-add-linked-calendar"
        onClick={() => {
          if (!disabled) toggle();
        }}
      />
      {menu}
    </div>
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
    expiresCount,
    loading,
    loadError,
    createLocked,
  } = useLinkedCalendarRows({
    itemId,
    itemExpiresAt,
    remindBeforeDays,
    refreshKey,
    onActiveExpiryChange,
  });

  const showGrid = createLocked || (!loading && !loadError);
  const showEmptyHint = showGrid && !createLocked && !loading && !loadError && rows.length === 0;
  const chipsDisabled = disabled || !canAdd;
  /** Create mode without a title: one short line; chips stay disabled. Auto-save needs no essay. */
  const showTitleRequiredHint = createLocked && !canAdd;
  const markPrimaryExpiry = expiresCount > 1;
  const primaryExpiryId = activeExpiry?.id ?? null;

  return (
    <ItemFormCvSection
      title={t("sectionLinkedCalendars")}
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
            {!createLocked
              ? rows.map((row) => (
                  <LinkedCalendarIconChip
                    key={row.id}
                    row={row}
                    primaryExpiryId={primaryExpiryId}
                    markPrimaryExpiry={markPrimaryExpiry}
                    disabled={chipsDisabled}
                    onEdit={onEditOneOff}
                    onDeleteOneOff={onDeleteOneOff}
                    onDeleteRecurring={onDeleteRecurring}
                  />
                ))
              : null}

            {onQuickAdd || createLocked ? (
              <LinkedCalendarAddControl disabled={chipsDisabled} onPick={onQuickAdd} />
            ) : null}
          </div>
        ) : null}

        {showTitleRequiredHint ? (
          <p
            className={itemFormSecondaryHintClass}
            data-testid="item-form-linked-calendars-create-hint"
          >
            {t("linkedCalendarsTitleRequiredHint")}
          </p>
        ) : null}

        {showEmptyHint ? (
          <p className={itemFormEmptyHintClass} data-testid="item-form-linked-calendars-empty">
            {t("linkedCalendarsEmpty")}
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
