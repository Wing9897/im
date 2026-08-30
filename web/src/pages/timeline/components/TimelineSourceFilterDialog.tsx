/**
 * Timeline source filter: local worksets (left) and subscribed calendars (right).
 * Board / intelligence / gantt keep SourceFilterDialog (tree only). Subscribe is
 * an optional slot here — do not merge the two dialog files.
 */

import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ModalDialog } from "../../../components/ModalDialog";
import { SourceFilterColumnShell, SourceFilterTree } from "../../../components/SourceFilterTree";
import { SourceFilterTrigger } from "../../../components/SourceFilterTrigger";
import {
  SubscribeFilterGroup,
  type SubscribeCalendarOption,
} from "../../../components/calendarShare/SubscribeFilterGroup";
import { Button, TextField } from "../../../components/ui";
import { useSourceFilterDialogState } from "../../../components/useSourceFilterDialogState";
import { useSourceFilterSubscribeDraft } from "../../../domain/calendarShare/useSourceFilterSubscribeDraft";
import type { SourceFilterOption } from "../../../domain/timeline/sourceFilterOptions";
import type { SourceFilterSelection } from "../../../domain/tasks/sourceFilterSelection";
import type { SourceFilterExpandTask, WorksetFilterOption } from "../../../components/SourceFilterDialog";
import type {
  SubscribeAvailability,
  SubscribedCalendarSelection,
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
  const subscribe = useSourceFilterSubscribeDraft({
    open: state.open,
    subscribeCalendars,
    selectedSubscribeKeys,
    onChangeSubscribeKeys,
    localIsFiltering: state.isFiltering,
    localFilterBadgeCount: state.filterBadgeCount,
    localApplyDisabled: state.applyDisabled,
    applyLocal: state.apply,
  });

  return (
    <>
      <SourceFilterTrigger
        open={state.open}
        isFiltering={subscribe.isFiltering}
        filterBadgeCount={subscribe.filterBadgeCount}
        onOpen={() => state.setOpen(true)}
        prefix={prefix}
        variant={variant}
      />

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
            onClick={subscribe.apply}
            disabled={subscribe.applyDisabled}
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
            <SourceFilterColumnShell
              icon={Layers}
              label={t("subscriptions:filter.local")}
              headingTestId="timeline-filter-section-local"
              sectionTestId="timeline-filter-local"
              scrollTestId="timeline-filter-local-scroll"
              selectLabel={t("subscriptions:filter.selectAll")}
              clearLabel={t("subscriptions:filter.clearAll")}
              selectAria={t("subscriptions:filter.selectAllLocalAria")}
              clearAria={t("subscriptions:filter.clearLocalAria")}
              onSelectAll={state.selectAll}
              onClearAll={state.clearAll}
              selectTestId="timeline-filter-local-select-all"
              clearTestId="timeline-filter-local-clear"
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
            </SourceFilterColumnShell>
            <SubscribeFilterGroup
              calendars={subscribeCalendars}
              draft={subscribe.draftSubscribe}
              query={state.query}
              onToggleKey={subscribe.toggleKey}
              onSelectAll={subscribe.selectAllSubscribe}
              onClearAll={subscribe.clearAllSubscribe}
              availability={subscribeAvailability}
            />
          </div>
        </div>
      </ModalDialog>
    </>
  );
}
