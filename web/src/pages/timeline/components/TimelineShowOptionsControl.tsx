import { ListFilter } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { PillButton } from "../../../components/ui";
import { usePortaledChecklistMenu } from "../../../hooks/usePortaledChecklistMenu";

type TimelineShowOptionsControlProps = {
  showDismissed: boolean;
  setShowDismissed: (value: boolean) => void;
  showOngoing: boolean;
  setShowOngoing: (value: boolean) => void;
  showEnding: boolean;
  setShowEnding: (value: boolean) => void;
};

/**
 * Toolbar 「显示」checklist (removed / ongoing / ending).
 * Portaled like TaskFilterControl so toolbar overflow cannot clip the menu.
 */
export function TimelineShowOptionsControl({
  showDismissed,
  setShowDismissed,
  showOngoing,
  setShowOngoing,
  showEnding,
  setShowEnding,
}: TimelineShowOptionsControlProps) {
  const { t } = useTranslation("timeline");
  const {
    open,
    toggle,
    triggerRef,
    menuRef,
    menuPosition,
    triggerId,
    menuId,
    titleId,
    onMenuKeyDown,
  } = usePortaledChecklistMenu();

  const isFiltering = !showDismissed || !showOngoing || !showEnding;
  const chromeActive = open || isFiltering;

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
  ];

  const menuTitle = t("filter.showOptions");

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="board-task-filter__menu board-task-filter__menu--portal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            data-testid="timeline-show-options-menu"
            style={menuPosition}
          >
            <div className="board-task-filter__menu-head">
              <span id={titleId}>{menuTitle}</span>
            </div>
            <ul className="board-task-filter__list">
              {options.map((option, index) => {
                const helpId = `${menuId}-${option.id}-help`;
                return (
                  <li key={option.id}>
                    <label className="board-task-filter__item" title={option.help}>
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
    <div className="board-task-filter">
      <PillButton
        ref={triggerRef}
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
        onClick={toggle}
        className="relative"
      >
        <ListFilter size={16} strokeWidth={2.5} aria-hidden="true" />
      </PillButton>
      {menu}
    </div>
  );
}
