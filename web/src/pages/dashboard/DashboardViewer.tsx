/**
 * Dashboard task grid — TaskCard collection with live stats and management actions.
 */

import { useMemo, useState, useCallback, startTransition, type CSSProperties } from "react";
import { buildChannelNameById } from "../../components/detail";
import { useChannelsWithAccounts } from "../../hooks/useChannelsWithAccounts";
import { Plus } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { DeleteConfirmDialog } from "../../components/dialogs/DeleteConfirmDialog";
import { TaskCard } from "../../components/TaskCard";
import { SystemInfoTaskCard } from "../../components/SystemInfoTaskCard";
import { TaskGrid } from "../../components/TaskGrid";
import { useDetailSelection } from "../../components/detail";
import { TaskDetailView } from "./TaskDetailDialog";
import {
  Button,
  TextField,
  AppPageShell,
  CreateCard,
  FilterChip,
  OpsControlBar,
  sectionTitleClass,
  captionClass,
} from "../../components/ui";
import { pageOpsControlClass } from "../../components/ui/controlStyles";
import { useListKeyboardNavigation } from "../../hooks/useListKeyboardNavigation";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import { usePersistedEnum } from "../../hooks/usePersistedEnum";
import { usePersistedState } from "../../hooks/usePersistedState";
import {
  getTaskFormAnalysisModeMeta,
  taskFormAnalysisModeOrder,
} from "../../components/task/taskFormAnalysisModeMeta";
import type { AnalysisTask } from "../../types/tasks";
import { useTranslation } from "react-i18next";
import { getTasksPageCopy } from "../../domain/tasks/taskPageCopy";
import {
  SHOW_SYSTEM_TASKS_STORAGE_KEY,
  TASKS_MODE_FILTER_STORAGE_KEY,
  getSystemTaskCatalog,
  isTasksModeFilter,
  type TasksModeFilter,
} from "../../domain/tasks/systemTaskCatalog";
import { useDashboardViewer } from "./useDashboardViewer";
import { useErrorToast } from "../../hooks/useErrorToast";

export function DashboardViewer() {
  const { t } = useTranslation();
  const copy = getTasksPageCopy(t);
  const systemCatalog = getSystemTaskCatalog(t);
  const {
    tasks,
    filteredTasks,
    statsMap,
    defaultStats,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    deleteTarget,
    deleting,
    handleToggleActive,
    handleEdit,
    handleOpenProject,
    handleDelete,
    confirmDelete,
    setDeleteTarget,
    navigate,
  } = useDashboardViewer();
  useErrorToast(error);
  const { channels } = useChannelsWithAccounts();
  const channelNameById = useMemo(() => buildChannelNameById(channels), [channels]);

  const [modeFilter, setModeFilter] = usePersistedEnum<TasksModeFilter>(
    TASKS_MODE_FILTER_STORAGE_KEY,
    "all",
    isTasksModeFilter,
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showSystemTasks, setShowSystemTasks] = usePersistedState(
    SHOW_SYSTEM_TASKS_STORAGE_KEY,
    false,
  );
  useSlashFocusSearch(!loading);
  const { selected: detailTask, select: selectTask, clear: clearTask } =
    useDetailSelection<AnalysisTask>();
  const visibleTasks = useMemo(
    () =>
      modeFilter === "all"
        ? filteredTasks
        : filteredTasks.filter((task) => task.analysisMode === modeFilter),
    [filteredTasks, modeFilter],
  );

  const openTask = useCallback(
    (task: AnalysisTask) => {
      setFocusedId(task.id);
      if (task.analysisMode === "project") {
        handleOpenProject(task.id);
        return;
      }
      selectTask(task);
    },
    [handleOpenProject, selectTask],
  );

  useListKeyboardNavigation({
    items: visibleTasks,
    selectedId: focusedId ?? detailTask?.id ?? null,
    getItemId: (task) => task.id,
    onSelect: (task) => setFocusedId(task.id),
    onActivate: openTask,
    onEscape: clearTask,
    enabled: !loading && visibleTasks.length > 0,
  });

  const systemTasksToggle = (
    <Button
      variant="secondary"
      size="md"
      onClick={() => setShowSystemTasks((prev) => !prev)}
      aria-pressed={showSystemTasks}
      aria-label={showSystemTasks ? copy.hideSystemTasks : copy.showSystemTasks}
      data-testid="toggle-system-tasks"
    >
      {showSystemTasks ? copy.hideSystemTasks : copy.showSystemTasks}
    </Button>
  );

  const systemTasksSection =
    showSystemTasks && !loading && !error ? (
      <section className="mt-lg" data-testid="system-tasks-section" aria-label={copy.systemSectionTitle}>
        <h2 className={sectionTitleClass}>{copy.systemSectionTitle}</h2>
        <p className={`${captionClass} mt-xs mb-md`}>{copy.systemSectionSubtitle}</p>
        <TaskGrid>
          {systemCatalog.map((item, index) => (
            <div
              key={item.id}
              className="im-enter-rise"
              style={{ "--i": Math.min(index, 8) } as CSSProperties}
            >
              <SystemInfoTaskCard item={item} />
            </div>
          ))}
        </TaskGrid>
      </section>
    ) : null;

  const tasksToolbar =
    !loading && !error ? (
      tasks.length > 0 ? (
        <OpsControlBar
          sticky
          ariaLabel={t("tasks.toolbarAria")}
          data-testid="tasks-toolbar"
          className="flex-wrap"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              size="md"
              active={modeFilter === "all"}
              onClick={() => startTransition(() => setModeFilter("all"))}
            >
              {t("tasks.allModes")}
            </FilterChip>
            {taskFormAnalysisModeOrder.map((mode) => (
              <FilterChip
                key={mode}
                size="md"
                active={modeFilter === mode}
                onClick={() => startTransition(() => setModeFilter(mode))}
              >
                {getTaskFormAnalysisModeMeta(mode).displayLabel}
              </FilterChip>
            ))}
          </div>
          <TextField
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("tasks.searchPlaceholder")}
            aria-label={t("tasks.searchAria")}
            data-im-search
            className={`${pageOpsControlClass} min-w-[160px] max-w-[260px] flex-1 basis-40`}
          />
          <div className="ml-auto flex flex-wrap items-center gap-sm">
            {systemTasksToggle}
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate("/tasks/new")}
              aria-label={copy.createLabel}
            >
              {copy.createLabel}
            </Button>
          </div>
        </OpsControlBar>
      ) : (
        <OpsControlBar
          sticky
          ariaLabel={t("tasks.toolbarAria")}
          data-testid="tasks-toolbar"
          className="flex-wrap justify-end"
        >
          {systemTasksToggle}
        </OpsControlBar>
      )
    ) : null;

  return (
    <AppPageShell>
      {tasksToolbar}

      {loading ? <SkeletonScreen variant="card-grid" count={6} columns={3} /> : null}

      {!loading && !error && tasks.length === 0 && (
        <EmptyState
          className="im-enter-rise"
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          actions={
            <Button variant="primary" onClick={() => navigate("/tasks/new")}>
              {t("tasks.addTask")}
            </Button>
          }
        />
      )}

      {!loading && tasks.length > 0 && filteredTasks.length === 0 && (
        <EmptyState
          title={t("tasks.noMatchTitle")}
          description={t("tasks.noMatchDescription", { query: searchQuery.trim() })}
        />
      )}

      {!loading && filteredTasks.length > 0 && visibleTasks.length === 0 && (
        <EmptyState
          title={t("tasks.emptyModeTitle")}
          description={t("tasks.emptyModeDescription")}
          actions={
            <Button variant="secondary" onClick={() => setModeFilter("all")}>
              {t("tasks.showAllTasks")}
            </Button>
          }
        />
      )}

      {!loading && visibleTasks.length > 0 ? (
        <TaskGrid>
          {visibleTasks.map((task, index) => (
            <div
              key={task.id}
              className="im-enter-rise"
              style={{ "--i": Math.min(index, 8) } as CSSProperties}
            >
              <TaskCard
                task={task}
                stats={statsMap.get(task.id) ?? defaultStats}
                isSelected={focusedId === task.id || detailTask?.id === task.id}
                onToggleActive={handleToggleActive}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSelect={() => openTask(task)}
              />
            </div>
          ))}
          <CreateCard
            className="im-enter-rise"
            style={{ "--i": Math.min(visibleTasks.length, 8) } as CSSProperties}
            onClick={() => navigate("/tasks/new")}
            aria-label={t("tasks.createNewAria", { label: copy.createLabel })}
            icon={<Plus size={16} aria-hidden="true" />}
            label={t("tasks.createNew")}
          />
        </TaskGrid>
      ) : null}

      {systemTasksSection}

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        targetName={deleteTarget?.name ?? ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        deleting={deleting}
      />

      {detailTask ? (
        <TaskDetailView
          task={detailTask}
          stats={statsMap.get(detailTask.id) ?? defaultStats}
          channelNameById={channelNameById}
          onClose={clearTask}
          onEdit={() => {
            const taskId = detailTask.id;
            clearTask();
            handleEdit(taskId);
          }}
          presentation="modal"
        />
      ) : null}
    </AppPageShell>
  );
}
