/**
 * Workset CRUD, item counts, and catalog shell for DashboardViewer.
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { listItems } from "../../../api/items";
import { createWorkset, deleteWorkset, renameWorkset, updateWorkset } from "../../../api/worksets";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { useToast } from "../../../context/ToastContext";
import { subscribeResourceModified } from "../../../domain/sse/resourceModified";
import {
  SHOW_SYSTEM_TASKS_STORAGE_KEY,
  WORKSETS_SEARCH_STORAGE_KEY,
} from "../../../domain/tasks/systemTaskCatalog";
import {
  isWorksetsPath,
  worksetDetailPath,
} from "../../../domain/worksets/worksetRoutes";
import { usePersistedState } from "../../../hooks/usePersistedState";
import type { AnalysisTask } from "../../../types/tasks";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { toError } from "../../../utils/errors";
import {
  buildDashboardWorksetGroups,
  filterWorksetGroupsByName,
  type DashboardWorksetGroup,
} from "../dashboardViewerGroups";
import type { DashboardWorksetNameDialogState } from "../components/DashboardViewerDialogs";

type Args = {
  visibleTasks: AnalysisTask[];
  navigate: (path: string, opts?: { replace?: boolean }) => void;
};

export function useDashboardViewerShell({ visibleTasks, navigate }: Args) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { worksets, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const isWorksetView = isWorksetsPath(pathname);

  const [showSystemTasks, setShowSystemTasks] = usePersistedState(
    SHOW_SYSTEM_TASKS_STORAGE_KEY,
    false,
  );
  const [worksetSearchQuery, setWorksetSearchQuery] = usePersistedState(
    WORKSETS_SEARCH_STORAGE_KEY,
    "",
    {
      persistDebounceMs: 400,
      storage: "session",
    },
  );
  const deferredWorksetSearch = useDeferredValue(worksetSearchQuery);
  const [worksetNameDialog, setWorksetNameDialog] =
    useState<DashboardWorksetNameDialogState | null>(null);
  const [worksetNameBusy, setWorksetNameBusy] = useState(false);
  const [worksetDeleteTarget, setWorksetDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [worksetDeleting, setWorksetDeleting] = useState(false);
  const [itemCountByWorkset, setItemCountByWorkset] = useState<Map<string, number>>(
    () => new Map(),
  );

  // Soft-load item counts for workset cards; refresh on item SSE (no stamp bump).
  useEffect(() => {
    if (!isWorksetView) return;
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
  }, [isWorksetView, worksets]);

  const worksetGroups = useMemo(() => {
    if (!isWorksetView) return [];
    const groups = buildDashboardWorksetGroups({
      visibleTasks,
      worksets,
      t,
    });
    return filterWorksetGroupsByName(groups, deferredWorksetSearch);
  }, [isWorksetView, visibleTasks, worksets, t, deferredWorksetSearch]);

  const openCreateWorkset = useCallback(() => {
    setWorksetNameDialog({ mode: "create" });
  }, []);

  const handleRenameWorkset = useCallback(
    async (id: string, cleaned: string) => {
      try {
        await renameWorkset(id, cleaned);
        await refreshWorksets();
        showToast(t("workset:renamedToast", { name: cleaned }), "success");
      } catch (error) {
        showToast(toError(error).message, "error");
        throw error;
      }
    },
    [refreshWorksets, showToast, t],
  );

  const handleWorksetNameSubmit = useCallback(
    async (values: { name: string; emoji: string; description: string }) => {
      if (!worksetNameDialog) return;
      setWorksetNameBusy(true);
      const cleaned = values.name.trim();
      try {
        if (worksetNameDialog.mode === "create") {
          await createWorkset(cleaned, {
            emoji: values.emoji,
            description: values.description,
          });
          await refreshWorksets();
          showToast(t("workset:createdToast", { name: cleaned }), "success");
        } else {
          await updateWorkset(worksetNameDialog.id, {
            name: cleaned,
            emoji: values.emoji,
            description: values.description,
          });
          await refreshWorksets();
          showToast(t("workset:renamedToast", { name: cleaned }), "success");
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
      showToast(t("workset:deletedToast", { name: worksetDeleteTarget.name }), "success");
      setWorksetDeleteTarget(null);
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setWorksetDeleting(false);
    }
  }, [refreshWorksets, showToast, t, worksetDeleteTarget]);

  const openWorksetDetail = useCallback(
    (id: string) => {
      navigate(worksetDetailPath(id), { replace: false });
    },
    [navigate],
  );

  return {
    isWorksetView,
    showSystemTasks,
    setShowSystemTasks,
    worksetSearchQuery,
    setWorksetSearchQuery,
    worksetNameDialog,
    setWorksetNameDialog,
    worksetNameBusy,
    worksetDeleteTarget,
    setWorksetDeleteTarget,
    worksetDeleting,
    itemCountByWorkset,
    worksetGroups,
    openCreateWorkset,
    handleRenameWorkset,
    handleWorksetNameSubmit,
    confirmDeleteWorkset,
    openWorksetDetail,
  };
}

export type { DashboardWorksetGroup };
