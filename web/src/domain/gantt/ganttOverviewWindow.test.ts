import { describe, expect, it } from "vitest";

import { GANTT_DAY_MS, GANTT_HOUR_MS } from "./ganttTimeGeometry";
import {
  OVERVIEW_MAX_SPAN_MS,
  OVERVIEW_MIN_SPAN_MS,
  OVERVIEW_COMPACT_WIDTH_PCT,
  OVERVIEW_FETCH_MAX_MS,
  OVERVIEW_MIN_TICK_LABEL_PCT,
  overviewBarIsCompact,
  overviewBarLayout,
  overviewFetchWindow,
  overviewTickLabelPct,
  overviewTickLeftPct,
  overviewWindowEndMs,
  overviewWindowFromScale,
  clampOverviewSpan,
  clampOverviewWindow,
  formatOverviewWindowLabel,
  minOverviewTickLabelPct,
  panOverviewWindow,
  panDeltaMsFromPointer,
  recenterOverviewWindow,
  thinOverviewTicks,
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
    expect(days.every((tick) => !tick.label.includes(":"))).toBe(true);

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

  it("uses day ticks (never hours) on a multi-day window", () => {
    const ticks = ticksForOverviewWindow({
      startMs: new Date(2026, 6, 9).getTime(),
      spanMs: 5 * DAY,
    });
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.every((tick) => !tick.label.includes(":"))).toBe(true);
    expect(ticks.some((tick) => tick.label.includes("/"))).toBe(true);
  });

  it("uses quarter ticks (never hours) on a ~year 全局 window", () => {
    const startMs = new Date(2030, 11, 21, 13, 25).getTime();
    const endMs = new Date(2031, 9, 29, 19, 29).getTime();
    const visible = { startMs, spanMs: endMs - startMs };
    const ticks = ticksForOverviewWindow(visible);
    expect(visible.spanMs).toBeGreaterThan(240 * DAY);
    expect(visible.spanMs).toBeLessThan(400 * DAY);
    expect(ticks.every((tick) => !tick.label.includes(":"))).toBe(true);
    expect(ticks.some((tick) => /Q[1-4]/.test(tick.label))).toBe(true);
    expect(ticks.length).toBeLessThanOrEqual(8);

    const timebarCanvas = { startMs, spanMs: visible.spanMs * 3 };
    const canvasTicks = ticksForOverviewWindow(
      timebarCanvas,
      16,
      minOverviewTickLabelPct(1200),
    );
    expect(canvasTicks.every((tick) => !tick.label.includes(":"))).toBe(true);
    expect(canvasTicks.some((tick) => /Q[1-4]/.test(tick.label) || /^\d{4}$/.test(tick.label))).toBe(
      true,
    );
  });

  it("skips labels closer than the minimum track percent", () => {
    const window = {
      startMs: new Date(2026, 0, 1, 8).getTime(),
      spanMs: 6 * HOUR,
    };
    const dense = ticksForOverviewWindow(window, 24, 0);
    expect(dense.length).toBeGreaterThan(3);
    const thinned = thinOverviewTicks(dense, window, 25);
    expect(thinned.length).toBeLessThan(dense.length);
    expect(thinned.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < thinned.length; i++) {
      const prev = overviewTickLabelPct(thinned[i - 1]!, thinned[i]?.ms ?? null, window);
      const next = overviewTickLabelPct(thinned[i]!, thinned[i + 1]?.ms ?? null, window);
      expect(next - prev).toBeGreaterThanOrEqual(25 - 1e-6);
    }
  });

  it("floors label spacing from track width so long labels cannot collide", () => {
    expect(minOverviewTickLabelPct(0)).toBe(OVERVIEW_MIN_TICK_LABEL_PCT);
    expect(minOverviewTickLabelPct(400)).toBeGreaterThan(OVERVIEW_MIN_TICK_LABEL_PCT);
    expect(minOverviewTickLabelPct(2000)).toBe(OVERVIEW_MIN_TICK_LABEL_PCT);
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

  it("caps and buckets fetch bounds so small pans keep the same key", () => {
    const fetch = overviewFetchWindow(window);
    expect(fetch.start.getTime()).toBeLessThanOrEqual(window.startMs);
    expect(fetch.end.getTime()).toBeGreaterThanOrEqual(overviewWindowEndMs(window));
    expect(fetch.end.getTime() - fetch.start.getTime()).toBeLessThanOrEqual(OVERVIEW_FETCH_MAX_MS);
    expect(fetch.start.getHours()).toBe(0);

    const nudged = panOverviewWindow(window, 3 * HOUR);
    const nudgedFetch = overviewFetchWindow(nudged);
    expect(nudgedFetch.start.getTime()).toBe(fetch.start.getTime());
    expect(nudgedFetch.end.getTime()).toBe(fetch.end.getTime());
  });

  it("hard-caps a decade-wide visible span to 90 days", () => {
    const decade = clampOverviewWindow({ startMs: window.startMs, spanMs: 10 * 365 * DAY });
    const fetch = overviewFetchWindow(decade);
    expect(fetch.end.getTime() - fetch.start.getTime()).toBeLessThanOrEqual(OVERVIEW_FETCH_MAX_MS);
  });

  it("formats a compact visible-range label", () => {
    expect(formatOverviewWindowLabel(window)).toMatch(/1\/15/);
    const wide = clampOverviewWindow({ startMs: window.startMs, spanMs: 400 * DAY });
    expect(formatOverviewWindowLabel(wide)).toMatch(/2025/);
  });

  it("treats short timed spans as ticks on a zoomed-out 全局 window", () => {
    const wide = {
      startMs: new Date(2026, 9, 2).getTime(),
      spanMs: 13 * DAY,
    };
    const timed = overviewBarLayout(
      new Date(2026, 9, 6, 9).getTime(),
      new Date(2026, 9, 6, 10).getTime(),
      wide,
    );
    expect(timed).not.toBeNull();
    expect(timed!.isPoint).toBe(false);
    expect(timed!.widthPct).toBeLessThan(OVERVIEW_COMPACT_WIDTH_PCT);
    expect(overviewBarIsCompact(timed!)).toBe(true);

    const allDay = overviewBarLayout(
      new Date(2026, 9, 7).getTime(),
      new Date(2026, 9, 8).getTime() - 1,
      wide,
    );
    expect(allDay).not.toBeNull();
    expect(allDay!.isPoint).toBe(false);
    expect(allDay!.widthPct).toBeGreaterThan(OVERVIEW_COMPACT_WIDTH_PCT);
    expect(overviewBarIsCompact(allDay!)).toBe(false);
  });

  it("places day labels in the cell and grid lines on the day start", () => {
    const span = {
      startMs: new Date(2026, 9, 2, 17).getTime(),
      spanMs: 13 * DAY,
    };
    const dayStart = new Date(2026, 9, 4).getTime();
    const nextDay = new Date(2026, 9, 5).getTime();
    const linePct = overviewTickLeftPct(dayStart, span);
    const labelPct = overviewTickLabelPct(
      { ms: dayStart, label: "10/4", major: false },
      nextDay,
      span,
    );
    expect(labelPct).toBeCloseTo((linePct + overviewTickLeftPct(nextDay, span)) / 2);
    expect(
      overviewTickLabelPct({ ms: dayStart, label: "08:00", major: false }, nextDay, span),
    ).toBeCloseTo(linePct);
  });

  it("uses exclusive-end labels and omits the exclusive midnight tick", () => {
    const span = {
      startMs: new Date(2026, 6, 9).getTime(),
      spanMs: 14 * DAY,
    };
    const ticks = ticksForOverviewWindow(span, 20);
    const labels = ticks.map((tick) => tick.label);
    expect(labels).toContain("7/9");
    expect(labels).toContain("7/22");
    expect(labels).not.toContain("7/23");
    expect(formatOverviewWindowLabel(span)).toBe("7/9 – 7/22");
  });
});
