import { LocateFixed, Save } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import type { Map as LeafletMap } from "leaflet";
import { fetchEvents } from "../../api/results";
import { ANALYSIS_EVENTS_MODES } from "../../domain/tasks/analysisModeCapabilities";
import { useRefreshOnAnalysisEvent } from "../../hooks/useRefreshOnAnalysisEvent";
import type { AnalysisEvent } from "../../types";
import { useBoardWidgetHeaderActions } from "../BoardWidgetFrame";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";
import {
  BOARD_MAP_DEFAULT_CENTER,
  BOARD_MAP_DEFAULT_ZOOM,
} from "../embeds/mapBoardDefaults";
import {
  clearBoardMapViewInApi,
  saveBoardMapViewToApi,
} from "../boardPrefsStore";
import {
  focusBoardEvent,
  getBoardFocusTarget,
  subscribeBoardFocus,
} from "../boardFocusStore";
import { untitledLabel } from "../boardLabels";

const LazyMapBoardEmbed = lazy(() =>
  import("../embeds/MapBoardEmbed").then((m) => ({ default: m.MapBoardEmbed })),
);

const MAP_EMBED_LIMIT = 80;

/** Compact map embed: Leaflet markers; gated on `active` so maximize siblings do not mount Leaflet. */
export function MapBoardWidget({ active = true, widgetId }: BoardWidgetProps) {
  if (!widgetId) {
    throw new Error("MapBoardWidget requires a non-empty widgetId");
  }
  const { t } = useTranslation();
  const mapRef = useRef<LeafletMap | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const focusTarget = useSyncExternalStore(
    subscribeBoardFocus,
    getBoardFocusTarget,
    getBoardFocusTarget,
  );

  const fetcher = useCallback(
    () =>
      fetchEvents({
        hasCoords: true,
        limit: MAP_EMBED_LIMIT,
        offset: 0,
        includeTotal: false,
      }).then((page) => page.items),
    [],
  );
  const { data: items, error, loading, refresh } = useBoardWidgetPoll<AnalysisEvent[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );
  useRefreshOnAnalysisEvent(refresh, { analysisMode: ANALYSIS_EVENTS_MODES });

  const onMarkerClick = useCallback((item: AnalysisEvent) => {
    focusBoardEvent({
      eventId: item.id,
      lat: item.latitude ?? undefined,
      lon: item.longitude ?? undefined,
      title: item.title || untitledLabel(),
      body: item.body,
      location: item.location,
    });
  }, []);

  const saveView = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const c = map.getCenter();
    saveBoardMapViewToApi(widgetId, { center: [c.lat, c.lng], zoom: map.getZoom() });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  }, [widgetId]);

  const resetWorldView = useCallback(() => {
    const map = mapRef.current;
    clearBoardMapViewInApi(widgetId);
    if (!map) {
      return;
    }
    map.setView(BOARD_MAP_DEFAULT_CENTER, BOARD_MAP_DEFAULT_ZOOM, { animate: true });
  }, [widgetId]);

  const headerActions = useMemo(
    () => (
      <>
        <button
          type="button"
          className="board-widget-frame__btn"
          title={t("board.mapWidget.resetView")}
          aria-label={t("board.mapWidget.resetView")}
          data-testid="board-map-reset-view"
          onClick={resetWorldView}
        >
          <LocateFixed size={12} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={
            savedFlash
              ? "board-widget-frame__btn board-widget-frame__btn--active"
              : "board-widget-frame__btn"
          }
          title={t("board.mapWidget.saveView")}
          aria-label={t("board.mapWidget.saveView")}
          data-testid="board-map-save-view"
          onClick={saveView}
        >
          <Save size={12} strokeWidth={2} aria-hidden="true" />
        </button>
      </>
    ),
    [resetWorldView, saveView, savedFlash, t],
  );
  useBoardWidgetHeaderActions(headerActions);

  return (
    <div className="board-widget-body board-widget-map" data-testid="board-map-widget">
      <BoardWidgetShell
        active={active}
        pausedLabel={t("board.common.paused", { name: t("board.mapWidget.pausedName") })}
        pausedTestId="board-map-paused"
        loading={loading && !items}
        error={!items ? error : null}
        onRetry={refresh}
      >
        <Suspense fallback={<p className="board-widget-muted">{t("board.common.loadingMap")}</p>}>
          <LazyMapBoardEmbed
            widgetId={widgetId}
            items={items ?? []}
            onMarkerClick={onMarkerClick}
            mapRef={mapRef}
            focusTarget={focusTarget}
          />
        </Suspense>
      </BoardWidgetShell>
    </div>
  );
}
