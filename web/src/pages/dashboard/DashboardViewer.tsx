/**
 * Dashboard task catalog page orchestration.
 */

import { EmptyState } from "../../components/common/EmptyState";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { DashboardByTaskList, DashboardByWorksetList } from "./DashboardGroupedLists";
import { DashboardSystemTasksSection } from "./DashboardSystemTasksSection";
import { AppPageShell, Button } from "../../components/ui";
import { useListKeyboardNavigation } from "../../hooks/useListKeyboardNavigation";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import { usePersistedEnum } from "../../hooks/usePersistedState";
import type { AnalysisTask } from "../../types/tasks";
import { useTranslation } from "react-i18next";
import { getTasksPageCopy } from "../../domain/tasks/taskPageCopy";
import { isProjectTask } from "../../domain/tasks/isProjectTask";
import {
  TASKS_MODE_FILTER_STORAGE_KEY,
  getSystemTaskCatalog,
  isTasksModeFilter,
  type TasksModeFilter,
} from "../../domain/tasks/systemTaskCatalog";
import { useDashboardViewer } from "./useDashboardViewer";
import { useDashboardViewerShell } from "./useDashboardViewerShell";
import { useErrorToast } from "../../hooks/useErrorToast";
import { useMemo, useState, useCallback } from "react";
import { buildChannelNameById, useDetailSelection } from "../../components/detail";
import { useChannelsWithSources } from "../../hooks/useChannelsWithSources";
import { DashboardViewerDialogs } from "./DashboardViewerDialogs";
import { DashboardViewerToolbar } from "./DashboardViewerToolbar";
import { WorksetDetailDialog } from "./WorksetDetailDialog";

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
  const { channels } = useChannelsWithSources();
  const channelNameById = useMemo(() => buildChannelNameById(channels), [channels]);

  const [modeFilter, setModeFilter] = usePersistedEnum<TasksModeFilter>(
    TASKS_MODE_FILTER_STORAGE_KEY,
    "all",
    isTasksModeFilter,
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
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

  const shell = useDashboardViewerShell({ visibleTasks, navigate });

  const openTask = useCallback(
    (task: AnalysisTask) => {
      setFocusedId(task.id);
      if (isProjectTask(task)) {
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

  const systemTasksSection =
    shell.groupingView === "by_task" && shell.showSystemTasks && !loading && !error ? (
      <DashboardSystemTasksSection
        catalog={systemCatalog}
        title={copy.systemSectionTitle}
        subtitle={copy.systemSectionSubtitle}
      />
    ) : null;

  const isTaskView = shell.groupingView === "by_task";
  const isWorksetView = shell.groupingView === "by_workset";

  return (
    <AppPageShell>
      {!loading && !error ? (
        <DashboardViewerToolbar
          t={t}
          groupingView={shell.groupingView}
          modeFilter={modeFilter}
          taskCount={tasks.length}
          searchQuery={searchQuery}
          showSystemTasks={shell.showSystemTasks}
          showSystemWorksets={shell.showSystemWorksets}
          createTaskLabel={copy.createLabel}
          showSystemTasksLabel={copy.showSystemTasks}
          hideSystemTasksLabel={copy.hideSystemTasks}
          onGroupingViewChange={shell.setGroupingView}
          onModeFilterChange={setModeFilter}
          onSearchQueryChange={setSearchQuery}
          onToggleSystemTasks={() => shell.setShowSystemTasks((prev) => !prev)}
          onToggleSystemWorksets={() => shell.setShowSystemWorksets((prev) => !prev)}
          onCreateTask={() => navigate("/tasks/new")}
          onCreateWorkset={shell.openCreateWorkset}
        />
      ) : null}

      {loading ? <SkeletonScreen variant="card-grid" count={6} columns={3} /> : null}

      {!loading && !error && tasks.length === 0 && isTaskView && (
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

      {!loading && tasks.length > 0 && filteredTasks.length === 0 && isTaskView && (
        <EmptyState
          title={t("tasks.noMatchTitle")}
          description={t("tasks.noMatchDescription", { query: searchQuery.trim() })}
        />
      )}

      {!loading && filteredTasks.length > 0 && visibleTasks.length === 0 && isTaskView && (
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

      {!loading && !error && isWorksetView ? (
        <DashboardByWorksetList
          groups={shell.worksetGroups}
          t={t}
          itemCountByWorkset={shell.itemCountByWorkset}
          statsMap={statsMap}
          defaultStats={defaultStats}
          focusedId={focusedId}
          detailTaskId={detailTask?.id ?? null}
          onToggleActive={handleToggleActive}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onOpenTask={openTask}
          onOpenWorkset={shell.openWorksetDetail}
          onRenameWorkset={(id, name) =>
            shell.setWorksetNameDialog({ mode: "rename", id, name })
          }
          onDeleteWorkset={(id, name) => shell.setWorksetDeleteTarget({ id, name })}
          onCreateWorkset={shell.openCreateWorkset}
        />
      ) : null}

      {!loading && visibleTasks.length > 0 && isTaskView ? (
        <DashboardByTaskList
          tasks={visibleTasks}
          navigate={navigate}
          t={t}
          createLabel={copy.createLabel}
          statsMap={statsMap}
          defaultStats={defaultStats}
          focusedId={focusedId}
          detailTaskId={detailTask?.id ?? null}
          onToggleActive={handleToggleActive}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onOpenTask={openTask}
        />
      ) : null}

      {systemTasksSection}

      <DashboardViewerDialogs
        t={t}
        taskDeleteTarget={deleteTarget}
        taskDeleting={deleting}
        worksetNameDialog={shell.worksetNameDialog}
        worksetNameBusy={shell.worksetNameBusy}
        worksetDeleteTarget={shell.worksetDeleteTarget}
        worksetDeleting={shell.worksetDeleting}
        detailTask={detailTask}
        detailStats={detailTask ? (statsMap.get(detailTask.id) ?? defaultStats) : defaultStats}
        channelNameById={channelNameById}
        onConfirmTaskDelete={confirmDelete}
        onCancelTaskDelete={() => setDeleteTarget(null)}
        onCloseWorksetNameDialog={() => {
          if (!shell.worksetNameBusy) shell.setWorksetNameDialog(null);
        }}
        onSubmitWorksetName={shell.handleWorksetNameSubmit}
        onConfirmWorksetDelete={shell.confirmDeleteWorkset}
        onCancelWorksetDelete={() => {
          if (!shell.worksetDeleting) shell.setWorksetDeleteTarget(null);
        }}
        onCloseTaskDetail={clearTask}
        onEditDetailTask={() => {
          if (detailTask) {
            const taskId = detailTask.id;
            clearTask();
            handleEdit(taskId);
          }
        }}
      />

      {shell.detailWorkset ? (
        <WorksetDetailDialog
          workset={shell.detailWorkset}
          onClose={shell.closeWorksetDetail}
          onOpenTask={(task) => {
            shell.closeWorksetDetail();
            openTask(task);
          }}
          onRename={
            shell.detailWorkset.isSystem
              ? undefined
              : () => {
                  shell.setWorksetNameDialog({
                    mode: "rename",
                    id: shell.detailWorkset!.id,
                    name: shell.detailWorkset!.title,
                  });
                }
          }
          onDelete={
            shell.detailWorkset.isSystem
              ? undefined
              : () => {
                  shell.setWorksetDeleteTarget({
                    id: shell.detailWorkset!.id,
                    name: shell.detailWorkset!.title,
                  });
                }
          }
        />
      ) : null}
    </AppPageShell>
  );
}
