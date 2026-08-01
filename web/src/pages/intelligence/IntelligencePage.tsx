import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "../../context/ToastContext";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useErrorToast } from "../../hooks/useErrorToast";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import type { AnalysisEvent } from "../../types";
import { IntelligenceToolbar } from "./IntelligenceToolbar";
import { useIntelligenceFeed } from "./useIntelligenceFeed";
import { useIntelligenceUrlState } from "./useIntelligenceUrlState";
import { INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY } from "../../domain/prefs";
import { useIdReadTracking } from "../../hooks/useIdReadTracking";
import { IntelligenceContentArea } from "./views/IntelligenceContentArea";

/**
 * Intelligence workspace shell (card / list / map).
 *
 * INVARIANTS — keep these in code, not a separate doc:
 * - Shared: feed hooks + toolbar + one events API.
 * - Forked UI: list/card (`IntelligenceListPane`) vs map (`map/MapView`) —
 *   do NOT merge into one “universal” view (time ownership, has_coords,
 *   pagination, and detail/selection differ on purpose).
 * - Mode switch must not reopen the other mode’s detail/selection.
 * Regression fences: `useIntelligenceFeed.test.ts`, `IntelligencePage.test.tsx`.
 */
/** Shared shell padding / toolbar height (same in map mode). */
const intelligencePageClass = "im-intelligence-page";

export function IntelligencePage() {
  const { t } = useTranslation("intelligence");
  const feed = useIntelligenceFeed();
  const { worksets, tasks } = useTaskCatalog();
  const { showToast } = useToast();
  useErrorToast(feed.pageError);
  useSlashFocusSearch(!feed.loading);
  const {
    readIdSet: readIntelligenceIdSet,
    isConsumed,
    markRead: handleAutoRead,
  } = useIdReadTracking(INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY);

  const [selectedItem, setSelectedItem] = useState<AnalysisEvent | null>(null);
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null);
  const [resetViewTrigger, setResetViewTrigger] = useState(0);

  const handleSelectedIdFromUrl = useCallback((id: string | null) => {
    setPendingSelectedId(id);
  }, []);

  useIntelligenceUrlState({
    viewMode: feed.viewMode,
    setViewMode: feed.setViewMode,
    search: feed.debouncedSearch,
    setSearch: feed.setSearch,
    selectedId: selectedItem?.id ?? null,
    allowClearSelectedId: pendingSelectedId == null,
    onSelectedIdFromUrl: handleSelectedIdFromUrl,
  });

  useEffect(() => {
    if (!pendingSelectedId || feed.loading || feed.loadingMore) return;
    const found = feed.allItems.find((item) => item.id === pendingSelectedId);
    if (found) {
      setSelectedItem(found);
      setPendingSelectedId(null);
      return;
    }
    // More pages may still contain the id — keep pending (do not clear selection).
    if (feed.hasMore) return;

    // Exhausted feed with no match: clear pending + selection so URL sync does not
    // write a stale selectedItem id back over the deep-link.
    setPendingSelectedId(null);
    setSelectedItem(null);
    showToast(t("toast.itemNotFound"), "warning");
  }, [
    feed.allItems,
    feed.hasMore,
    feed.loading,
    feed.loadingMore,
    pendingSelectedId,
    showToast,
    t,
  ]);

  useEffect(() => {
    if (feed.isMapMode) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [feed.isMapMode]);

  const handleResetView = useCallback(() => {
    setResetViewTrigger((n) => n + 1);
  }, []);

  return (
    <div className={intelligencePageClass}>
      <IntelligenceToolbar
        isBusy={feed.isBusy}
        search={feed.search}
        setSearch={feed.setSearch}
        viewMode={feed.viewMode}
        setViewMode={feed.setViewMode}
        timeFilterPreset={feed.selectedPreset}
        onTimeFilterChange={feed.setPreset}
        sortMode={feed.sortMode}
        onSortModeChange={feed.setSortMode}
        selectedSources={feed.selectedSources}
        setSelectedSources={feed.setSelectedSources}
        intelligenceTasks={feed.intelligenceTasks}
        worksets={worksets.map((ws) => ({ id: ws.id, name: ws.name }))}
        expandTasks={tasks.map((task) => ({
          id: task.id,
          name: task.name,
          worksetId: task.worksetId ?? null,
          analysisMode: task.analysisMode ?? null,
        }))}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <IntelligenceContentArea
          feed={feed}
          read={{ readIntelligenceIdSet, isConsumed, onAutoRead: handleAutoRead }}
          selection={{ selectedItem, setSelectedItem }}
          mapUi={{ resetViewTrigger, onResetView: handleResetView }}
        />
      </div>
    </div>
  );
}
