import { useCallback, useEffect, useRef, useState } from "react";
import type { TimeWindow } from "../../../types";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import { usePersistedState } from "../../../hooks/usePersistedState";
import {
  ONE_HOUR,
  MAP_LIVE_MODE_STORAGE_KEY,
  MAP_TIME_WINDOW_STORAGE_KEY,
  readStoredMapTimeWindow,
  writeStoredMapTimeWindow,
} from "./mapViewHelpers";
import { MAP_LIVE_WINDOW_HOURS_STORAGE_KEY } from "../../../domain/prefs";

type Options = {
  onFetchWindowChange?: (window: TimeWindow) => void;
};

/**
 * Map time-window + live-mode data (fetch commits).
 * Overlay / selection chrome stays in `useMapView`.
 */
export function useMapViewTimeWindow({ onFetchWindowChange }: Options) {
  const { lastAnalysisEvent } = useAnalysisStatus();
  const [liveWindowHours, setLiveWindowHours] = usePersistedState<number>(
    MAP_LIVE_WINDOW_HOURS_STORAGE_KEY,
    12,
  );
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
  /** Last window applied by the live path — dedupes same-tick re-applies (no state/fetch jitter). */
  const lastLiveWindowRef = useRef<{ startMs: number; endMs: number } | null>(null);

  const handleTimeWindowChange = useCallback((w: TimeWindow) => {
    lastLiveWindowRef.current = null;
    setTimeWindow(w);
  }, []);

  const applyLiveWindow = useCallback(() => {
    const now = Date.now();
    const next: TimeWindow = {
      start: new Date(now - liveWindowMs),
      end: new Date(now + liveWindowMs),
    };
    const prev = lastLiveWindowRef.current;
    if (
      prev &&
      prev.startMs === next.start.getTime() &&
      prev.endMs === next.end.getTime()
    ) {
      return;
    }
    lastLiveWindowRef.current = {
      startMs: next.start.getTime(),
      endMs: next.end.getTime(),
    };
    setTimeWindow(next);
    // Live advances are intentional fetch points (not 50Hz scrub).
    onFetchWindowChange?.(next);
  }, [liveWindowMs, onFetchWindowChange]);

  /** Commit scrub / calendar / keyboard — one API fetch after the gesture. */
  const commitFetchWindow = useCallback(
    (w: TimeWindow) => {
      lastLiveWindowRef.current = null;
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
    lastLiveWindowRef.current = null;
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
    return () => {
      clearInterval(interval);
    };
  }, [applyLiveWindow, liveMode]);

  return {
    liveWindowHours,
    setLiveWindowHours,
    liveMode,
    timeWindow,
    handleTimeWindowChange,
    commitFetchWindow,
    handleLiveModeToggle,
    exitLiveMode,
  };
}
