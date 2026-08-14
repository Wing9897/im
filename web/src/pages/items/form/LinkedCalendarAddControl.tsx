import { CalendarClock, CalendarDays, CalendarPlus, ShoppingBag } from "lucide-react";
import { type RefObject, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  LINKED_CALENDAR_QUICK_KINDS,
  linkedCalendarModeLabelKey,
  type LinkedCalendarQuickKind,
} from "../../../domain/items/linkedCalendarQuickCreate";
import { useAnchoredMenu } from "../../../hooks/useAnchoredMenu";
import { spacing } from "../../../styles/tokens";
import { ItemFormDashedAddChip } from "./ItemFormDashedAddChip";

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

/** One dashed add chip → compact mode menu → existing create dialog. */
export function LinkedCalendarAddControl({
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
            className="im-menu-surface fixed z-[3000] m-0 min-w-[11rem] list-none rounded-md border border-surface-border p-1 shadow-md"
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
