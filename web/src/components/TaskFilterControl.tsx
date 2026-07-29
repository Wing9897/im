import { ListFilter } from "lucide-react";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { type TaskFilterOption } from "../domain/timeline/taskFilterOptions";
import { usePortaledChecklistMenu } from "../hooks/usePortaledChecklistMenu";
import { PillButton } from "./ui";

export type { TaskFilterOption };

interface TaskFilterControlProps {
  tasks: TaskFilterOption[];
  /** `null` = all tasks. */
  selectedTaskIds: string[] | null;
  onChange: (ids: string[] | null) => void;
  /** Accessible name prefix, e.g. "甘特／按任務". */
  ariaLabelPrefix?: string;
  /** `toolbar` matches page PillButton chrome; default stays compact board chrome. */
  variant?: "board" | "toolbar";
}

/**
 * Compact header control: icon opens a checklist popover for task multi-select.
 * `null` means “all tasks”; an empty list means no tasks selected.
 * Menu is portaled so frame overflow cannot clip it.
 * Shared by board widgets, timeline, and intelligence toolbars (lives outside `board/`).
 */
export function TaskFilterControl({
  tasks,
  selectedTaskIds,
  onChange,
  ariaLabelPrefix,
  variant = "board",
}: TaskFilterControlProps) {
  const { t } = useTranslation("common");
  const prefix = ariaLabelPrefix ?? t("board.shell.taskFilterPrefix");
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
  } = usePortaledChecklistMenu({ contentKey: tasks.length });
  const isToolbar = variant === "toolbar";

  const isFiltering = selectedTaskIds !== null;
  const checked = useMemo(() => {
    if (selectedTaskIds === null) {
      return new Set(tasks.map((t) => t.id));
    }
    return new Set(selectedTaskIds);
  }, [selectedTaskIds, tasks]);

  const toggleTask = (taskId: string) => {
    if (selectedTaskIds === null) {
      // Leaving "all": keep every other task checked.
      onChange(tasks.map((t) => t.id).filter((id) => id !== taskId));
      return;
    }
    const next = new Set(selectedTaskIds);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    if (next.size === tasks.length) {
      onChange(null);
      return;
    }
    onChange([...next]);
  };

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
            data-testid="board-task-filter-menu"
            style={menuPosition}
          >
            <div className="board-task-filter__menu-head">
              <span id={titleId}>{t("board.shell.taskFilterSelect")}</span>
              <span className="board-task-filter__menu-actions">
                <button
                  type="button"
                  className="board-task-filter__link"
                  data-testid="board-task-filter-select-all"
                  data-checklist-initial-focus={tasks.length === 0 ? "" : undefined}
                  onClick={() => onChange(null)}
                >
                  {t("board.shell.taskFilterSelectAll")}
                </button>
                <button
                  type="button"
                  className="board-task-filter__link"
                  data-testid="board-task-filter-clear"
                  onClick={() => onChange(tasks.length === 0 ? null : [])}
                >
                  {t("board.shell.taskFilterClear")}
                </button>
              </span>
            </div>
            {tasks.length === 0 ? (
              <p className="board-task-filter__empty">{t("board.shell.taskFilterEmpty")}</p>
            ) : (
              <ul className="board-task-filter__list">
                {tasks.map((task, index) => {
                  const isChecked = checked.has(task.id);
                  return (
                    <li key={task.id}>
                      <label className="board-task-filter__item">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          data-testid={`board-task-filter-${task.id}`}
                          data-checklist-initial-focus={index === 0 ? "" : undefined}
                          onChange={() => toggleTask(task.id)}
                        />
                        <span title={task.name}>{task.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )
      : null;

  const triggerProps = {
    ref: triggerRef,
    id: triggerId,
    type: "button" as const,
    title: t("board.shell.taskFilterSelect"),
    "aria-label": t("board.shell.taskFilterSelectAria", { prefix }),
    "aria-expanded": open,
    "aria-haspopup": "dialog" as const,
    "aria-controls": menuId,
    "aria-pressed": isFiltering,
    "data-testid": "board-task-filter",
    onClick: toggle,
  };

  const icon = (
    <ListFilter
      size={isToolbar ? 16 : 12}
      strokeWidth={isToolbar ? 2.5 : 2}
      aria-hidden="true"
    />
  );
  const badge = isFiltering ? (
    <span className="board-task-filter__badge" data-testid="board-task-filter-count">
      {selectedTaskIds.length}
    </span>
  ) : null;

  return (
    <div className="board-task-filter">
      {isToolbar ? (
        <PillButton
          {...triggerProps}
          active={open || isFiltering}
          className="relative"
        >
          {icon}
          {badge}
        </PillButton>
      ) : (
        <button
          {...triggerProps}
          className={
            isFiltering
              ? "board-widget-frame__btn board-widget-frame__btn--active"
              : "board-widget-frame__btn"
          }
        >
          {icon}
          {badge}
        </button>
      )}
      {menu}
    </div>
  );
}
