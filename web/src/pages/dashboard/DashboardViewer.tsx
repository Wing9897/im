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
import { usePersistedEnum, usePersistedState } from "../../hooks/usePersistedState";
import type { AnalysisTask } from "../../types/tasks";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { useTranslation } from "react-i18next";
import { getTasksPageCopy } from "../../domain/tasks/taskPageCopy";
import {
  SHOW_SYSTEM_TASKS_STORAGE_KEY,
  SHOW_SYSTEM_WORKSETS_STORAGE_KEY,
  TASKS_GROUPING_VIEW_STORAGE_KEY,
  TASKS_MODE_FILTER_STORAGE_KEY,
  getSystemTaskCatalog,
  isTasksGroupingView,
  isTasksModeFilter,
  type TasksGroupingView,
  type TasksModeFilter,
} from "../../domain/tasks/systemTaskCatalog";
import { useDashboardViewer } from "./useDashboardViewer";
import { useErrorToast } from "../../hooks/useErrorToast";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { createWorkset, deleteWorkset, renameWorkset } from "../../api/worksets";
import { useToast } from "../../context/ToastContext";
import { toError } from "../../utils/errors";
import { useMemo, useState, useCallback } from "react";
import { buildChannelNameById, useDetailSelection } from "../../components/detail";
import { useChannelsWithAccounts } from "../../hooks/useChannelsWithAccounts";
import {
  DashboardViewerDialogs,
  type DashboardWorksetNameDialogState,
} from "./DashboardViewerDialogs";
import { DashboardViewerToolbar } from "./DashboardViewerToolbar";

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
  const [groupingView, setGroupingView] = usePersistedEnum<TasksGroupingView>(
    TASKS_GROUPING_VIEW_STORAGE_KEY,
    "by_task",
    isTasksGroupingView,
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showSystemTasks, setShowSystemTasks] = usePersistedState(
    SHOW_SYSTEM_TASKS_STORAGE_KEY,
    false,
  );
  const [showSystemWorksets, setShowSystemWorksets] = usePersistedState(
    SHOW_SYSTEM_WORKSETS_STORAGE_KEY,
    true,
  );
  const { worksets, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const [worksetNameDialog, setWorksetNameDialog] = useState<DashboardWorksetNameDialogState | null>(
    null,
  );
  const [worksetNameBusy, setWorksetNameBusy] = useState(false);
  const [worksetDeleteTarget, setWorksetDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [worksetDeleting, setWorksetDeleting] = useState(false);
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

  const worksetGroups = useMemo(() => {
    if (groupingView !== "by_workset") return [];
    const byId = new Map(worksets.map((ws) => [ws.id, ws]));
    const groups = new Map<
      string,
      { key: string; title: string; isSystem: boolean; tasks: AnalysisTask[] }
    >();
    for (const ws of worksets) {
      const title =
        ws.id === SYSTEM_WORKSET_ID ? t("workset.generalName") : ws.name;
      groups.set(ws.id, {
        key: ws.id,
        title,
        isSystem: Boolean(ws.isSystem) || ws.id === SYSTEM_WORKSET_ID,
        tasks: [],
      });
    }
    for (const task of visibleTasks) {
      const key = task.worksetId ?? "__unassigned__";
      if (key === "__unassigned__") {
        const group = groups.get("__unassigned__") ?? {
          key: "__unassigned__",
          title: t("workset.unassignedGroup"),
          isSystem: false,
          tasks: [],
        };
        group.tasks.push(task);
        groups.set("__unassigned__", group);
        continue;
      }
      const existing = groups.get(key);
      if (existing) {
        existing.tasks.push(task);
      } else {
        const ws = byId.get(key);
        groups.set(key, {
          key,
          title: ws?.name ?? t("workset.unknownGroup"),
          isSystem: Boolean(ws?.isSystem),
          tasks: [task],
        });
      }
    }
    const ordered: Array<{
      key: string;
      title: string;
      isSystem: boolean;
      tasks: AnalysisTask[];
    }> = [];
    for (const ws of worksets) {
      const group = groups.get(ws.id);
      if (!group) continue;
      if (!showSystemWorksets && group.isSystem) continue;
      ordered.push(group);
    }
    const unassigned = groups.get("__unassigned__");
    if (unassigned) ordered.push(unassigned);
    return ordered;
  }, [groupingView, visibleTasks, worksets, t, showSystemWorksets]);

  const openCreateWorkset = useCallback(() => {
    setWorksetNameDialog({ mode: "create" });
  }, []);

  const handleWorksetNameSubmit = useCallback(
    async (cleaned: string) => {
      if (!worksetNameDialog) return;
      setWorksetNameBusy(true);
      try {
        if (worksetNameDialog.mode === "create") {
          await createWorkset(cleaned);
          await refreshWorksets();
          showToast(t("workset.createdToast", { name: cleaned }), "success");
        } else {
          await renameWorkset(worksetNameDialog.id, cleaned);
          await refreshWorksets();
          showToast(t("workset.renamedToast", { name: cleaned }), "success");
        }
        setWorksetNameDialog(null);
      } catch (error) {
        showToast(toError(error).message, "error");
      } finally {
        setWorksetNameBusy(false);
      }
    },
    [refreshWorksets, showToast, t, worksetNameDialog],
  );

  const confirmDeleteWorkset = useCallback(async () => {
    if (!worksetDeleteTarget) return;
    setWorksetDeleting(true);
    try {
      await deleteWorkset(worksetDeleteTarget.id);
      await refreshWorksets();
      showToast(t("workset.deletedToast", { name: worksetDeleteTarget.name }), "success");
      setWorksetDeleteTarget(null);
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setWorksetDeleting(false);
    }
  }, [refreshWorksets, showToast, t, worksetDeleteTarget]);

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

  const systemTasksSection =
    groupingView === "by_task" && showSystemTasks && !loading && !error ? (
      <DashboardSystemTasksSection
        catalog={systemCatalog}
        title={copy.systemSectionTitle}
        subtitle={copy.systemSectionSubtitle}
      />
    ) : null;

  const isTaskView = groupingView === "by_task";
  const isWorksetView = groupingView === "by_workset";

  return (
    <AppPageShell>
      {!loading && !error ? (
        <DashboardViewerToolbar
          t={t}
          groupingView={groupingView}
          modeFilter={modeFilter}
          taskCount={tasks.length}
          searchQuery={searchQuery}
          showSystemTasks={showSystemTasks}
          showSystemWorksets={showSystemWorksets}
          createTaskLabel={copy.createLabel}
          showSystemTasksLabel={copy.showSystemTasks}
          hideSystemTasksLabel={copy.hideSystemTasks}
          onGroupingViewChange={setGroupingView}
          onModeFilterChange={setModeFilter}
          onSearchQueryChange={setSearchQuery}
          onToggleSystemTasks={() => setShowSystemTasks((prev) => !prev)}
          onToggleSystemWorksets={() => setShowSystemWorksets((prev) => !prev)}
          onCreateTask={() => navigate("/tasks/new")}
          onCreateWorkset={openCreateWorkset}
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
          groups={worksetGroups}
          t={t}
          statsMap={statsMap}
          defaultStats={defaultStats}
          focusedId={focusedId}
          detailTaskId={detailTask?.id ?? null}
          onToggleActive={handleToggleActive}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onOpenTask={openTask}
          onRenameWorkset={(id, name) =>
            setWorksetNameDialog({ mode: "rename", id, name })
          }
          onDeleteWorkset={(id, name) => setWorksetDeleteTarget({ id, name })}
          onCreateWorkset={openCreateWorkset}
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
        worksetNameDialog={worksetNameDialog}
        worksetNameBusy={worksetNameBusy}
        worksetDeleteTarget={worksetDeleteTarget}
        worksetDeleting={worksetDeleting}
        detailTask={detailTask}
        detailStats={detailTask ? (statsMap.get(detailTask.id) ?? defaultStats) : defaultStats}
        channelNameById={channelNameById}
        onConfirmTaskDelete={confirmDelete}
        onCancelTaskDelete={() => setDeleteTarget(null)}
        onCloseWorksetNameDialog={() => {
          if (!worksetNameBusy) setWorksetNameDialog(null);
        }}
        onSubmitWorksetName={handleWorksetNameSubmit}
        onConfirmWorksetDelete={confirmDeleteWorkset}
        onCancelWorksetDelete={() => {
          if (!worksetDeleting) setWorksetDeleteTarget(null);
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
    </AppPageShell>
  );
}
