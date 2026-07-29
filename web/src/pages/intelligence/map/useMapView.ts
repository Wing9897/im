import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisEvent, TimeWindow } from "../../../types";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import { usePersistedState } from "../../../hooks/usePersistedState";
import {
  computeDataRange,
  getEventTimestamp,
  partitionByCoordinates,
} from "../../../domain/intelligence/mapFilters";
import { captureError } from "../../../utils/errorReporter";
import {
  type DanmakuMode, type OverlayDisplayMode, ONE_HOUR,
  EVENT_PANEL_MIN_HEIGHT, EVENT_PANEL_MAX_HEIGHT,
  LIVE_INFO_PANEL_MIN_HEIGHT, LIVE_INFO_PANEL_MAX_HEIGHT,
  clampHeight, migrateSharedDanmakuModeStorage,
  cycleDanmakuMode, cycleOverlayDisplayMode,
  SHARED_DANMAKU_MODE_KEY,
  MAP_LIVE_MODE_STORAGE_KEY,
  MAP_TIME_WINDOW_STORAGE_KEY,
  readStoredMapTimeWindow,
  writeStoredMapTimeWindow,
} from "./mapViewHelpers";
import {
  MAP_EVENT_PANEL_HEIGHT_STORAGE_KEY,
  MAP_LIVE_INFO_PANEL_HEIGHT_STORAGE_KEY,
  MAP_LIVE_WINDOW_HOURS_STORAGE_KEY,
  MAP_OVERLAY_DISPLAY_MODE_STORAGE_KEY,
} from "./mapPersistedKeys";
import { groupByCoordinate } from "../../../domain/intelligence/groupByCoordinate";
import { useMapLiveMessages } from "./useMapLiveMessages";

interface UseMapViewOptions {
  items: AnalysisEvent[];
  onFetchWindowChange?: (window: TimeWindow) => void;
}

interface TimedItem {
  item: AnalysisEvent;
  timestamp: number;
}

function filterTimedItems(items: TimedItem[], window: TimeWindow): AnalysisEvent[] {
  const start = window.start.getTime();
  const end = window.end.getTime();
  const filtered: AnalysisEvent[] = [];
  for (const { item, timestamp } of items) {
    if (timestamp >= start && timestamp <= end) filtered.push(item);
  }
  return filtered;
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
 */
export function useMapView({ items, onFetchWindowChange }: UseMapViewOptions) {
  const { lastAnalysisEvent } = useAnalysisStatus();
  const { withCoords } = useMemo(() => partitionByCoordinates(items), [items]);
  // Pre-parse timestamps + sort once; scrub filters this list without re-sorting.
  const timedItemsDesc = useMemo<TimedItem[]>(
    () =>
      withCoords
        .map((item) => ({ item, timestamp: new Date(getEventTimestamp(item)).getTime() }))
        .sort((a, b) => b.timestamp - a.timestamp),
    [withCoords],
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sharedDanmakuMode, setSharedDanmakuMode] = usePersistedState<DanmakuMode>(
    SHARED_DANMAKU_MODE_KEY,
    migrateSharedDanmakuModeStorage(),
  );
  const [overlayDisplayMode, setOverlayDisplayMode] = usePersistedState<OverlayDisplayMode>(
    MAP_OVERLAY_DISPLAY_MODE_STORAGE_KEY,
    "both",
  );
  const [liveWindowHours, setLiveWindowHours] = usePersistedState<number>(
    MAP_LIVE_WINDOW_HOURS_STORAGE_KEY,
    12,
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
  const liveWindowMs = liveWindowHours * ONE_HOUR;

  const [liveMode, setLiveMode] = usePersistedState<boolean>(
    MAP_LIVE_MODE_STORAGE_KEY,
    true,
  );

  // Default to Live mode — show current time ±liveWindowHours so newly
  // arriving events are immediately visible without user interaction.
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    const liveDefault = () => {
      const now = Date.now();
      return { start: new Date(now - liveWindowMs), end: new Date(now + liveWindowMs) };
    };
    if (typeof window === "undefined") return liveDefault();
    try {
      const storedLive = window.localStorage.getItem(MAP_LIVE_MODE_STORAGE_KEY);
      const restoredLive =
        storedLive === null ? true : (JSON.parse(storedLive) as boolean);
      if (restoredLive) return liveDefault();
    } catch {
      return liveDefault();
    }
    return readStoredMapTimeWindow(MAP_TIME_WINDOW_STORAGE_KEY, liveDefault());
  });
  const restoredFetchRef = useRef(false);
  const [selectedItem, setSelectedItem] = useState<AnalysisEvent | null>(null);
  const [clusterItems, setClusterItems] = useState<AnalysisEvent[] | null>(null);

  const handleTimeWindowChange = useCallback((w: TimeWindow) => {
    setTimeWindow(w);
  }, []);

  const applyLiveWindow = useCallback(() => {
    const now = Date.now();
    const next: TimeWindow = {
      start: new Date(now - liveWindowMs),
      end: new Date(now + liveWindowMs),
    };
    setTimeWindow(next);
    // Live advances are intentional fetch points (not 50Hz scrub).
    onFetchWindowChange?.(next);
  }, [liveWindowMs, onFetchWindowChange]);

  /** Commit scrub / calendar / keyboard — one API fetch after the gesture. */
  const commitFetchWindow = useCallback(
    (w: TimeWindow) => {
      setTimeWindow(w);
      writeStoredMapTimeWindow(MAP_TIME_WINDOW_STORAGE_KEY, w);
      onFetchWindowChange?.(w);
    },
    [onFetchWindowChange],
  );

  const handleLiveModeToggle = useCallback(() => {
    setLiveMode((prev) => {
      if (!prev) {
        applyLiveWindow();
        return true;
      }
      setTimeWindow((current) => {
        writeStoredMapTimeWindow(MAP_TIME_WINDOW_STORAGE_KEY, current);
        return current;
      });
      return false;
    });
  }, [applyLiveWindow, setLiveMode]);

  /** Idempotent exit used by timeline drag / calendar — never toggles back on. */
  const exitLiveMode = useCallback(() => {
    setLiveMode(false);
    setTimeWindow((current) => {
      writeStoredMapTimeWindow(MAP_TIME_WINDOW_STORAGE_KEY, current);
      return current;
    });
  }, [setLiveMode]);

  useEffect(() => {
    if (liveMode) return;
    if (restoredFetchRef.current) return;
    restoredFetchRef.current = true;
    onFetchWindowChange?.(timeWindow);
  }, [liveMode, onFetchWindowChange, timeWindow]);

  useEffect(() => {
    if (liveMode) {
      applyLiveWindow();
    }
  }, [applyLiveWindow, liveMode]);

  // Re-center the live time window when analysis completes so new events
  // stay visible without a separate data refetch (handled by useIntelligenceFeed).
  useEffect(() => {
    if (!liveMode) return;
    if (!lastAnalysisEvent) return;
    if (lastAnalysisEvent.type !== "completed") return;

    applyLiveWindow();
  }, [lastAnalysisEvent, liveMode, applyLiveWindow]);

  // Advance the live time window every 60 seconds so the view stays current.
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => {
      applyLiveWindow();
    }, 60_000);
    return () => { clearInterval(interval); };
  }, [applyLiveWindow, liveMode]);

  // Scrub updates `timeWindow` once per animation frame for client-side marker filtering only.
  // Do NOT call onFetchWindowChange here — that would hammer the API.
  // API fetch: applyLiveWindow (live) + commitFetchWindow (scrub mouseup / calendar).

  // One filter pass over the pre-sorted source — markers, danmaku, and event list share it.
  const filteredEventItems = useMemo(
    () => filterTimedItems(timedItemsDesc, timeWindow),
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

  const coordGroups = useMemo(() => groupByCoordinate(filteredItems), [filteredItems]);
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
