import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TimeFilterPreset } from "../components/TimeFilter";
import {
  useTimeFilter,
  computeTimeWindow,
  TIME_FILTER_RANGES,
  INTELLIGENCE_TIME_PRESET_STORAGE_KEY,
  readStoredTimeFilterPreset,
  type UseTimeFilterReturn,
} from "./useTimeFilter";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let latestResult: UseTimeFilterReturn | null = null;

function Harness({
  initialPreset,
  storageKey,
}: {
  initialPreset?: TimeFilterPreset;
  storageKey?: string;
}) {
  const result = useTimeFilter(initialPreset, storageKey ? { storageKey } : undefined);
  latestResult = result;
  return null;
}

describe("useTimeFilter", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latestResult = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  // ─── Default State ──────────────────────────────────────────────────────

  it("defaults to 'today' preset", () => {
    act(() => {
      root.render(createElement(Harness));
    });

    expect(latestResult!.selectedPreset).toBe("today");
  });

  it("accepts a custom initial preset", () => {
    act(() => {
      root.render(createElement(Harness, { initialPreset: "7d" }));
    });

    expect(latestResult!.selectedPreset).toBe("7d");
  });

  // ─── timeWindow computation ─────────────────────────────────────────────

  it("computes a valid timeWindow where start < end", () => {
    act(() => {
      root.render(createElement(Harness));
    });

    const { timeWindow } = latestResult!;
    expect(timeWindow.start.getTime()).toBeLessThan(timeWindow.end.getTime());
  });

  it("1d preset produces a ~24h window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

    act(() => {
      root.render(createElement(Harness, { initialPreset: "1d" }));
    });

    const { timeWindow } = latestResult!;
    const durationMs = timeWindow.end.getTime() - timeWindow.start.getTime();
    expect(durationMs).toBe(24 * 60 * 60 * 1000);
  });

  it("7d preset produces a ~7 day window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

    act(() => {
      root.render(createElement(Harness, { initialPreset: "7d" }));
    });

    const { timeWindow } = latestResult!;
    const durationMs = timeWindow.end.getTime() - timeWindow.start.getTime();
    expect(durationMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("30d preset produces a ~30 day window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

    act(() => {
      root.render(createElement(Harness, { initialPreset: "30d" }));
    });

    const { timeWindow } = latestResult!;
    const durationMs = timeWindow.end.getTime() - timeWindow.start.getTime();
    expect(durationMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  // ─── setPreset ──────────────────────────────────────────────────────────

  it("setPreset changes the selected preset and recomputes the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

    act(() => {
      root.render(createElement(Harness));
    });

    act(() => {
      latestResult!.setPreset("30d");
    });

    expect(latestResult!.selectedPreset).toBe("30d");
    const durationMs =
      latestResult!.timeWindow.end.getTime() -
      latestResult!.timeWindow.start.getTime();
    expect(durationMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("recomputes timeWindow when refreshRollingWindow is called", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T10:00:00.000Z"));

    act(() => {
      root.render(createElement(Harness, { initialPreset: "today" }));
    });

    const firstEnd = latestResult!.timeWindow.end.getTime();

    vi.setSystemTime(new Date("2024-06-15T11:00:00.000Z"));
    act(() => {
      latestResult!.refreshRollingWindow();
    });

    expect(latestResult!.timeWindow.end.getTime()).toBeGreaterThan(firstEnd);
  });

  // ─── storageKey persistence ───────────────────────────────────────────────

  it("without storageKey does not write preset to localStorage", () => {
    act(() => {
      root.render(createElement(Harness, { initialPreset: "7d" }));
    });
    act(() => {
      latestResult!.setPreset("30d");
    });
    expect(localStorage.getItem(INTELLIGENCE_TIME_PRESET_STORAGE_KEY)).toBeNull();
  });

  it("restores preset from storageKey on mount", () => {
    localStorage.setItem(
      INTELLIGENCE_TIME_PRESET_STORAGE_KEY,
      JSON.stringify("7d"),
    );

    act(() => {
      root.render(
        createElement(Harness, {
          initialPreset: "today",
          storageKey: INTELLIGENCE_TIME_PRESET_STORAGE_KEY,
        }),
      );
    });

    expect(latestResult!.selectedPreset).toBe("7d");
  });

  it("persists preset changes under storageKey and survives remount", () => {
    act(() => {
      root.render(
        createElement(Harness, {
          storageKey: INTELLIGENCE_TIME_PRESET_STORAGE_KEY,
        }),
      );
    });

    act(() => {
      latestResult!.setPreset("30d");
    });

    expect(
      readStoredTimeFilterPreset(INTELLIGENCE_TIME_PRESET_STORAGE_KEY, "today"),
    ).toBe("30d");

    act(() => {
      root.unmount();
    });
    root = createRoot(container);

    act(() => {
      root.render(
        createElement(Harness, {
          initialPreset: "today",
          storageKey: INTELLIGENCE_TIME_PRESET_STORAGE_KEY,
        }),
      );
    });

    expect(latestResult!.selectedPreset).toBe("30d");
  });

  it("falls back to initialPreset when storageKey contains invalid JSON", () => {
    localStorage.setItem(INTELLIGENCE_TIME_PRESET_STORAGE_KEY, "{not valid");

    act(() => {
      root.render(
        createElement(Harness, {
          initialPreset: "1d",
          storageKey: INTELLIGENCE_TIME_PRESET_STORAGE_KEY,
        }),
      );
    });

    expect(latestResult!.selectedPreset).toBe("1d");
  });
});

// ─── computeTimeWindow utility ────────────────────────────────────────────

describe("computeTimeWindow", () => {
  const DURATION_1D = 24 * 60 * 60 * 1000;
  const DURATION_7D = 7 * 24 * 60 * 60 * 1000;
  const DURATION_30D = 30 * 24 * 60 * 60 * 1000;
  const TOLERANCE_MS = 1000;

  it("returns a TimeWindow with start < end for all presets", () => {
    const presets: TimeFilterPreset[] = ["today", "1d", "7d", "30d"];
    for (const preset of presets) {
      const window = computeTimeWindow(preset);
      expect(window.start.getTime()).toBeLessThan(window.end.getTime());
    }
  });

  it("duration matches preset definition (±1s tolerance for today)", () => {
    for (const preset of ["1d", "7d", "30d", "today"] as const) {
      const window = computeTimeWindow(preset);
      const duration = window.end.getTime() - window.start.getTime();

      switch (preset) {
        case "1d":
          expect(Math.abs(duration - DURATION_1D)).toBeLessThanOrEqual(TOLERANCE_MS);
          break;
        case "7d":
          expect(Math.abs(duration - DURATION_7D)).toBeLessThanOrEqual(TOLERANCE_MS);
          break;
        case "30d":
          expect(Math.abs(duration - DURATION_30D)).toBeLessThanOrEqual(TOLERANCE_MS);
          break;
        case "today":
          expect(duration).toBeGreaterThanOrEqual(0);
          expect(duration).toBeLessThanOrEqual(DURATION_1D);
          break;
      }
    }
  });
});

// ─── TIME_FILTER_RANGES utility ───────────────────────────────────────────

describe("TIME_FILTER_RANGES", () => {
  it("has entries for all four presets", () => {
    expect(Object.keys(TIME_FILTER_RANGES)).toEqual(["today", "1d", "7d", "30d"]);
  });

  it("each factory returns a valid TimeWindow", () => {
    for (const fn of Object.values(TIME_FILTER_RANGES)) {
      const window = fn();
      expect(window.start).toBeInstanceOf(Date);
      expect(window.end).toBeInstanceOf(Date);
      expect(window.start.getTime()).toBeLessThan(window.end.getTime());
    }
  });
});
