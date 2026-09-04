import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OVERVIEW_FETCH_DEBOUNCE_MS,
} from "../../domain/gantt/ganttOverviewWindow";
import { GANTT_DAY_MS } from "../../domain/gantt/ganttTimeGeometry";
import { useGanttOverviewSession } from "./useGanttOverviewSession";

describe("useGanttOverviewSession fetch commit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps fetchRange stable while panning until debounce/commit", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    let latest: ReturnType<typeof useGanttOverviewSession> | null = null;
    function Probe() {
      latest = useGanttOverviewSession({
        overviewMode: true,
        timeScale: "week",
        timeCursor: new Date(2026, 6, 9),
      });
      return null;
    }
    act(() => {
      root.render(createElement(Probe));
    });
    const committed = latest!.fetchRange;
    const startIso = committed.start.toISOString();

    act(() => {
      latest!.setOverviewWindow({
        startMs: latest!.overviewWindow.startMs + 40 * GANTT_DAY_MS,
        spanMs: latest!.overviewWindow.spanMs,
      });
    });
    expect(latest!.fetchRange.start.toISOString()).toBe(startIso);

    act(() => {
      vi.advanceTimersByTime(OVERVIEW_FETCH_DEBOUNCE_MS);
    });
    expect(latest!.fetchRange.start.toISOString()).not.toBe(startIso);

    act(() => root.unmount());
  });
});
