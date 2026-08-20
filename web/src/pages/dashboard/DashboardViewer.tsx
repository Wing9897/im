/**
 * Dashboard task catalog page orchestration.
 */

import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { EmptyState } from "../../components/common/EmptyState";
import { EmptyStateGlyph } from "../../components/common/EmptyStateGlyph";
import { Layers, ListChecks, Search } from "lucide-react";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { DashboardByTaskList, DashboardByWorksetList } from "./components/DashboardGroupedLists";
import { DashboardSystemTasksSection } from "./components/DashboardSystemTasksSection";
import { AppPageShell, Button } from "../../components/ui";
import { useListKeyboardNavigation } from "../../hooks/useListKeyboardNavigation";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import { usePersistedEnum } from "../../hooks/usePersistedState";
import type { AnalysisTask } from "../../types/tasks";
import { getTasksPageCopy } from "../../domain/tasks/taskPageCopy";
import { isAgentCalendarTask } from "../../domain/tasks/isAgentCalendarTask";
import {
  TASKS_MODE_FILTER_STORAGE_KEY,
  getSystemTaskCatalog,
  isTasksModeFilter,
  type TasksModeFilter,
} from "../../domain/tasks/systemTaskCatalog";
import { parseWorksetCatalogTab } from "../../domain/worksets/worksetRoutes";
import { useDashboardViewer } from "./hooks/useDashboardViewer";
import { useDashboardViewerShell } from "./hooks/useDashboardViewerShell";
import { useErrorToast } from "../../hooks/useErrorToast";
import { buildChannelNameById, useDetailSelection } from "../../components/detail";
import { useChannelsWithSources } from "../../hooks/useChannelsWithSources";
import { DashboardViewerDialogs } from "./components/DashboardViewerDialogs";
import { DashboardViewerToolbar } from "./components/DashboardViewerToolbar";
import { WorksetPipelineGraphPanel } from "../worksets/WorksetPipelineGraphPanel";
import { PipelineGuideChecklist } from "../../components/pipeline/PipelineGuideChecklist";
import { usePipelineReadiness } from "../../hooks/usePipelineReadiness";

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
  const pipeline = usePipelineReadiness();
  const [searchParams] = useSearchParams();
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
      if (isAgentCalendarTask(task)) {
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
    !shell.isWorksetView && shell.showSystemTasks && !loading && !error ? (
      <DashboardSystemTasksSection
        catalog={systemCatalog}
        title={copy.systemSectionTitle}
        subtitle={copy.systemSectionSubtitle}
      />
    ) : null;

  const isTaskView = !shell.isWorksetView;
  const isWorksetView = shell.isWorksetView;
  const worksetCatalogTab = parseWorksetCatalogTab(searchParams.get("tab"));
  const isWorksetGraph = isWorksetView && worksetCatalogTab === "graph";
  const searchQueryForView = isWorksetView ? shell.worksetSearchQuery : searchQuery;
  const worksetSearchEmpty =
    isWorksetView &&
    !isWorksetGraph &&
    shell.worksetSearchQuery.trim().length > 0 &&
    shell.worksetGroups.length === 0;

  return (
    <AppPageShell
      width={isWorksetView ? "fluid" : "standard"}
      className={isWorksetGraph ? "im-ws-graph-page" : undefined}
    >
      {!loading && !error ? (
        <DashboardViewerToolbar
          t={t}
          isWorksetView={isWorksetView}
          hideSearch={isWorksetGraph}
          hideCreateWorkset={isWorksetGraph}
          modeFilter={modeFilter}
          taskCount={tasks.length}
          searchQuery={searchQueryForView}
          showSystemTasks={shell.showSystemTasks}
          createTaskLabel={copy.createLabel}
          showSystemTasksLabel={copy.showSystemTasks}
          hideSystemTasksLabel={copy.hideSystemTasks}
          onModeFilterChange={setModeFilter}
          onSearchQueryChange={
            isWorksetView ? shell.setWorksetSearchQuery : setSearchQuery
          }
          onToggleSystemTasks={() => shell.setShowSystemTasks((prev) => !prev)}
          onCreateTask={() => navigate("/tasks/new")}
          onCreateWorkset={shell.openCreateWorkset}
        />
      ) : null}

      {loading ? <SkeletonScreen variant="card-grid" count={6} columns={3} /> : null}

      {!loading && !error && pipeline.showChecklist && isTaskView ? (
        <PipelineGuideChecklist
          state={pipeline.state}
          compact={tasks.length > 0}
        />
      ) : null}

      {!loading && !error && tasks.length === 0 && isTaskView && !pipeline.showChecklist && (
        <EmptyState
          className="im-enter-rise"
          illustration={<EmptyStateGlyph icon={ListChecks} />}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          actions={
            <Button variant="primary" onClick={() => navigate("/tasks/new")}>
              {t("tasks:addTask")}
            </Button>
          }
        />
      )}

      {!loading && tasks.length > 0 && filteredTasks.length === 0 && isTaskView && (
        <EmptyState
          illustration={<EmptyStateGlyph icon={Search} />}
          title={t("tasks:noMatchTitle")}
          description={t("tasks:noMatchDescription", { query: searchQuery.trim() })}
        />
      )}

      {!loading && filteredTasks.length > 0 && visibleTasks.length === 0 && isTaskView && (
        <EmptyState
          illustration={<EmptyStateGlyph icon={ListChecks} />}
          title={t("tasks:emptyModeTitle")}
          description={t("tasks:emptyModeDescription")}
          actions={
            <Button variant="secondary" onClick={() => setModeFilter("all")}>
              {t("tasks:showAllTasks")}
            </Button>
          }
        />
      )}

      {!loading && !error && isWorksetView && worksetSearchEmpty ? (
        <EmptyState
          illustration={<EmptyStateGlyph icon={Layers} />}
          title={t("workset:noMatchTitle")}
          description={t("workset:noMatchDescription", {
            query: shell.worksetSearchQuery.trim(),
          })}
        />
      ) : null}

      {!loading && !error && isWorksetGraph ? <WorksetPipelineGraphPanel /> : null}

      {!loading && !error && isWorksetView && !isWorksetGraph && !worksetSearchEmpty ? (
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
          onRenameWorkset={(id, name) => shell.handleRenameWorkset(id, name)}
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
    </AppPageShell>
  );
}
