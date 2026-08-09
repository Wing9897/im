import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisEvent, TimeWindow } from "../../../types";
import { usePersistedState } from "../../../hooks/usePersistedState";
import {
  computeDataRange,
  partitionByCoordinates,
} from "../../../domain/intelligence/mapFilters";
import {
  buildMapMarkerGroups,
  filterTimedMapEvents,
  sortTimedMapEvents,
} from "../../../domain/intelligence/mapPresentation";
import { captureError } from "../../../utils/errorReporter";
import {
  type DanmakuMode, type OverlayDisplayMode,
  EVENT_PANEL_MIN_HEIGHT, EVENT_PANEL_MAX_HEIGHT,
  LIVE_INFO_PANEL_MIN_HEIGHT, LIVE_INFO_PANEL_MAX_HEIGHT,
  clampHeight, readSharedDanmakuMode,
  cycleDanmakuMode, cycleOverlayDisplayMode,
  SHARED_DANMAKU_MODE_KEY,
} from "./mapViewHelpers";
import {
  MAP_EVENT_PANEL_HEIGHT_STORAGE_KEY,
  MAP_LIVE_INFO_PANEL_HEIGHT_STORAGE_KEY,
  MAP_OVERLAY_DISPLAY_MODE_STORAGE_KEY,
} from "../../../domain/prefs";
import { useMapLiveMessages } from "./useMapLiveMessages";
import { useMapViewTimeWindow } from "./useMapViewTimeWindow";

interface UseMapViewOptions {
  items: AnalysisEvent[];
  onFetchWindowChange?: (window: TimeWindow) => void;
}

/**
 * Map-local time / selection / overlay state.
 *
 * INVARIANTS:
 * - Owns the map TimeWindow (Live ± hours + scrub). Do not replace with the
 *   list/card `useTimeFilter` from `useIntelligenceFeed`.
 * - Scrub preview updates client filter only. API fetch ONLY via
 *   `commitFetchWindow` (gesture end) or live tick — never per scrub frame
 *   (see `useTimelineSliderInteraction`).
 * - `onFetchWindowChange` pushes the committed window up to the feed; scrub
 *   must not call it.
 * - Time/live data: `useMapViewTimeWindow`. Gestures: timeline slider hook.
 */
export function useMapView({ items, onFetchWindowChange }: UseMapViewOptions) {
  const { withCoords } = useMemo(() => partitionByCoordinates(items), [items]);
  // Pre-parse timestamps + sort once; scrub filters this list without re-sorting.
  const timedItemsDesc = useMemo(() => sortTimedMapEvents(withCoords), [withCoords]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sharedDanmakuMode, setSharedDanmakuMode] = usePersistedState<DanmakuMode>(
    SHARED_DANMAKU_MODE_KEY,
    readSharedDanmakuMode(),
  );
  const [overlayDisplayMode, setOverlayDisplayMode] = usePersistedState<OverlayDisplayMode>(
    MAP_OVERLAY_DISPLAY_MODE_STORAGE_KEY,
    "both",
  );
  const [eventPanelHeight, setEventPanelHeight] = usePersistedState<number>(
    MAP_EVENT_PANEL_HEIGHT_STORAGE_KEY,
    280,
  );
  const [liveInfoPanelHeight, setLiveInfoPanelHeight] = usePersistedState<number>(
    MAP_LIVE_INFO_PANEL_HEIGHT_STORAGE_KEY,
    180,
  );

  const { liveMessagesRecent, incomingLiveMessages } = useMapLiveMessages();

  const {
    liveWindowHours,
    setLiveWindowHours,
    liveMode,
    timeWindow,
    handleTimeWindowChange,
    commitFetchWindow,
    handleLiveModeToggle,
    exitLiveMode,
  } = useMapViewTimeWindow({ onFetchWindowChange });

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error: unknown) {
      captureError(error, { component: "MapView", severity: "warning" });
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const dataRange = useMemo(() => computeDataRange(withCoords), [withCoords]);
  const [selectedItem, setSelectedItem] = useState<AnalysisEvent | null>(null);
  const [clusterItems, setClusterItems] = useState<AnalysisEvent[] | null>(null);

  // Scrub updates `timeWindow` once per animation frame for client-side marker filtering only.
  // Do NOT call onFetchWindowChange here — that would hammer the API.
  // API fetch: applyLiveWindow (live) + commitFetchWindow (scrub mouseup / calendar).

  // One filter pass over the pre-sorted source — markers, danmaku, and event list share it.
  const filteredEventItems = useMemo(
    () => filterTimedMapEvents(timedItemsDesc, timeWindow),
    [timeWindow, timedItemsDesc],
  );
  const filteredItems = filteredEventItems;

  // Track every ID observed from the source, not just the currently filtered
  // subset. An existing item that leaves and later re-enters the time window
  // must not be announced as new again.
  const seenSourceItemIdsRef = useRef<Set<string>>(new Set());
  const sourceItemIds = useMemo(() => items.map((item) => item.id), [items]);
  const newItemIds = useMemo(() => {
    const seen = seenSourceItemIdsRef.current;
    return new Set(
      sourceItemIds.filter((id) => !seen.has(id)),
    );
  }, [sourceItemIds]);

  useEffect(() => {
    const seen = seenSourceItemIdsRef.current;
    for (const id of sourceItemIds) seen.add(id);
    // The Set is only a one-render signal for markers currently on screen.
    // Clearing it keeps an off-screen source item from pulsing when a later
    // scrub brings it into view, matching the prior "seen source" behavior.
    newItemIds.clear();
  }, [newItemIds, sourceItemIds]);

  const coordGroups = useMemo(() => buildMapMarkerGroups(filteredItems), [filteredItems]);
  const eventOverlayMode = overlayDisplayMode === "live-only" ? "off" : sharedDanmakuMode;
  const liveInfoOverlayMode = overlayDisplayMode === "event-only" ? "off" : sharedDanmakuMode;
  const resolvedEventPanelHeight = clampHeight(eventPanelHeight, EVENT_PANEL_MIN_HEIGHT, EVENT_PANEL_MAX_HEIGHT);
  const resolvedLiveInfoPanelHeight = clampHeight(liveInfoPanelHeight, LIVE_INFO_PANEL_MIN_HEIGHT, LIVE_INFO_PANEL_MAX_HEIGHT);

  const handleEventPanelHeightChange = useCallback((nextHeight: number) => {
    setEventPanelHeight(clampHeight(nextHeight, EVENT_PANEL_MIN_HEIGHT, EVENT_PANEL_MAX_HEIGHT));
  }, [setEventPanelHeight]);

  const handleLiveInfoPanelHeightChange = useCallback((nextHeight: number) => {
    setLiveInfoPanelHeight(clampHeight(nextHeight, LIVE_INFO_PANEL_MIN_HEIGHT, LIVE_INFO_PANEL_MAX_HEIGHT));
  }, [setLiveInfoPanelHeight]);

  const handleSingleClick = useCallback((item: AnalysisEvent) => { setClusterItems(null); setSelectedItem(item); }, []);
  const handleClusterClick = useCallback((items: AnalysisEvent[]) => { setSelectedItem(null); setClusterItems(items); }, []);
  const handleClusterSelect = useCallback((item: AnalysisEvent) => { setSelectedItem(item); }, []);
  const handleBackToCluster = useCallback(() => { setSelectedItem(null); }, []);
  const handleDetailClose = useCallback(() => { setSelectedItem(null); setClusterItems(null); }, []);

  const handleOverlayDisplayCycle = useCallback(() => {
    setOverlayDisplayMode((mode) => cycleOverlayDisplayMode(mode));
  }, [setOverlayDisplayMode]);

  const handleDanmakuModeCycle = useCallback(() => {
    setSharedDanmakuMode((mode) => cycleDanmakuMode(mode));
  }, [setSharedDanmakuMode]);

  return {
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
  };
}
