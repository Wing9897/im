/**
 * Workset CRUD, item counts, deep-link, and grouping shell for DashboardViewer.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { listItems } from "../../api/items";
import { createWorkset, deleteWorkset, renameWorkset } from "../../api/worksets";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import { subscribeResourceModified } from "../../domain/sse/resourceModified";
import {
  SHOW_SYSTEM_TASKS_STORAGE_KEY,
  SHOW_SYSTEM_WORKSETS_STORAGE_KEY,
  TASKS_GROUPING_VIEW_STORAGE_KEY,
  isTasksGroupingView,
  type TasksGroupingView,
} from "../../domain/tasks/systemTaskCatalog";
import { usePersistedEnum, usePersistedState } from "../../hooks/usePersistedState";
import type { AnalysisTask } from "../../types/tasks";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { toError } from "../../utils/errors";
import {
  buildDashboardWorksetGroups,
  type DashboardWorksetGroup,
} from "./dashboardViewerGroups";
import type { DashboardWorksetNameDialogState } from "./DashboardViewerDialogs";

type Args = {
  visibleTasks: AnalysisTask[];
  navigate: (path: string, opts?: { replace?: boolean }) => void;
};

export function useDashboardViewerShell({ visibleTasks, navigate }: Args) {
  const { t } = useTranslation();
  const { worksetId: routeWorksetId } = useParams<{ worksetId?: string }>();
  const { worksets, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();

  const [groupingView, setGroupingView] = usePersistedEnum<TasksGroupingView>(
    TASKS_GROUPING_VIEW_STORAGE_KEY,
    "by_task",
    isTasksGroupingView,
  );
  const [showSystemTasks, setShowSystemTasks] = usePersistedState(
    SHOW_SYSTEM_TASKS_STORAGE_KEY,
    false,
  );
  const [showSystemWorksets, setShowSystemWorksets] = usePersistedState(
    SHOW_SYSTEM_WORKSETS_STORAGE_KEY,
    true,
  );
  const [worksetNameDialog, setWorksetNameDialog] =
    useState<DashboardWorksetNameDialogState | null>(null);
  const [worksetNameBusy, setWorksetNameBusy] = useState(false);
  const [worksetDeleteTarget, setWorksetDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [worksetDeleting, setWorksetDeleting] = useState(false);
  const [detailWorksetId, setDetailWorksetId] = useState<string | null>(null);
  const [itemCountByWorkset, setItemCountByWorkset] = useState<Map<string, number>>(
    () => new Map(),
  );

  // Soft-load item counts for workset cards; refresh on item SSE (no stamp bump).
  useEffect(() => {
    if (groupingView !== "by_workset") return;
    let cancelled = false;
    const reloadCounts = () => {
      void listItems()
        .then((rows) => {
          if (cancelled) return;
          const counts = new Map<string, number>();
          for (const row of rows) {
            if (row.status === "archived") continue;
            const wid = row.worksetId || SYSTEM_WORKSET_ID;
            counts.set(wid, (counts.get(wid) ?? 0) + 1);
          }
          setItemCountByWorkset(counts);
        })
        .catch(() => {
          if (!cancelled) setItemCountByWorkset(new Map());
        });
    };
    reloadCounts();
    const unsubscribe = subscribeResourceModified((detail) => {
      if (detail.resourceType !== "item" && detail.resourceType !== "item_category") {
        return;
      }
      reloadCounts();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [groupingView, worksets]);

  // Deep link: /tasks/worksets/:worksetId
  useEffect(() => {
    if (!routeWorksetId) return;
    setGroupingView("by_workset");
    setDetailWorksetId(routeWorksetId);
  }, [routeWorksetId, setGroupingView]);

  const worksetGroups = useMemo(
    () =>
      groupingView === "by_workset"
        ? buildDashboardWorksetGroups({
            visibleTasks,
            worksets,
            showSystemWorksets,
            t,
          })
        : [],
    [groupingView, visibleTasks, worksets, t, showSystemWorksets],
  );

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

  const openWorksetDetail = useCallback(
    (id: string) => {
      setDetailWorksetId(id);
      navigate(`/tasks/worksets/${encodeURIComponent(id)}`, { replace: false });
    },
    [navigate],
  );

  const closeWorksetDetail = useCallback(() => {
    setDetailWorksetId(null);
    if (routeWorksetId) {
      navigate("/tasks", { replace: true });
    }
  }, [navigate, routeWorksetId]);

  const detailWorkset = useMemo(() => {
    if (!detailWorksetId) return null;
    const group = worksetGroups.find((g) => g.key === detailWorksetId);
    if (group) {
      return {
        id: group.key,
        title: group.title,
        isSystem: group.isSystem,
        tasks: group.tasks,
      };
    }
    const ws = worksets.find((w) => w.id === detailWorksetId);
    if (!ws) return null;
    return {
      id: ws.id,
      title: ws.id === SYSTEM_WORKSET_ID ? t("workset.generalName") : ws.name,
      isSystem: Boolean(ws.isSystem) || ws.id === SYSTEM_WORKSET_ID,
      tasks: visibleTasks.filter((task) => task.worksetId === ws.id),
    };
  }, [detailWorksetId, worksetGroups, worksets, visibleTasks, t]);

  return {
    groupingView,
    setGroupingView,
    showSystemTasks,
    setShowSystemTasks,
    showSystemWorksets,
    setShowSystemWorksets,
    worksetNameDialog,
    setWorksetNameDialog,
    worksetNameBusy,
    worksetDeleteTarget,
    setWorksetDeleteTarget,
    worksetDeleting,
    itemCountByWorkset,
    worksetGroups,
    detailWorkset,
    openCreateWorkset,
    handleWorksetNameSubmit,
    confirmDeleteWorkset,
    openWorksetDetail,
    closeWorksetDetail,
  };
}

export type { DashboardWorksetGroup };
