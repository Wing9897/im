import { useTranslation } from "react-i18next";

import { ModalDialog } from "./ModalDialog";
import { SourceFilterTree } from "./SourceFilterTree";
import { SourceFilterTrigger } from "./SourceFilterTrigger";
import {
  SubscribeFilterGroup,
  type SubscribeCalendarOption,
} from "./calendarShare/SubscribeFilterGroup";
import { Button } from "./ui";
import type { SourceFilterOption } from "../domain/timeline/sourceFilterOptions";
import type { SourceFilterSelection } from "../domain/tasks/sourceFilterSelection";
import {
  useSourceFilterDialogState,
  type SourceFilterExpandTask,
  type WorksetFilterOption,
} from "./useSourceFilterDialogState";
import { useSourceFilterSubscribeDraft } from "../domain/calendarShare/useSourceFilterSubscribeDraft";
import type {
  SubscribeAvailability,
  SubscribedCalendarSelection,
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
              onClick={subscribe.apply}
              disabled={subscribe.applyDisabled}
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
        {subscribe.subscribeCatalogReady ? (
          <SubscribeFilterGroup
            variant="compact"
            calendars={subscribeCalendars}
            draft={subscribe.draftSubscribe}
            query={state.query}
            onToggleKey={subscribe.toggleKey}
            onSelectAll={subscribe.selectAllSubscribe}
            onClearAll={subscribe.clearAllSubscribe}
            availability={subscribeAvailability}
          />
        ) : null}
      </ModalDialog>
    </>
  );
}
