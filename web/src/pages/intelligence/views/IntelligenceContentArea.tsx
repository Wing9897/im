import React from "react";
import { useTranslation } from "react-i18next";
import { LazyLoadErrorBoundary } from "../../../components/common/LazyLoadErrorBoundary";
import { AlertBanner, Button } from "../../../components/ui";
import type { AnalysisEvent } from "../../../types";
import { getMapSyncCapHint } from "../intelligenceFeedConfig";
import type { useIntelligenceFeed } from "../useIntelligenceFeed";
import { MapPlaceholder } from "./MapPlaceholder";
import { IntelligenceListPane } from "./IntelligenceListPane";

const LazyMapView = React.lazy(() => import("../map/MapView").then((m) => ({ default: m.MapView })));

const mapPaneClass = "flex h-full min-h-0 flex-1 flex-col";

type IntelligenceFeed = ReturnType<typeof useIntelligenceFeed>;

/**
 * Branches map vs list/card UI trees. Keep them separate: map owns Leaflet /
 * timeline / Live; list/card owns infinite scroll + modal detail. Shared feed
 * props only — do not merge panes into one component to “simplify”.
 */
interface IntelligenceContentAreaProps {
  feed: Pick<
    IntelligenceFeed,
    | "isMapMode"
    | "loading"
    | "items"
    | "allItems"
    | "viewMode"
    | "hasMore"
    | "loadMoreHint"
    | "loadingMore"
    | "loadMoreItems"
    | "loadMoreMapBatch"
    | "setLoadMoreTriggerRef"
    | "intelligenceTasks"
    | "hasActiveFilters"
    | "hasSearchFilter"
    | "hasTimeFilter"
    | "resetFilters"
    | "handleMapFetchWindowChange"
    | "mapSyncAtCap"
    | "mapSyncing"
  >;
  read: {
    readIntelligenceIdSet: Set<string>;
    isConsumed: (itemId: string) => boolean;
    onAutoRead: (id: string) => void;
  };
  selection: {
    selectedItem: AnalysisEvent | null;
    setSelectedItem: (item: AnalysisEvent | null) => void;
  };
  mapUi: {
    resetViewTrigger: number;
    onResetView: () => void;
  };
}

function IntelligenceContentAreaComponent({
  feed,
  read,
  selection,
  mapUi,
}: IntelligenceContentAreaProps) {
  const { t } = useTranslation("intelligence");
  const mapBatchBusy = feed.loadingMore || feed.mapSyncing;

  return (
    <>
      {feed.isMapMode && (
        <div className={mapPaneClass}>
          {feed.mapSyncAtCap ? (
            <AlertBanner
              variant="warning"
              className="mb-sm flex shrink-0 items-center justify-between gap-md text-xs font-normal"
              data-testid="map-sync-cap-hint"
            >
              <span className="min-w-0 flex-1">{getMapSyncCapHint(t)}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                data-testid="map-load-next-batch"
                aria-label={t("map.loadNextBatchAria")}
                disabled={mapBatchBusy}
                onClick={() => void feed.loadMoreMapBatch()}
              >
                {mapBatchBusy ? t("map.loadNextBatchLoading") : t("map.loadNextBatch")}
              </Button>
            </AlertBanner>
          ) : null}
          <LazyLoadErrorBoundary fallbackHeight="100%">
            <React.Suspense fallback={<MapPlaceholder />}>
              <LazyMapView
                items={feed.allItems}
                resetViewTrigger={mapUi.resetViewTrigger}
                onResetView={mapUi.onResetView}
                onFetchWindowChange={feed.handleMapFetchWindowChange}
              />
            </React.Suspense>
          </LazyLoadErrorBoundary>
        </div>
      )}

      {!feed.isMapMode && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <IntelligenceListPane
            loading={feed.loading}
            items={feed.items}
            viewMode={feed.viewMode}
            hasMore={feed.hasMore}
            loadMoreHint={feed.loadMoreHint}
            loadingMore={feed.loadingMore}
            readIntelligenceIdSet={read.readIntelligenceIdSet}
            isConsumed={read.isConsumed}
            onAutoRead={read.onAutoRead}
            selectedItem={selection.selectedItem}
            setSelectedItem={selection.setSelectedItem}
            loadMoreItems={feed.loadMoreItems}
            setLoadMoreTriggerRef={feed.setLoadMoreTriggerRef}
            intelligenceTasksCount={feed.intelligenceTasks.length}
            hasActiveFilters={feed.hasActiveFilters}
            hasSearchFilter={feed.hasSearchFilter}
            hasTimeFilter={feed.hasTimeFilter}
            resetFilters={feed.resetFilters}
          />
        </div>
      )}
    </>
  );
}

export const IntelligenceContentArea = React.memo(IntelligenceContentAreaComponent);
