import type { Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { AnalysisEvent } from "../../types";
import { MapMarkers } from "../../components/map/MapMarkers";
import { CARTO_ATTR, CARTO_URL } from "../../domain/intelligence/mapTiles";

import { isMappableCoordinate } from "../../domain/intelligence/mapFilters";
import type { BoardFocusTarget } from "../boardFocusStore";
import { loadBoardMapViewFromCache } from "../boardPrefsStore";
import {
  BOARD_MAP_DEFAULT_CENTER,
  BOARD_MAP_DEFAULT_ZOOM,
  SHARED_MAP_CONTAINER_OPTIONS,
  buildMapMarkerGroups,
} from "../../domain/intelligence/mapPresentation";

const EMPTY_NEW = new Set<string>();

export {
  BOARD_MAP_DEFAULT_CENTER,
  BOARD_MAP_DEFAULT_ZOOM,
} from "../../domain/intelligence/mapPresentation";


type BoardMapViewState = {
  center: [number, number];
  zoom: number;
};

function MapInvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const run = () => {
      map.invalidateSize({ animate: false });
    };
    run();
    const timer = window.setTimeout(run, 80);
    // Maximize / immersive are CSS size changes — observe the stage, not only window.
    const stage = map.getContainer().closest(".board-widget-map__stage");
    let ro: ResizeObserver | null = null;
    if (stage && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => run());
      ro.observe(stage);
    }
    window.addEventListener("resize", run);
    return () => {
      window.clearTimeout(timer);
      ro?.disconnect();
      window.removeEventListener("resize", run);
    };
  }, [map]);
  return null;
}

/** Keeps a stable map ref for the parent save button. */
function MapRefBridge({ mapRef }: { mapRef: MutableRefObject<LeafletMap | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);
  return null;
}

/** Pan to a board-linked event without changing the user's saved map view. */
function MapFocusController({ target }: { target: BoardFocusTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target || target.lat == null || target.lon == null) return;
    map.setView([target.lat, target.lon], Math.max(map.getZoom(), 7), { animate: true });
  }, [map, target]);
  return null;
}

interface MapBoardEmbedProps {
  items: AnalysisEvent[];
  onMarkerClick: (item: AnalysisEvent) => void;
  mapRef?: MutableRefObject<LeafletMap | null>;
  /**
   * Layout instance id. On each mount, boot center/zoom from hydrated
   * `widgetState.mapViews[widgetId]` so maximize / pages↔canvas remounts
   * pick up the latest save (parent must not cache a one-shot initialView).
   */
  widgetId?: string;
  /** Explicit boot override (tests). When omitted, loads via `widgetId`. */
  initialView?: BoardMapViewState | null;
  focusTarget?: BoardFocusTarget | null;
}

/**
 * Resolve the camera used for a fresh MapContainer mount.
 * Prefer an explicit `initialView` override; otherwise read per-widgetId storage.
 */
export function resolveBoardMapBootView(
  widgetId: string | undefined,
  initialView?: BoardMapViewState | null,
): BoardMapViewState | null {
  if (initialView !== undefined) {
    return initialView;
  }
  if (widgetId) {
    const cached = loadBoardMapViewFromCache(widgetId);
    if (!cached || cached.center.length < 2) return null;
    return {
      center: [cached.center[0], cached.center[1]],
      zoom: cached.zoom,
    };
  }
  return null;
}

/**
 * Compact Leaflet shell for the ops board — no danmaku / slider / fullscreen.
 * Parent must size `.board-widget-map__stage` so height follows the grid cell.
 */
export function MapBoardEmbed({
  items,
  onMarkerClick,
  mapRef,
  widgetId,
  initialView,
  focusTarget = null,
}: MapBoardEmbedProps) {
  const { t } = useTranslation();
  const withCoords = useMemo(
    () => items.filter((item) => isMappableCoordinate(item.latitude, item.longitude)),
    [items],
  );
  const coordGroups = useMemo(() => buildMapMarkerGroups(withCoords), [withCoords]);
  // MapContainer only applies center/zoom on mount. BoardWidgetShell unmounts this
  // embed when `active` is false (maximize sibling / leave canvas), so re-read
  // storage here — do not rely on a parent useState captured at first paint.
  const bootView = resolveBoardMapBootView(widgetId, initialView);
  const center = bootView?.center ?? BOARD_MAP_DEFAULT_CENTER;
  const zoom = bootView?.zoom ?? BOARD_MAP_DEFAULT_ZOOM;
  const internalRef = useRef<LeafletMap | null>(null);
  const bridgeRef = mapRef ?? internalRef;

  const handleClusterClick = (cluster: AnalysisEvent[]) => {
    const first = cluster[0];
    if (first) {
      onMarkerClick(first);
    }
  };

  return (
    <div className="board-widget-map__stage" data-testid="board-map-embed">
      <MapContainer
        center={center}
        zoom={zoom}
        {...SHARED_MAP_CONTAINER_OPTIONS}
        attributionControl={false}
        className="board-widget-map__leaflet"
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} noWrap={false} />
        <MapInvalidateOnResize />
        <MapRefBridge mapRef={bridgeRef} />
        <MapFocusController target={focusTarget} />
        <MapMarkers
          coordGroups={coordGroups}
          onSingleClick={onMarkerClick}
          onClusterClick={handleClusterClick}
          newItemIds={EMPTY_NEW}
        />
      </MapContainer>
      {withCoords.length === 0 ? (
        <div className="board-widget-map__empty" aria-live="polite">
          {t("board.map.noCoordEvents")}
        </div>
      ) : null}
    </div>
  );
}
