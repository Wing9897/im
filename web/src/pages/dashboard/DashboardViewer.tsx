/**
 * Dashboard task grid — TaskCard collection with live stats and management actions.
 */

import { EmptyState } from "../../components/common/EmptyState";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { DeleteConfirmDialog } from "../../components/dialogs/DeleteConfirmDialog";
import { WorksetNameDialog } from "../../components/dialogs/WorksetNameDialog";
import { DashboardByTaskList, DashboardByWorksetList } from "./DashboardGroupedLists";
import { DashboardSystemTasksSection } from "./DashboardSystemTasksSection";
import {
  Button,
  TextField,
  AppPageShell,
  FilterChip,
  OpsControlBar,
  SegmentedControl,
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
import { useMemo, useState, useCallback, startTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { buildChannelNameById } from "../../components/detail";
import { useChannelsWithAccounts } from "../../hooks/useChannelsWithAccounts";
import { useDetailSelection } from "../../components/detail";
import { TaskDetailView } from "./TaskDetailDialog";

type WorksetNameDialogState =
  | { mode: "create" }
  | { mode: "rename"; id: string; name: string };

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
  const [worksetNameDialog, setWorksetNameDialog] = useState<WorksetNameDialogState | null>(
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

  const tasksToolbar =
    !loading && !error ? (
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
                startTransition(() => setGroupingView(id));
              }
            }}
            ariaLabel={t("workset.groupingAria")}
            items={[
              { id: "by_task", label: t("workset.viewByTask") },
              { id: "by_workset", label: t("workset.viewByWorkset") },
            ]}
          />
          {isTaskView && tasks.length > 0 ? (
            <>
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
            </>
          ) : null}
        </div>
        {isTaskView && tasks.length > 0 ? (
          <TextField
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
                showLabel={copy.showSystemTasks}
                hideLabel={copy.hideSystemTasks}
                testId="toggle-system-tasks"
                onToggle={() => setShowSystemTasks((prev) => !prev)}
              />
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate("/tasks/new")}
                aria-label={copy.createLabel}
              >
                {copy.createLabel}
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
                onToggle={() => setShowSystemWorksets((prev) => !prev)}
              />
              <Button
                variant="primary"
                size="md"
                onClick={openCreateWorkset}
                data-testid="dashboard-create-workset"
              >
                {t("workset.create")}
              </Button>
            </>
          ) : null}
        </div>
      </OpsControlBar>
    ) : null;

  return (
    <AppPageShell>
      {tasksToolbar}

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

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        targetName={deleteTarget?.name ?? ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        deleting={deleting}
      />

      <WorksetNameDialog
        open={worksetNameDialog !== null}
        mode={worksetNameDialog?.mode ?? "create"}
        initialName={
          worksetNameDialog?.mode === "rename" ? worksetNameDialog.name : ""
        }
        busy={worksetNameBusy}
        onClose={() => {
          if (!worksetNameBusy) setWorksetNameDialog(null);
        }}
        onSubmit={handleWorksetNameSubmit}
      />

      {worksetDeleteTarget ? (
        <ConfirmDialog
          title={t("workset.deleteTitle")}
          body={t("workset.deleteConfirm", { name: worksetDeleteTarget.name })}
          confirmLabel={t("dialog.confirmDelete")}
          confirmBusyLabel={t("dialog.deleting")}
          busy={worksetDeleting}
          onCancel={() => {
            if (!worksetDeleting) setWorksetDeleteTarget(null);
          }}
          onConfirm={confirmDeleteWorkset}
        />
      ) : null}

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
