import { useCallback, useContext, useEffect, useState } from "react";
import {
  deleteAction,
  listActions,
  testAction,
  toggleAction,
} from "../../../api/actions";
import { ToastContext } from "../../../context/ToastContext";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { useAsyncResource } from "../../../hooks/useAsyncResource";
import i18n from "../../../i18n";
import type { Action } from "../../../types";
import { toErrorMessage } from "../../../utils/errors";
import { logWarn } from "../../../utils/logger";

export function useActionsPage() {
  // Context used directly (not via useToast) so tests can mount without a
  // ToastProvider — same pattern as useAsyncResource.
  const toastContext = useContext(ToastContext);

  const [actions, setActions] = useState<Action[]>([]);
  const { tasks, taskLoadError } = useTaskCatalog();

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Action | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Action | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    data: actionsData,
    initialLoading,
    isRefreshing,
    error,
    execute: executeFetchActions,
  } = useAsyncResource<void, Action[]>(listActions, { toastOnError: false });

  // Keep the mutable actions list in sync with the latest fetch; optimistic
  // toggle updates below mutate the local copy.
  useEffect(() => {
    if (actionsData) setActions(actionsData);
  }, [actionsData]);

  const fetchActions = useCallback(async () => {
    await executeFetchActions(undefined);
  }, [executeFetchActions]);

  useEffect(() => {
    void executeFetchActions(undefined);
  }, [executeFetchActions]);

  useEffect(() => {
    if (taskLoadError) {
      logWarn("[useActionsPage] failed to load tasks for dropdown", taskLoadError);
    }
  }, [taskLoadError]);

  // Optimistic toggle
  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isEnabled: enabled } : a)),
      );
      try {
        await toggleAction(id);
      } catch (e) {
        // Revert
        setActions((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isEnabled: !enabled } : a)),
        );
        toastContext?.showToast(toErrorMessage(e), "error");
      }
    },
    [toastContext],
  );

  const handleEdit = useCallback((action: Action) => {
    setEditTarget(action);
    setFormOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditTarget(null);
    setFormOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setEditTarget(null);
  }, []);

  const handleFormSaved = useCallback(() => {
    void fetchActions();
  }, [fetchActions]);

  const handleDeleteClick = useCallback((action: Action) => {
    setDeleteTarget(action);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAction(deleteTarget.id);
      setDeleteTarget(null);
      void fetchActions();
    } catch (e) {
      toastContext?.showToast(toErrorMessage(e), "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchActions, toastContext]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleTest = useCallback(async (action: Action) => {
    toastContext?.showToast(i18n.t("actions:toast.testSending"), "info");
    try {
      const result = await testAction(action.id);
      if (result.success) {
        toastContext?.showToast(i18n.t("actions:toast.testSuccess"), "success");
      } else {
        toastContext?.showToast(result.error ?? i18n.t("actions:toast.testFailed"), "error");
      }
    } catch (e) {
      toastContext?.showToast(toErrorMessage(e), "error");
    }
  }, [toastContext]);

  return {
    actions,
    tasks,
    initialLoading,
    isRefreshing,
    error,
    formOpen,
    editTarget,
    deleteTarget,
    deleting,
    handleToggle,
    handleEdit,
    handleCreate,
    handleFormClose,
    handleFormSaved,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleTest,
    fetchActions,
  };
}
