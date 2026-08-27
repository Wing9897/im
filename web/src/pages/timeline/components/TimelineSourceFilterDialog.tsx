/**
 * Timeline source filter: local worksets (left) and subscribed calendars (right).
 * Board / intelligence / gantt keep SourceFilterDialog (tree only).
 */

import { Layers, ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ModalDialog } from "../../../components/ModalDialog";
import {
  SourceFilterColumnActions,
  SourceFilterSectionHeading,
  SourceFilterTree,
} from "../../../components/SourceFilterTree";
import {
  SubscribeFilterGroup,
  type SubscribeCalendarOption,
} from "../../../components/SubscribeFilterGroup";
import { Button, PillButton, TextField } from "../../../components/ui";
import { useSourceFilterDialogState } from "../../../components/useSourceFilterDialogState";
import type { SourceFilterOption } from "../../../domain/timeline/sourceFilterOptions";
import type { SourceFilterSelection } from "../../../domain/tasks/sourceFilterSelection";
import type { SourceFilterExpandTask, WorksetFilterOption } from "../../../components/SourceFilterDialog";
import {
  sameSubscribeSelection,
  toggleSubscribeKey,
  type SubscribeAvailability,
  type SubscribedCalendarSelection,
} from "../../../domain/calendarShare/subscribedCalendars";

export type { SubscribeCalendarOption };

type TimelineSourceFilterDialogProps = {
  tasks: SourceFilterOption[];
  worksets?: WorksetFilterOption[];
  expandTasks?: SourceFilterExpandTask[];
  selection: SourceFilterSelection;
  onChange: (next: SourceFilterSelection) => void;
  ariaLabelPrefix?: string;
  variant?: "board" | "toolbar";
  subscribeCalendars?: SubscribeCalendarOption[];
  selectedSubscribeKeys?: SubscribedCalendarSelection;
  onChangeSubscribeKeys?: (next: SubscribedCalendarSelection) => void;
  subscribeAvailability?: SubscribeAvailability;
};

export function TimelineSourceFilterDialog({
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
}: TimelineSourceFilterDialogProps) {
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
  const [draftSubscribe, setDraftSubscribe] = useState<SubscribedCalendarSelection>(selectedSubscribeKeys);

  useEffect(() => {
    if (!state.open) return;
    setDraftSubscribe(selectedSubscribeKeys);
  }, [selectedSubscribeKeys, state.open]);

  const subscribeCatalogReady = catalogKeys.length > 0;
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
        size="tall"
        bodyClassName="flex min-h-0 flex-col overflow-hidden"
        footerJustify="flex-end"
        footer={
          <Button
            type="button"
            variant="primary"
            onClick={apply}
            disabled={applyDisabled}
            data-testid="source-filter-apply"
          >
            {t("workset:apply")}
          </Button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-md overflow-hidden">
          <p className="m-0 shrink-0 text-caption leading-relaxed text-text-secondary">
            {t("workset:filterHint")}
          </p>
          <TextField
            type="search"
            value={state.query}
            onChange={(e) => state.setQuery(e.target.value)}
            placeholder={t("workset:filterSearchPlaceholder")}
            aria-label={t("workset:filterSearchPlaceholder")}
            data-testid="source-filter-dialog-search"
            className="im-surface-inset shrink-0 border-[color-mix(in_srgb,var(--text-primary)_28%,var(--surface-border))] placeholder:text-text-secondary/80"
          />
          <div
            className="flex min-h-0 flex-1 flex-col gap-md overflow-hidden sm:flex-row sm:gap-lg"
            data-testid="timeline-filter-columns"
          >
            <section
              className="flex min-h-0 min-w-0 flex-1 flex-col gap-sm overflow-hidden"
              data-testid="timeline-filter-local"
              aria-label={t("subscriptions:filter.local")}
            >
              <SourceFilterSectionHeading
                icon={Layers}
                label={t("subscriptions:filter.local")}
                testId="timeline-filter-section-local"
              />
              <SourceFilterColumnActions
                selectLabel={t("subscriptions:filter.selectAll")}
                clearLabel={t("subscriptions:filter.clearAll")}
                selectAria={t("subscriptions:filter.selectAllLocalAria")}
                clearAria={t("subscriptions:filter.clearLocalAria")}
                onSelectAll={state.selectAll}
                onClearAll={state.clearAll}
                selectTestId="timeline-filter-local-select-all"
                clearTestId="timeline-filter-local-clear"
              />
              <div
                className="im-auto-scrollbar min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
                data-testid="timeline-filter-local-scroll"
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
                  hideHint
                  hideSearch
                  embedded
                />
              </div>
            </section>
            <SubscribeFilterGroup
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
          </div>
        </div>
      </ModalDialog>
    </>
  );
}
