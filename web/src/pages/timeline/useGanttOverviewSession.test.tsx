import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OVERVIEW_FETCH_DEBOUNCE_MS,
  OVERVIEW_RANGE_PRESETS,
} from "../../domain/gantt/ganttOverviewWindow";
import { GANTT_DAY_MS } from "../../domain/gantt/ganttTimeGeometry";
import { TIMELINE_OVERVIEW_SPAN_STORAGE_KEY } from "../../domain/prefs";
import { useGanttOverviewSession } from "./useGanttOverviewSession";

describe("useGanttOverviewSession fetch commit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 5, 15, 0, 0));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  function mount(overviewMode = true) {
    const host = document.createElement("div");
    const root = createRoot(host);
    let latest: ReturnType<typeof useGanttOverviewSession> | null = null;
    function Probe() {
      latest = useGanttOverviewSession({
        overviewMode,
        timeScale: "week",
        timeCursor: new Date(2026, 6, 9),
      });
      return null;
    }
    act(() => {
      root.render(createElement(Probe));
    });
    return { root, latest: () => latest! };
  }

  it("keeps fetchRange stable while panning until debounce/commit", () => {
    const { root, latest } = mount();
    const committed = latest().fetchRange;
    const startIso = committed.start.toISOString();

    act(() => {
      latest().setOverviewWindow({
        startMs: latest().overviewWindow.startMs + 40 * GANTT_DAY_MS,
        spanMs: latest().overviewWindow.spanMs,
      });
    });
    expect(latest().fetchRange.start.toISOString()).toBe(startIso);

    act(() => {
      vi.advanceTimersByTime(OVERVIEW_FETCH_DEBOUNCE_MS);
    });
    expect(latest().fetchRange.start.toISOString()).not.toBe(startIso);

    act(() => root.unmount());
  });

  it("applies a range-menu span to visible and fetch windows together", () => {
    const { root, latest } = mount();
    const centerBefore =
      latest().overviewWindow.startMs + latest().overviewWindow.spanMs / 2;
    const fetchBefore = latest().fetchRange.start.toISOString();

    act(() => {
      latest().applyRangeId("30d");
    });

    expect(latest().overviewWindow.spanMs).toBe(OVERVIEW_RANGE_PRESETS["30d"]);
    expect(latest().overviewWindow.startMs + latest().overviewWindow.spanMs / 2).toBeCloseTo(
      centerBefore,
    );
    expect(latest().fetchRange.start.toISOString()).not.toBe(fetchBefore);
    expect(JSON.parse(localStorage.getItem(TIMELINE_OVERVIEW_SPAN_STORAGE_KEY)!)).toBe("30d");

    act(() => root.unmount());
  });

  it("jumps the window to a date and commits fetch without waiting for debounce", () => {
    const { root, latest } = mount();
    const target = new Date(2026, 7, 9, 12).getTime();

    act(() => {
      latest().setOverviewWindow({
        startMs: latest().overviewWindow.startMs + 20 * GANTT_DAY_MS,
        spanMs: latest().overviewWindow.spanMs,
      });
    });
    const fetchDuringPan = latest().fetchRange.start.toISOString();

    act(() => {
      latest().jumpToTimestamp(target);
    });

    expect(latest().overviewWindow.startMs + latest().overviewWindow.spanMs / 2).toBe(target);
    expect(latest().fetchRange.start.toISOString()).not.toBe(fetchDuringPan);

    act(() => root.unmount());
  });

  it("recenters on now and commits immediately", () => {
    const { root, latest } = mount();
    const now = Date.now();

    act(() => {
      latest().recenterToday();
    });

    expect(latest().overviewWindow.startMs + latest().overviewWindow.spanMs / 2).toBe(now);

    act(() => root.unmount());
  });

  it("restores a persisted range when entering 全局", () => {
    localStorage.setItem(TIMELINE_OVERVIEW_SPAN_STORAGE_KEY, JSON.stringify("7d"));
    const { root, latest } = mount(true);

    expect(latest().overviewWindow.spanMs).toBe(OVERVIEW_RANGE_PRESETS["7d"]);
    expect(latest().overviewWindow.startMs + latest().overviewWindow.spanMs / 2).toBe(Date.now());

    act(() => root.unmount());
  });
});
