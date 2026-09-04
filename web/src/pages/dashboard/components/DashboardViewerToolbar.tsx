import { startTransition } from "react";
import type { TFunction } from "i18next";
import { Eye, EyeOff, Gauge } from "lucide-react";

import {
  Button,
  FilterChip,
  OpsControlBar,
  TextField,
} from "../../../components/ui";
import { pageOpsControlClass } from "../../../components/ui/controlStyles";
import {
  getTaskFormAnalysisModeMeta,
  taskFormAnalysisModeOrder,
} from "../../../components/task/taskFormAnalysisModeMeta";
import type { TasksModeFilter } from "../../../domain/tasks/systemTaskCatalog";
import { WorksetCatalogChrome } from "../../worksets/WorksetCatalogChrome";

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
  isWorksetView: boolean;
  modeFilter: TasksModeFilter;
  taskCount: number;
  searchQuery: string;
  showSystemTasks: boolean;
  createTaskLabel: string;
  showSystemTasksLabel: string;
  hideSystemTasksLabel: string;
  onModeFilterChange: (filter: TasksModeFilter) => void;
  onSearchQueryChange: (query: string) => void;
  onToggleSystemTasks: () => void;
  onCreateTask: () => void;
  onCreateWorkset: () => void;
  onOpenScheduling?: () => void;
  hideSearch?: boolean;
  hideCreateWorkset?: boolean;
}

/** Fixed-width catalog search — beats TextField `w-full` and does not shrink behind chips. */
const catalogSearchClass = `${pageOpsControlClass} !w-[clamp(10rem,22vw,16rem)] min-w-[10rem] shrink-0`;

/** Filtering, search, and create controls for the tasks or worksets catalog. */
export function DashboardViewerToolbar({
  t,
  isWorksetView,
  modeFilter,
  taskCount,
  searchQuery,
  showSystemTasks,
  createTaskLabel,
  showSystemTasksLabel,
  hideSystemTasksLabel,
  onModeFilterChange,
  onSearchQueryChange,
  onToggleSystemTasks,
  onCreateTask,
  onCreateWorkset,
  onOpenScheduling,
  hideSearch = false,
  hideCreateWorkset = false,
}: DashboardViewerToolbarProps) {
  const isTaskView = !isWorksetView;

  return (
    <OpsControlBar
      sticky
      ariaLabel={isWorksetView ? t("workset:toolbarAria") : t("tasks:toolbarAria")}
      data-testid={isWorksetView ? "worksets-toolbar" : "tasks-toolbar"}
      className="!flex-wrap"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {isWorksetView ? <WorksetCatalogChrome /> : null}
        {isTaskView && taskCount > 0 ? (
          <>
            <FilterChip
              size="md"
              active={modeFilter === "all"}
              onClick={() => startTransition(() => onModeFilterChange("all"))}
            >
              {t("tasks:allModes")}
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
      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-sm">
        {hideSearch ? null : (
          <TextField
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={
              isWorksetView ? t("workset:searchPlaceholder") : t("tasks:searchPlaceholder")
            }
            aria-label={isWorksetView ? t("workset:searchAria") : t("tasks:searchAria")}
            data-im-search
            data-testid={isWorksetView ? "worksets-search" : "tasks-search"}
            className={catalogSearchClass}
          />
        )}
        {isTaskView ? (
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={onOpenScheduling}
              aria-label={t("tasks:globalSchedulingSettings")}
              title={t("tasks:globalSchedulingSettings")}
              data-testid="open-global-scheduling"
            >
              <Gauge size={16} aria-hidden="true" />
            </Button>
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
        {isWorksetView && !hideCreateWorkset ? (
          <Button
            variant="primary"
            size="md"
            onClick={onCreateWorkset}
            data-testid="dashboard-create-workset"
          >
            {t("workset:create")}
          </Button>
        ) : null}
      </div>
    </OpsControlBar>
  );
}
