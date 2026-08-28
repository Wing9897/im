import { ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ModalDialog } from "./ModalDialog";
import { SourceFilterTree } from "./SourceFilterTree";
import {
  SubscribeFilterGroup,
  type SubscribeCalendarOption,
} from "./SubscribeFilterGroup";
import { Button, PillButton } from "./ui";
import type { SourceFilterOption } from "../domain/timeline/sourceFilterOptions";
import type { SourceFilterSelection } from "../domain/tasks/sourceFilterSelection";
import {
  useSourceFilterDialogState,
  type SourceFilterExpandTask,
  type WorksetFilterOption,
} from "./useSourceFilterDialogState";
import {
  sameSubscribeSelection,
  toggleSubscribeKey,
  type SubscribeAvailability,
  type SubscribedCalendarSelection,
} from "../domain/calendarShare/subscribedCalendars";

export type { WorksetFilterOption, SourceFilterExpandTask, SubscribeCalendarOption };

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
  subscribeCalendars?: SubscribeCalendarOption[];
  selectedSubscribeKeys?: SubscribedCalendarSelection;
  onChangeSubscribeKeys?: (next: SubscribedCalendarSelection) => void;
  subscribeAvailability?: SubscribeAvailability;
}

/**
 * Toolbar filter trigger + modal: hierarchical workset/task tree multi-select.
 * Timeline keeps a separate two-column dialog (`TimelineSourceFilterDialog`);
 * board may stack a compact subscribe section when catalog data exists.
 */
export function SourceFilterDialog({
  tasks,
  worksets = [],
  expandTasks,
  selection,
  onChange,
  ariaLabelPrefix,
  variant = "toolbar",
  subscribeCalendars = [],
  selectedSubscribeKeys = null,
  onChangeSubscribeKeys,
  subscribeAvailability = "ok",
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
  const catalogKeys = subscribeCalendars.map((row) => row.key);
  const subscribeCatalogReady = catalogKeys.length > 0;
  const [draftSubscribe, setDraftSubscribe] = useState<SubscribedCalendarSelection>(selectedSubscribeKeys);

  useEffect(() => {
    if (!state.open) return;
    setDraftSubscribe(selectedSubscribeKeys);
  }, [selectedSubscribeKeys, state.open]);

  const subscribeFiltering = selectedSubscribeKeys !== null && subscribeCatalogReady;
  const isFiltering = state.isFiltering || subscribeFiltering;
  const filterBadgeCount =
    (state.isFiltering ? state.filterBadgeCount : 0) +
    (selectedSubscribeKeys === null || !subscribeCatalogReady ? 0 : selectedSubscribeKeys.length);
  const subscribeDirty = !sameSubscribeSelection(draftSubscribe, selectedSubscribeKeys);
  const applyDisabled = state.applyDisabled && !subscribeDirty;

  const apply = () => {
    state.apply();
    if (subscribeDirty) {
      onChangeSubscribeKeys?.(draftSubscribe);
    }
  };

  return (
    <>
      <PillButton
        active={state.open || isFiltering}
        aria-expanded={state.open}
        aria-haspopup="dialog"
        aria-pressed={isFiltering}
        aria-label={t("board:shell.sourceFilterSelectAria", { prefix })}
        title={t("board:shell.sourceFilterSelect")}
        onClick={() => state.setOpen(true)}
        className={variant === "toolbar" ? "relative" : "relative size-8 p-0"}
        data-testid="board-source-filter"
      >
        <ListFilter size={16} strokeWidth={2.5} aria-hidden="true" />
        {isFiltering ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-semibold text-white"
            aria-hidden="true"
            data-testid="board-source-filter-count"
          >
            {filterBadgeCount}
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
              onClick={apply}
              disabled={applyDisabled}
              data-testid="source-filter-apply"
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
        {subscribeCatalogReady ? (
          <SubscribeFilterGroup
            variant="compact"
            calendars={subscribeCalendars}
            draft={draftSubscribe}
            query={state.query}
            onToggleKey={(key) =>
              setDraftSubscribe(toggleSubscribeKey(draftSubscribe, key, catalogKeys))
            }
            onSelectAll={() => setDraftSubscribe(null)}
            onClearAll={() => setDraftSubscribe([])}
            availability={subscribeAvailability}
          />
        ) : null}
      </ModalDialog>
    </>
  );
}
