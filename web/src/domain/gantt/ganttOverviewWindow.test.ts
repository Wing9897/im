import { describe, expect, it } from "vitest";

import { GANTT_DAY_MS, GANTT_HOUR_MS } from "./ganttTimeGeometry";
import {
  OVERVIEW_MAX_SPAN_MS,
  OVERVIEW_MIN_SPAN_MS,
  overviewBarLayout,
  overviewFetchWindow,
  overviewWindowEndMs,
  overviewWindowFromScale,
  clampOverviewSpan,
  clampOverviewWindow,
  formatOverviewWindowLabel,
  panOverviewWindow,
  panDeltaMsFromPointer,
  recenterOverviewWindow,
  ticksForOverviewWindow,
  zoomOverviewWindow,
  zoomOverviewWindowAtPx,
} from "./ganttOverviewWindow";

const DAY = GANTT_DAY_MS;
const HOUR = GANTT_HOUR_MS;

describe("clamp / pan / zoom window", () => {
  const base = { startMs: Date.UTC(2025, 0, 15), spanMs: 7 * DAY };

  it("clamps span to hours↔years", () => {
    expect(clampOverviewSpan(1000)).toBe(OVERVIEW_MIN_SPAN_MS);
    expect(clampOverviewSpan(OVERVIEW_MAX_SPAN_MS * 4)).toBe(OVERVIEW_MAX_SPAN_MS);
    expect(clampOverviewSpan(DAY)).toBe(DAY);
  });

  it("pans by delta without changing span", () => {
    const next = panOverviewWindow(base, 3 * HOUR);
    expect(next.spanMs).toBe(base.spanMs);
    expect(next.startMs).toBe(base.startMs + 3 * HOUR);
  });

  it("zooms toward the focal point (cursor)", () => {
    const next = zoomOverviewWindow(base, 0.5, 0.25);
    expect(next.spanMs).toBe(base.spanMs * 0.5);
    const oldFocal = base.startMs + 0.25 * base.spanMs;
    const newFocal = next.startMs + 0.25 * next.spanMs;
    expect(newFocal).toBeCloseTo(oldFocal);
  });

  it("zooms toward a pixel on the track", () => {
    const next = zoomOverviewWindowAtPx(base, 1000, 0, 2);
    expect(next.spanMs).toBe(base.spanMs * 2);
    expect(next.startMs).toBe(base.startMs);
  });

  it("maps pointer drag onto a time pan (content follows pointer)", () => {
    expect(panDeltaMsFromPointer(100, 1000, 10 * DAY)).toBe(-DAY);
    expect(panDeltaMsFromPointer(-50, 500, 10 * DAY)).toBe(DAY);
    expect(panDeltaMsFromPointer(10, 0, DAY)).toBe(0);
  });

  it("recenters on a timestamp keeping span", () => {
    const center = Date.UTC(2026, 5, 1);
    const next = recenterOverviewWindow(base, center);
    expect(next.spanMs).toBe(base.spanMs);
    expect(next.startMs + next.spanMs / 2).toBe(center);
  });
});

describe("overviewWindowFromScale", () => {
  const cursor = new Date(2025, 5, 15, 15, 0, 0);

  it("opens a complete day/week/month/quarter/year window from the discrete scale", () => {
    const day = overviewWindowFromScale("day", cursor);
    expect(day.spanMs).toBe(DAY);
    expect(new Date(day.startMs).getHours()).toBe(0);

    const week = overviewWindowFromScale("week", cursor);
    expect(week.spanMs).toBe(7 * DAY);

    const month = overviewWindowFromScale("month", cursor);
    expect(new Date(month.startMs).getDate()).toBe(1);
    expect(overviewWindowEndMs(month)).toBeGreaterThan(month.startMs);

    const quarter = overviewWindowFromScale("quarter", cursor);
    expect(new Date(quarter.startMs).getMonth() % 3).toBe(0);

    const year = overviewWindowFromScale("year", cursor);
    expect(new Date(year.startMs).getMonth()).toBe(0);
    expect(new Date(year.startMs).getDate()).toBe(1);
  });
});

describe("ticks follow zoom across 日週月季年", () => {
  it("emits hour ticks on a tight window and year ticks on a wide window", () => {
    const hours = ticksForOverviewWindow({
      startMs: new Date(2025, 0, 15, 8).getTime(),
      spanMs: 6 * HOUR,
    });
    expect(hours.length).toBeGreaterThan(2);
    expect(hours.some((tick) => tick.label.includes(":00"))).toBe(true);

    const days = ticksForOverviewWindow({
      startMs: new Date(2025, 0, 10).getTime(),
      spanMs: 10 * DAY,
    });
    expect(days.some((tick) => tick.label.includes("/"))).toBe(true);

    const months = ticksForOverviewWindow({
      startMs: new Date(2025, 0, 1).getTime(),
      spanMs: 180 * DAY,
    });
    expect(months.some((tick) => /^\d{4}-\d{2}$/.test(tick.label))).toBe(true);

    const years = ticksForOverviewWindow({
      startMs: new Date(2020, 0, 1).getTime(),
      spanMs: 6 * 365 * DAY,
    });
    expect(years.some((tick) => tick.label === "2022" || tick.label === "2021")).toBe(true);
  });
});

describe("overviewBarLayout / fetch / label", () => {
  const window = {
    startMs: new Date(2025, 0, 15).getTime(),
    spanMs: DAY,
  };

  it("places an in-range bar as a percent and hides bars outside", () => {
    const start = new Date(2025, 0, 15, 9).getTime();
    const end = new Date(2025, 0, 15, 11).getTime();
    const layout = overviewBarLayout(start, end, window);
    expect(layout).not.toBeNull();
    expect(layout!.leftPct).toBeCloseTo((9 / 24) * 100);
    expect(layout!.widthPct).toBeCloseTo((2 / 24) * 100);

    const outside = overviewBarLayout(
      new Date(2025, 0, 20).getTime(),
      new Date(2025, 0, 21).getTime(),
      window,
    );
    expect(outside).toBeNull();
  });

  it("snaps fetch bounds to days with padding", () => {
    const fetch = overviewFetchWindow(window);
    expect(fetch.start.getTime()).toBeLessThan(window.startMs);
    expect(fetch.end.getTime()).toBeGreaterThan(overviewWindowEndMs(window));
    expect(fetch.start.getHours()).toBe(0);
  });

  it("formats a compact visible-range label", () => {
    expect(formatOverviewWindowLabel(window)).toMatch(/1\/15/);
    const wide = clampOverviewWindow({ startMs: window.startMs, spanMs: 400 * DAY });
    expect(formatOverviewWindowLabel(wide)).toMatch(/2025/);
  });
});
