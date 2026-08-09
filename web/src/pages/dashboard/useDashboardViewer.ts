/**
 * Custom hook for the dashboard task grid page.
 */

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { deleteTask, toggleTaskActive } from "../../api/tasks";
import { mapActiveAnalysesToTasks } from "../../domain/analysis/analysisStatusModel";
import { useAnalysisStatus } from "../../context/AnalysisStatusContext";
import { useMonitorMode } from "../../context/MonitorModeContext";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import { TASKS_SEARCH_STORAGE_KEY } from "../../domain/tasks/systemTaskCatalog";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useRefreshOnAnalysisEvent } from "../../hooks/useRefreshOnAnalysisEvent";
import { useRetryAction } from "../../hooks/useRetryAction";
import { useTaskAnalysisStats } from "../../hooks/useTaskAnalysisStats";
import { pickLatestBatchAttention } from "../../domain/analysis/batchAttention";
import type { TaskCardStats } from "../../types/dashboard";
import { toErrorMessage } from "../../utils/errors";
import i18n from "../../i18n";
import {
  EMPTY_TASK_CARD_STATS,
  toTaskCardStats,
} from "./taskCardStats";
import { selectTopLevelTasks } from "../tasks/agent/projectDetailModel";

export function useDashboardViewer() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { monitorMode } = useMonitorMode();
  // Dual keep-mount (App shell): pages stay mounted under canvas — gate SSE refresh.
  const pageActive = monitorMode === "pages";
  const { tasks, tasksLoading, taskLoadError, refreshTasks } = useTaskCatalog();
  const { activeAnalyses, queueStatus, analysisPaused } = useAnalysisStatus();

  const { taskStats, refreshTaskStats, notifyAnalysisEvent } = useTaskAnalysisStats({
    timeRange: "all",
    logPrefix: "[dashboard-viewer]",
    refreshOnAnalysisEvents: false,
  });

  const refreshAll = useCallback(() => {
    if (!pageActive) return;
    void refreshTasks();
    notifyAnalysisEvent();
  }, [pageActive, notifyAnalysisEvent, refreshTasks]);

  useRefreshOnAnalysisEvent(refreshAll, {
    // Started events already update live "執行中" via AnalysisStatusContext;
    // skip full task+stats refetch to keep the grid snappy while batches run.
    includeStarted: false,
    includeCompleted: true,
    includeFailed: true,
    // `[]` = match nothing while canvas is visible (same pattern as Timeline).
    taskIds: pageActive ? null : [],
  });

  const activeAnalysesByTaskId = useMemo(
    () => mapActiveAnalysesToTasks(activeAnalyses),
    [activeAnalyses],
  );

  const paused = analysisPaused || Boolean(queueStatus?.analysisPaused);

  const statsMap = useMemo(() => {
    const map = new Map<string, TaskCardStats>();
    for (const stat of taskStats ?? []) {
      const attention = pickLatestBatchAttention(queueStatus, stat.taskId);
      map.set(
        stat.taskId,
        toTaskCardStats(stat, activeAnalysesByTaskId.has(stat.taskId), {
          lastErrorMessage: attention?.errorMessage ?? null,
          retryCount: attention?.retryCount ?? 0,
          analysisPaused: paused && Boolean(attention),
        }),
      );
    }
    // SSE may mark a task analyzing before stats rows exist — keep the live set.
    for (const taskId of activeAnalysesByTaskId.keys()) {
      if (map.has(taskId)) continue;
      map.set(taskId, { ...EMPTY_TASK_CARD_STATS, isRunning: true });
    }
    return map;
  }, [taskStats, activeAnalysesByTaskId, queueStatus, paused]);

  /** Agent children stay under `/tasks/:id/agent`, not the main grid. */
  const gridTasks = useMemo(() => selectTopLevelTasks(tasks), [tasks]);

  const [searchQuery, setSearchQuery] = usePersistedState(TASKS_SEARCH_STORAGE_KEY, "", {
    persistDebounceMs: 400,
    storage: "session",
  });
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const filteredTasks = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q) return gridTasks;
    return gridTasks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  }, [gridTasks, deferredSearchQuery]);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { retrying, handleRetry } = useRetryAction(async () => {
    await refreshTasks();
  });

  const handleToggleActive = useCallback(
    async (taskId: string) => {
      try {
        await toggleTaskActive(taskId);
        await refreshTasks();
      } catch (e) {
        showToast(toErrorMessage(e), "error");
        throw e;
      }
    },
    [refreshTasks, showToast],
  );

  const handleEdit = useCallback(
    (taskId: string) => {
      navigate(`/tasks/${taskId}/edit`);
    },
    [navigate],
  );

  const handleOpenProject = useCallback(
    (taskId: string) => {
      navigate(`/tasks/${taskId}/agent`);
    },
    [navigate],
  );

  const handleDelete = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setDeleteTarget({ id: task.id, name: task.name });
      }
    },
    [tasks],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTask(deleteTarget.id);
      setDeleteTarget(null);
      await refreshTasks();
      refreshTaskStats();
      showToast(String(i18n.t("tasks.deleted")), "success");
    } catch (e) {
      showToast(toErrorMessage(e), "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, refreshTasks, refreshTaskStats, showToast]);

  const defaultStats = EMPTY_TASK_CARD_STATS;
  const loading = tasksLoading && tasks.length === 0;
  const error = taskLoadError;

  return {
    tasks: gridTasks,
    filteredTasks,
    statsMap,
    defaultStats,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    deleteTarget,
    deleting,
    retrying,
    handleRetry,
    handleToggleActive,
    handleEdit,
    handleOpenProject,
    handleDelete,
    confirmDelete,
    setDeleteTarget,
    navigate,
  };
}
