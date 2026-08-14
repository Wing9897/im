import { ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ModalDialog } from "./ModalDialog";
import { SourceFilterTree } from "./SourceFilterTree";
import { Button, PillButton } from "./ui";
import type { SourceFilterOption } from "../domain/timeline/sourceFilterOptions";
import type { SourceFilterSelection } from "../domain/tasks/sourceFilterSelection";
import {
  useSourceFilterDialogState,
  type SourceFilterExpandTask,
  type WorksetFilterOption,
} from "./useSourceFilterDialogState";

export type { WorksetFilterOption, SourceFilterExpandTask };

interface SourceFilterDialogProps {
  tasks: SourceFilterOption[];
  worksets?: WorksetFilterOption[];
  /** Tasks used to place children under worksets (may include all catalog tasks). */
  expandTasks?: SourceFilterExpandTask[];
  /** `null` = all sources. */
  selection: SourceFilterSelection;
  onChange: (next: SourceFilterSelection) => void;
  ariaLabelPrefix?: string;
  variant?: "board" | "toolbar";
}

/**
 * Toolbar filter trigger + modal: hierarchical workset/task tree multi-select.
 */
export function SourceFilterDialog({
  tasks,
  worksets = [],
  expandTasks,
  selection,
  onChange,
  ariaLabelPrefix,
  variant = "toolbar",
}: SourceFilterDialogProps) {
  const { t } = useTranslation("common");
  const prefix = ariaLabelPrefix ?? t("board:shell.sourceFilterPrefix");
  const state = useSourceFilterDialogState({
    tasks,
    worksets,
    expandTasks,
    selection,
    onChange,
  });

  return (
    <>
      <PillButton
        active={state.open || state.isFiltering}
        aria-expanded={state.open}
        aria-haspopup="dialog"
        aria-pressed={state.isFiltering}
        aria-label={t("board:shell.sourceFilterSelectAria", { prefix })}
        title={t("board:shell.sourceFilterSelect")}
        onClick={() => state.setOpen(true)}
        className={variant === "toolbar" ? "relative" : "relative size-8 p-0"}
        data-testid="board-source-filter"
      >
        <ListFilter size={16} strokeWidth={2.5} aria-hidden="true" />
        {state.isFiltering ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-semibold text-white"
            aria-hidden="true"
            data-testid="board-source-filter-count"
          >
            {state.filterBadgeCount}
          </span>
        ) : null}
      </PillButton>

      <ModalDialog
        open={state.open}
        title={t("workset:filterTitle")}
        closeAriaLabel={t("dialog.close")}
        onClose={() => state.setOpen(false)}
        testId="source-filter-dialog"
        size="wide"
        footerJustify="space-between"
        footer={
          <>
            <div className="flex gap-sm">
              <Button type="button" variant="secondary" onClick={state.selectAll}>
                {t("workset:selectAll")}
              </Button>
              <Button type="button" variant="secondary" onClick={state.clearAll}>
                {t("workset:clearAll")}
              </Button>
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={state.apply}
              disabled={state.applyDisabled}
            >
              {t("workset:apply")}
            </Button>
          </>
        }
      >
        <SourceFilterTree
          rows={state.visibleRows}
          query={state.query}
          onQueryChange={state.setQuery}
          expanded={state.expanded}
          onToggleExpanded={state.toggleExpanded}
          checkedTasks={state.checkedTasks}
          checkedWorksets={state.checkedWorksets}
          allSourcesSelected={state.allSourcesSelected}
          onToggleTask={state.toggleTask}
          onToggleWorkset={state.toggleWorkset}
        />
      </ModalDialog>
    </>
  );
}
