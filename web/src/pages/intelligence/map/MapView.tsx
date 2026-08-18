import React from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer } from "react-leaflet";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyStateGlyph } from "../../../components/common/EmptyStateGlyph";
import type { AnalysisEvent, TimeWindow } from "../../../types";
import {
  mapContainerClass,
  mapEmptyMsgClass,
  mapEmptyOverlayClass,
  mapBottomBarClass,
  mapLeafletFillClass,
  mapResetViewBtnClass,
  mapStageClass,
  mapStageFullscreenClass,
} from "./mapViewClasses";
import {
  CARTO_URL,
  CARTO_ATTR,
} from "./mapViewHelpers";
import {
  INTELLIGENCE_MAP_DEFAULT_CENTER,
  INTELLIGENCE_MAP_DEFAULT_ZOOM,
  SHARED_MAP_CONTAINER_OPTIONS,
} from "../../../domain/intelligence/mapPresentation";
import { ResetViewController } from "./ResetViewController";
import { DetailCard } from "./DetailCard";
import { ClusterList } from "./ClusterList";
import {
  EventDanmakuPersistent,
  EventDanmakuTransient,
  LiveInfoDanmakuPersistent,
  LiveInfoDanmakuTransient,
} from "./DanmakuOverlay";
import { TimelineSlider } from "./TimelineSlider";
import { useMapView } from "./useMapView";
import { MapMarkers } from "../../../components/map/MapMarkers";
import { MapControls } from "./MapControls";

/**
 * Map-only UI tree (Leaflet, timeline, Live, map DetailCard). List/card live
 * in `views/IntelligenceListPane`. Share feed data via props — do not merge
 * panes. Scrub ≠ fetch: only `commitFetchWindow` / live tick hit the API.
 */
interface MapViewProps {
  items: AnalysisEvent[];
  resetViewTrigger: number;
  onResetView: () => void;
  onFetchWindowChange?: (window: TimeWindow) => void;
}

function MapViewComponent({
  items,
  resetViewTrigger,
  onResetView,
  onFetchWindowChange,
}: MapViewProps) {
  const { t } = useTranslation("intelligence");
  const {
    containerRef,
    isFullscreen,
    toggleFullscreen,
    withCoords,
    dataRange,
    timeWindow,
    handleTimeWindowChange,
    commitFetchWindow,
    liveMode,
    handleLiveModeToggle,
    exitLiveMode,
    filteredItems,
    filteredEventItems,
    liveMessagesRecent,
    incomingLiveMessages,
    newItemIds,
    coordGroups,
    eventOverlayMode,
    liveInfoOverlayMode,
    resolvedEventPanelHeight,
    handleEventPanelHeightChange,
    resolvedLiveInfoPanelHeight,
    handleLiveInfoPanelHeightChange,
    selectedItem,
    clusterItems,
    setClusterItems,
    handleSingleClick,
    handleClusterClick,
    handleClusterSelect,
    handleBackToCluster,
    handleDetailClose,
    overlayDisplayMode,
    handleOverlayDisplayCycle,
    sharedDanmakuMode,
    handleDanmakuModeCycle,
    liveWindowHours,
    setLiveWindowHours,
  } = useMapView({ items, onFetchWindowChange });

  const fullContainerClassName = isFullscreen
    ? "im-fs-atmosphere relative flex h-screen w-screen flex-col"
    : `im-fs-atmosphere ${mapContainerClass}`;

  return (
    <div ref={containerRef} className={fullContainerClassName}>
      {/* Map area */}
      <div className={isFullscreen ? mapStageFullscreenClass : mapStageClass}>
        <MapContainer
          center={INTELLIGENCE_MAP_DEFAULT_CENTER}
          zoom={INTELLIGENCE_MAP_DEFAULT_ZOOM}
          {...SHARED_MAP_CONTAINER_OPTIONS}
          className={mapLeafletFillClass}
          style={{ width: "100%", height: "100%" }}
          maxBoundsViscosity={0}
        >
          <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} noWrap={false} />
          <ResetViewController trigger={resetViewTrigger} />
          <MapMarkers
            coordGroups={coordGroups}
            onSingleClick={handleSingleClick}
            onClusterClick={handleClusterClick}
            newItemIds={newItemIds}
          />
        </MapContainer>

        {eventOverlayMode === "persistent" && (
          <EventDanmakuPersistent
            items={filteredEventItems}
            height={resolvedEventPanelHeight}
            onHeightChange={handleEventPanelHeightChange}
          />
        )}
        {eventOverlayMode === "transient" && <EventDanmakuTransient filteredItems={filteredItems} newItemIds={newItemIds} />}
        {liveInfoOverlayMode === "persistent" && (
          <LiveInfoDanmakuPersistent
            messages={liveMessagesRecent}
            height={resolvedLiveInfoPanelHeight}
            onHeightChange={handleLiveInfoPanelHeightChange}
          />
        )}
        {liveInfoOverlayMode === "transient" && <LiveInfoDanmakuTransient messages={incomingLiveMessages} />}

        {/* Reset view button — bottom-right, above Leaflet attribution */}
        <button type="button" onClick={onResetView} aria-label={t("map.resetViewAria")}
          className={mapResetViewBtnClass}>
          ⊕
        </button>

        {clusterItems && !selectedItem && <ClusterList items={clusterItems} onSelect={handleClusterSelect} onClose={() => setClusterItems(null)} />}
        {selectedItem && <DetailCard item={selectedItem} onBack={clusterItems ? handleBackToCluster : undefined} onClose={handleDetailClose} />}
        {items.length > 0 && withCoords.length === 0 && (
          <div className={mapEmptyOverlayClass}>
            <div className={`${mapEmptyMsgClass} flex flex-col items-center text-center`}>
              <div className="mb-sm">
                <EmptyStateGlyph icon={MapPin} />
              </div>
              {t("map.emptyTitle")}
              <span className="mt-1 block text-[0.92em] font-normal opacity-85">
                {t("map.emptyHint")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar: slider + controls */}
      <div className={mapBottomBarClass} onWheel={(e) => e.stopPropagation()}>
        <TimelineSlider dataRange={dataRange} timeWindow={timeWindow}
          onTimeWindowChange={handleTimeWindowChange}
          onCommitFetchWindow={commitFetchWindow}
          liveMode={liveMode}
          onLiveModeToggle={handleLiveModeToggle} onExitLiveMode={exitLiveMode}
          liveWindowHours={liveWindowHours}
          liveDisabled={false}
          eventCount={filteredItems.length}
          extraControls={
            <MapControls
              overlayDisplayMode={overlayDisplayMode}
              onOverlayDisplayCycle={handleOverlayDisplayCycle}
              sharedDanmakuMode={sharedDanmakuMode}
              onDanmakuModeCycle={handleDanmakuModeCycle}
              liveWindowHours={liveWindowHours}
              onLiveWindowHoursChange={setLiveWindowHours}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => void toggleFullscreen()}
            />
          }
        />
      </div>
    </div>
  );
}

export const MapView = React.memo(MapViewComponent);

