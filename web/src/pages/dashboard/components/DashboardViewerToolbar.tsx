import { startTransition } from "react";
import type { TFunction } from "i18next";
import { Eye, EyeOff } from "lucide-react";

import {
  Button,
  FilterChip,
  OpsControlBar,
  SegmentedControl,
  TextField,
} from "../../../components/ui";
import { pageOpsControlClass } from "../../../components/ui/controlStyles";
import {
  getTaskFormAnalysisModeMeta,
  taskFormAnalysisModeOrder,
} from "../../../components/task/taskFormAnalysisModeMeta";
import type {
  TasksGroupingView,
  TasksModeFilter,
} from "../../../domain/tasks/systemTaskCatalog";

function VisibilityEyeButton({
  visible,
  showLabel,
  hideLabel,
  testId,
  onToggle,
}: {
  visible: boolean;
  showLabel: string;
  hideLabel: string;
  testId: string;
  onToggle: () => void;
}) {
  const label = visible ? hideLabel : showLabel;
  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={onToggle}
      aria-pressed={visible}
      aria-label={label}
      title={label}
      data-testid={testId}
    >
      {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
    </Button>
  );
}

interface DashboardViewerToolbarProps {
  t: TFunction;
  groupingView: TasksGroupingView;
  modeFilter: TasksModeFilter;
  taskCount: number;
  searchQuery: string;
  showSystemTasks: boolean;
  showSystemWorksets: boolean;
  createTaskLabel: string;
  showSystemTasksLabel: string;
  hideSystemTasksLabel: string;
  onGroupingViewChange: (view: TasksGroupingView) => void;
  onModeFilterChange: (filter: TasksModeFilter) => void;
  onSearchQueryChange: (query: string) => void;
  onToggleSystemTasks: () => void;
  onToggleSystemWorksets: () => void;
  onCreateTask: () => void;
  onCreateWorkset: () => void;
}

/** Grouping, filtering, search, and create controls for the dashboard. */
export function DashboardViewerToolbar({
  t,
  groupingView,
  modeFilter,
  taskCount,
  searchQuery,
  showSystemTasks,
  showSystemWorksets,
  createTaskLabel,
  showSystemTasksLabel,
  hideSystemTasksLabel,
  onGroupingViewChange,
  onModeFilterChange,
  onSearchQueryChange,
  onToggleSystemTasks,
  onToggleSystemWorksets,
  onCreateTask,
  onCreateWorkset,
}: DashboardViewerToolbarProps) {
  const isTaskView = groupingView === "by_task";
  const isWorksetView = groupingView === "by_workset";

  return (
    <OpsControlBar
      sticky
      ariaLabel={t("tasks.toolbarAria")}
      data-testid="tasks-toolbar"
      className="flex-wrap"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <SegmentedControl
          layout="inline"
          value={groupingView}
          onChange={(id) => {
            if (id === "by_task" || id === "by_workset") {
              startTransition(() => onGroupingViewChange(id));
            }
          }}
          ariaLabel={t("workset.groupingAria")}
          items={[
            { id: "by_task", label: t("workset.viewByTask") },
            { id: "by_workset", label: t("workset.viewByWorkset") },
          ]}
        />
        {isTaskView && taskCount > 0 ? (
          <>
            <FilterChip
              size="md"
              active={modeFilter === "all"}
              onClick={() => startTransition(() => onModeFilterChange("all"))}
            >
              {t("tasks.allModes")}
            </FilterChip>
            {taskFormAnalysisModeOrder.map((mode) => (
              <FilterChip
                key={mode}
                size="md"
                active={modeFilter === mode}
                onClick={() => startTransition(() => onModeFilterChange(mode))}
              >
                {getTaskFormAnalysisModeMeta(mode).displayLabel}
              </FilterChip>
            ))}
          </>
        ) : null}
      </div>
      {isTaskView && taskCount > 0 ? (
        <TextField
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={t("tasks.searchPlaceholder")}
          aria-label={t("tasks.searchAria")}
          data-im-search
          className={`${pageOpsControlClass} min-w-[160px] max-w-[260px] flex-1 basis-40`}
        />
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-sm">
        {isTaskView ? (
          <>
            <VisibilityEyeButton
              visible={showSystemTasks}
              showLabel={showSystemTasksLabel}
              hideLabel={hideSystemTasksLabel}
              testId="toggle-system-tasks"
              onToggle={onToggleSystemTasks}
            />
            <Button
              variant="primary"
              size="md"
              onClick={onCreateTask}
              aria-label={createTaskLabel}
            >
              {createTaskLabel}
            </Button>
          </>
        ) : null}
        {isWorksetView ? (
          <>
            <VisibilityEyeButton
              visible={showSystemWorksets}
              showLabel={t("workset.showSystemWorksets")}
              hideLabel={t("workset.hideSystemWorksets")}
              testId="toggle-system-worksets"
              onToggle={onToggleSystemWorksets}
            />
            <Button
              variant="primary"
              size="md"
              onClick={onCreateWorkset}
              data-testid="dashboard-create-workset"
            >
              {t("workset.create")}
            </Button>
          </>
        ) : null}
      </div>
    </OpsControlBar>
  );
}
