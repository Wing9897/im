import { useCallback, useEffect, useMemo, useState } from "react";
import type { TimeWindow } from "../types";
import type { TimeFilterPreset } from "../components/TimeFilter";
import { INTELLIGENCE_TIME_PRESET_STORAGE_KEY } from "../domain/prefs";

/** List/card toolbar time preset (Intelligence feed). */
export { INTELLIGENCE_TIME_PRESET_STORAGE_KEY };

const TIME_FILTER_PRESET_VALUES: readonly TimeFilterPreset[] = [
  "today",
  "1d",
  "7d",
  "30d",
];

export function isTimeFilterPreset(value: unknown): value is TimeFilterPreset {
  return (
    typeof value === "string" &&
    (TIME_FILTER_PRESET_VALUES as readonly string[]).includes(value)
  );
}

export function readStoredTimeFilterPreset(
  storageKey: string,
  fallback: TimeFilterPreset,
): TimeFilterPreset {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return fallback;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isTimeFilterPreset(parsed)) return parsed;
    } catch {
      if (isTimeFilterPreset(stored)) return stored;
    }
  } catch {
    // ignore storage failures
  }
  return fallback;
}

export interface UseTimeFilterOptions {
  /** When set, preset survives reload via localStorage. */
  storageKey?: string;
}

export interface UseTimeFilterReturn {
  selectedPreset: TimeFilterPreset;
  setPreset: (preset: TimeFilterPreset) => void;
  timeWindow: TimeWindow;
  /** Recompute rolling preset window anchored to current time (today/1d/7d/30d). */
  refreshRollingWindow: () => void;
}

/** Compute a TimeWindow for a given preset based on the current time. */
export function computeTimeWindow(preset: TimeFilterPreset): TimeWindow {
  return TIME_FILTER_RANGES[preset]();
}

/** Preset range factories — each returns a fresh TimeWindow anchored to `now`. */
export const TIME_FILTER_RANGES: Record<TimeFilterPreset, () => TimeWindow> = {
  today: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end: now };
  },
  "1d": () => {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { start, end: now };
  },
  "7d": () => {
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  },
  "30d": () => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  },
};

function useOptionalPersistedPreset(
  initialPreset: TimeFilterPreset,
  storageKey?: string,
): readonly [TimeFilterPreset, (preset: TimeFilterPreset) => void] {
  const [selectedPreset, setSelectedPreset] = useState<TimeFilterPreset>(() =>
    storageKey ? readStoredTimeFilterPreset(storageKey, initialPreset) : initialPreset,
  );

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selectedPreset));
    } catch {
      // ignore quota / private mode
    }
  }, [storageKey, selectedPreset]);

  const setPreset = useCallback((preset: TimeFilterPreset) => {
    setSelectedPreset(preset);
  }, []);

  return [selectedPreset, setPreset];
}

/** Toolbar preset time filter for card/list views (independent from map timing bar). */
export function useTimeFilter(
  initialPreset: TimeFilterPreset = "today",
  options?: UseTimeFilterOptions,
): UseTimeFilterReturn {
  const [selectedPreset, setPreset] = useOptionalPersistedPreset(
    initialPreset,
    options?.storageKey,
  );
  const [rollingTick, setRollingTick] = useState(0);

  const timeWindow = useMemo(() => {
    // Rolling presets are anchored to "now"; referencing the tick re-anchors
    // the window whenever refreshRollingWindow() is called.
    void rollingTick;
    return computeTimeWindow(selectedPreset);
  }, [selectedPreset, rollingTick]);

  const refreshRollingWindow = useCallback(() => {
    setRollingTick((tick) => tick + 1);
  }, []);

  return {
    selectedPreset,
    setPreset,
    timeWindow,
    refreshRollingWindow,
  };
}
