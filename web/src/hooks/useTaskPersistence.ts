import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchTaskSchedule, putTaskSchedule } from "../api/taskSchedule";
import { createTask, updateTask } from "../api/tasks";
import {
  analysisTaskToFormState,
  applyScheduleToFormState,
  formStateToTaskConfig,
  formStateToTaskSchedule,
} from "../domain/tasks/taskFormUtils";
import { useToast } from "../context/ToastContext";
import { useTaskCatalog } from "../context/TaskCatalogContext";
import i18n from "../i18n";
import { handleCommandError, toErrorMessage } from "../utils/errors";
import { safeArray } from "../utils/nullGuards";
import type { TaskFormState } from "./useTaskEditorState";
import {
  clearChatEditorDrafts,
  hasMeaningfulChatEditorFormDraft,
} from "../domain/prefs";

// ============================================================
// Types
// ============================================================

interface UseTaskPersistenceOptions {
  formState: TaskFormState;
  setFormState: React.Dispatch<React.SetStateAction<TaskFormState>>;
  isMountedRef: React.MutableRefObject<boolean>;
  onError: (message: string) => void;
}

interface UseTaskPersistenceReturn {
  save: () => Promise<void>;
  isSaving: boolean;
  /** True while GET /tasks/{id}/schedule is in flight for a recurring edit. */
  scheduleHydrating: boolean;
  /** Fetch failure message for the schedule subresource (null when ok / N/A). */
  scheduleHydrateError: string | null;
  retryScheduleHydrate: () => void;
}

// ============================================================
// Hook
// ============================================================

/**
 * Manages task persistence: saving (create/update), edit-mode hydration,
 * and post-save navigation.
 */
export function useTaskPersistence({
  formState,
  setFormState,
  isMountedRef,
  onError,
}: UseTaskPersistenceOptions): UseTaskPersistenceReturn {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { tasks, tasksLoading, taskLoadError, refreshTasks } = useTaskCatalog();

  const [isSaving, setIsSaving] = useState(false);
  const [scheduleHydrating, setScheduleHydrating] = useState(false);
  const [scheduleHydrateError, setScheduleHydrateError] = useState<string | null>(null);
  const [scheduleRetryTick, setScheduleRetryTick] = useState(0);
  // Hydrate the form at most once per task id; the shared catalog can refresh
  // mid-edit (SSE, post-save) and must not clobber in-progress form state.
  const hydratedTaskIdRef = useRef<string | null>(null);
  const pendingScheduleBaseRef = useRef<TaskFormState | null>(null);

  const retryScheduleHydrate = useCallback(() => {
    setScheduleRetryTick((n) => n + 1);
  }, []);

  // ----------------------------------------------------------
  // Edit mode hydration — load existing task data when taskId is present
  // ----------------------------------------------------------

  useEffect(() => {
    if (!taskId || hydratedTaskIdRef.current === taskId) return;
    // Resume unsaved session draft instead of clobbering with server task.
    if (hasMeaningfulChatEditorFormDraft(taskId)) return;
    if (tasksLoading) return;
    if (taskLoadError) {
      hydratedTaskIdRef.current = taskId;
      showToast(String(i18n.t("common:tasks.toast.loadFailedBlank")), "error");
      return;
    }
    const task = safeArray(tasks).find((t) => t.id === taskId);
    if (!task) return;
    hydratedTaskIdRef.current = taskId;
    const next = analysisTaskToFormState(task);
    if (task.analysisMode === "recurring") {
      pendingScheduleBaseRef.current = next;
      setScheduleHydrating(true);
      setScheduleHydrateError(null);
      void fetchTaskSchedule(taskId)
        .then((schedule) => {
          if (!isMountedRef.current || hydratedTaskIdRef.current !== taskId) return;
          setFormState(applyScheduleToFormState(next, schedule));
          setScheduleHydrateError(null);
        })
        .catch((error: unknown) => {
          if (!isMountedRef.current || hydratedTaskIdRef.current !== taskId) return;
          // Keep base task fields so the editor is usable; surface schedule error.
          setFormState(next);
          setScheduleHydrateError(toErrorMessage(error));
        })
        .finally(() => {
          if (!isMountedRef.current || hydratedTaskIdRef.current !== taskId) return;
          setScheduleHydrating(false);
        });
      return;
    }
    setScheduleHydrating(false);
    setScheduleHydrateError(null);
    setFormState(next);
  }, [taskId, tasks, tasksLoading, taskLoadError, setFormState, showToast, isMountedRef]);

  // Retry schedule subresource without re-hydrating the whole task form.
  useEffect(() => {
    if (scheduleRetryTick === 0) return;
    if (!taskId || !pendingScheduleBaseRef.current) return;
    const base = pendingScheduleBaseRef.current;
    setScheduleHydrating(true);
    setScheduleHydrateError(null);
    void fetchTaskSchedule(taskId)
      .then((schedule) => {
        if (!isMountedRef.current || hydratedTaskIdRef.current !== taskId) return;
        setFormState(applyScheduleToFormState(base, schedule));
        setScheduleHydrateError(null);
      })
      .catch((error: unknown) => {
        if (!isMountedRef.current || hydratedTaskIdRef.current !== taskId) return;
        setScheduleHydrateError(toErrorMessage(error));
      })
      .finally(() => {
        if (!isMountedRef.current || hydratedTaskIdRef.current !== taskId) return;
        setScheduleHydrating(false);
      });
  }, [scheduleRetryTick, taskId, setFormState, isMountedRef]);

  // ----------------------------------------------------------
  // save — create or update a task, then navigate to task list
  // ----------------------------------------------------------

  const save = useCallback(async () => {
    if (isSaving || scheduleHydrating) return;
    setIsSaving(true);

    try {
      const taskConfig = formStateToTaskConfig(formState);

      if (taskId) {
        const result = await updateTask(taskId, taskConfig);
        if (formState.analysisMode === "recurring") {
          await putTaskSchedule(taskId, formStateToTaskSchedule(formState));
        }
        if (!isMountedRef.current) return;
        showToast(String(i18n.t("common:tasks.toast.updated")), "success");
        if (result.deletedBatchCount > 0) {
          showToast(
            String(
              i18n.t("common:tasks.toast.clearedBatches", {
                count: result.deletedBatchCount,
              }),
            ),
            "info",
          );
        }
      } else {
        const created = await createTask(taskConfig);
        if (formState.analysisMode === "recurring") {
          await putTaskSchedule(created.id, formStateToTaskSchedule(formState));
        }
        if (!isMountedRef.current) return;
        showToast(String(i18n.t("common:tasks.toast.created")), "success");
      }

      if (!isMountedRef.current) return;
      clearChatEditorDrafts(taskId);
      // Refresh the task catalog so the list page shows the new/updated task immediately
      await refreshTasks().catch(() => {});
      if (!isMountedRef.current) return;
      navigate("/tasks");
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = handleCommandError(err, showToast);
      onError(message);
    } finally {
      if (!isMountedRef.current) return;
      setIsSaving(false);
    }
  }, [
    formState,
    taskId,
    isSaving,
    scheduleHydrating,
    navigate,
    showToast,
    isMountedRef,
    onError,
    refreshTasks,
  ]);

  return {
    save,
    isSaving,
    scheduleHydrating,
    scheduleHydrateError,
    retryScheduleHydrate,
  };
}
