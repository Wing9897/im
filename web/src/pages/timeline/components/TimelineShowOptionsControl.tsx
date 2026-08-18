import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";
import { Eye } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { PillButton } from "../../../components/ui";
import { useAnchoredMenu } from "../../../hooks/useAnchoredMenu";
import { spacing } from "../../../styles/tokens";
import type { MonthDateRevealChrome } from "../calendar/useMonthDateReveal";

type TimelineShowOptionsControlProps = {
  showDismissed: boolean;
  setShowDismissed: (value: boolean) => void;
  showOngoing: boolean;
  setShowOngoing: (value: boolean) => void;
  showEnding: boolean;
  setShowEnding: (value: boolean) => void;
  /** Month calendar: hover previews dates; 篩選 checkbox persists. */
  monthDateReveal?: MonthDateRevealChrome | null;
};

const FOCUSABLE_SELECTOR = [
  "[data-checklist-initial-focus]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Toolbar visibility checklist (removed / ongoing / ending).
 * Eye icon + 「篩選」menu. Month calendar also uses this same PillButton for
 * date-reveal hover preview; persist is a fourth checkbox (no extra 「顯示」 control).
 * Portaled like SourceFilterDialog so toolbar overflow cannot clip the menu.
 * Placement / outside dismiss: {@link useAnchoredMenu}.
 */
export function TimelineShowOptionsControl({
  showDismissed,
  setShowDismissed,
  showOngoing,
  setShowOngoing,
  showEnding,
  setShowEnding,
  monthDateReveal = null,
}: TimelineShowOptionsControlProps) {
  const { t } = useTranslation("timeline");
  const reactId = useId();
  const idSuffix = reactId.replace(/:/g, "");
  const triggerId = `portaled-checklist-trigger-${idSuffix}`;
  const menuId = `portaled-checklist-menu-${idSuffix}`;
  const titleId = `portaled-checklist-title-${idSuffix}`;
  const focusedForCurrentOpen = useRef(false);

  const { open, toggle, menuPos, anchorRef, menuRef, rootRef } = useAnchoredMenu({
    align: "auto",
    gap: spacing.xs,
    edge: 8,
    fallbackMenuWidth: 200,
    flip: true,
    dismissPointerEvent: "pointerdown",
    restoreFocusOnEscape: true,
  });

  const onRevealEnter = monthDateReveal?.onPointerEnter;
  const onRevealLeave = monthDateReveal?.onPointerLeave;

  useEffect(() => {
    if (!onRevealEnter || !onRevealLeave) return;
    const el = anchorRef.current;
    if (!el) return;
    el.addEventListener("pointerenter", onRevealEnter);
    el.addEventListener("pointerleave", onRevealLeave);
    return () => {
      el.removeEventListener("pointerenter", onRevealEnter);
      el.removeEventListener("pointerleave", onRevealLeave);
    };
  }, [anchorRef, onRevealEnter, onRevealLeave]);

  useEffect(() => {
    if (!open || !menuPos || !menuRef.current || focusedForCurrentOpen.current) {
      return;
    }
    const initialFocus = menuRef.current.querySelector<HTMLElement>(
      "[data-checklist-initial-focus]",
    );
    (initialFocus ?? menuRef.current).focus();
    focusedForCurrentOpen.current = true;
  }, [menuPos, menuRef, open]);

  useEffect(() => {
    if (!open) {
      focusedForCurrentOpen.current = false;
    }
  }, [open]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !menuRef.current) {
      return;
    }
    const focusable = Array.from(
      menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      menuRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === menuRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const isFiltering = !showDismissed || !showOngoing || !showEnding;
  const datesPersisted = Boolean(monthDateReveal?.persisted);
  const chromeActive = open || isFiltering || datesPersisted;

  const options = [
    {
      id: "dismissed" as const,
      checked: showDismissed,
      onChange: setShowDismissed,
      label: t("filter.showDismissed"),
      help: t("filter.showDismissedHelp"),
      testId: "timeline-show-options-dismissed",
    },
    {
      id: "ongoing" as const,
      checked: showOngoing,
      onChange: setShowOngoing,
      label: t("filter.showOngoing"),
      help: t("filter.showOngoingHelp"),
      testId: "timeline-show-options-ongoing",
    },
    {
      id: "ending" as const,
      checked: showEnding,
      onChange: setShowEnding,
      label: t("filter.showEnding"),
      help: t("filter.showEndingHelp"),
      testId: "timeline-show-options-ending",
    },
    ...(monthDateReveal
      ? [
          {
            id: "dates" as const,
            checked: monthDateReveal.persisted,
            onChange: monthDateReveal.onPersistedChange,
            label: t("filter.showDates"),
            help: t("filter.showDatesHelp"),
            testId: "timeline-show-options-dates",
          },
        ]
      : []),
  ];

  const menuTitle = t("filter.showOptions");

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef as RefObject<HTMLDivElement>}
            id={menuId}
            className="board-source-filter__menu board-source-filter__menu--portal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            data-testid="timeline-show-options-menu"
            style={
              menuPos
                ? { top: menuPos.top, left: menuPos.left }
                : { top: -9999, left: -9999, visibility: "hidden" }
            }
          >
            <div className="board-source-filter__menu-head">
              <span id={titleId}>{menuTitle}</span>
            </div>
            <ul className="board-source-filter__list">
              {options.map((option, index) => {
                const helpId = `${menuId}-${option.id}-help`;
                return (
                  <li key={option.id}>
                    <label className="board-source-filter__item" title={option.help}>
                      <input
                        type="checkbox"
                        checked={option.checked}
                        data-testid={option.testId}
                        data-checklist-initial-focus={index === 0 ? "" : undefined}
                        aria-describedby={helpId}
                        onChange={() => option.onChange(!option.checked)}
                      />
                      <span>{option.label}</span>
                    </label>
                    <span id={helpId} className="sr-only">
                      {option.help}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef as RefObject<HTMLDivElement>} className="board-source-filter">
      <PillButton
        ref={anchorRef as RefObject<HTMLButtonElement>}
        id={triggerId}
        type="button"
        active={chromeActive}
        aria-pressed={isFiltering}
        title={menuTitle}
        aria-label={menuTitle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={menuId}
        data-testid="timeline-show-options"
        data-dates-persisted={monthDateReveal ? (datesPersisted ? "true" : "false") : undefined}
        onClick={toggle}
      >
        <Eye size={16} strokeWidth={2.5} aria-hidden="true" />
      </PillButton>
      {menu}
    </div>
  );
}
