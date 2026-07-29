import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMonths,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "../../domain/timeline/dateUtils";
import {
  TIMELINE_TIME_CURSOR_STORAGE_KEY,
  useTimelineNavigation,
} from "./useTimelineNavigation";

let latest: ReturnType<typeof useTimelineNavigation> | null = null;

function Harness() {
  latest = useTimelineNavigation();
  return null;
}

describe("useTimelineNavigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
    localStorage.clear();
    latest = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  async function renderHook() {
    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
    });
  }

  it("defaults to month scale with a month-long visible range", async () => {
    await renderHook();

    expect(latest!.timeScale).toBe("month");
    expect(latest!.rangeStart).toEqual(startOfMonth(new Date("2025-01-15T12:00:00Z")));
    expect(latest!.rangeEnd).toEqual(addMonths(latest!.rangeStart, 1));
    expect(latest!.monthDays).toHaveLength(42);
    expect(latest!.weekDays).toHaveLength(7);
  });

  it("moveCursor advances by one week when scale is week", async () => {
    await renderHook();

    act(() => {
      latest!.setTimeScale("week");
      latest!.setTimeCursor(startOfDay(new Date("2025-01-15T12:00:00Z")));
    });

    const before = latest!.timeCursor.getTime();

    act(() => {
      latest!.moveCursor(1);
    });

    expect(latest!.timeCursor.getTime() - before).toBe(7 * 24 * 60 * 60 * 1000);
    expect(latest!.rangeStart).toEqual(startOfWeek(latest!.timeCursor));
  });

  it("jumpTo switches scale and snaps cursor to today at that scale", async () => {
    await renderHook();

    act(() => {
      latest!.setTimeCursor(startOfDay(new Date("2024-06-01T00:00:00Z")));
    });

    act(() => {
      latest!.jumpTo("day");
    });

    expect(latest!.timeScale).toBe("day");
    expect(latest!.timeCursor).toEqual(startOfDay(new Date("2025-01-15T12:00:00Z")));
    expect(latest!.visibleRangeLabel.length).toBeGreaterThan(0);
  });

  it("jumpTo('month') snaps cursor to today, not the first of the month", async () => {
    await renderHook();

    act(() => {
      latest!.setTimeCursor(startOfDay(new Date("2024-06-01T00:00:00Z")));
    });

    act(() => {
      latest!.jumpTo("month");
    });

    expect(latest!.timeScale).toBe("month");
    expect(latest!.timeCursor).toEqual(startOfDay(new Date("2025-01-15T12:00:00Z")));
    expect(latest!.rangeStart).toEqual(startOfMonth(new Date("2025-01-15T12:00:00Z")));
  });

  it("jumpTo('quarter') snaps cursor to the start of the current quarter", async () => {
    await renderHook();

    act(() => {
      latest!.jumpTo("quarter");
    });

    expect(latest!.timeScale).toBe("quarter");
    expect(latest!.timeCursor).toEqual(startOfQuarter(new Date("2025-01-15T12:00:00Z")));
  });

  it("jumpTo('year') snaps cursor to January 1 of the current year", async () => {
    await renderHook();

    act(() => {
      latest!.jumpTo("year");
    });

    expect(latest!.timeScale).toBe("year");
    expect(latest!.timeCursor).toEqual(startOfYear(new Date("2025-01-15T12:00:00Z")));
  });

  it("persists timeCursor across remount", async () => {
    const persistedDay = startOfDay(new Date("2024-06-01T00:00:00Z"));

    await renderHook();

    act(() => {
      latest!.setTimeCursor(persistedDay);
    });

    expect(localStorage.getItem(TIMELINE_TIME_CURSOR_STORAGE_KEY)).toBe(
      JSON.stringify(persistedDay.toISOString()),
    );

    act(() => {
      root.unmount();
    });

    latest = null;
    root = createRoot(container);

    await renderHook();

    expect(latest!.timeCursor).toEqual(persistedDay);
  });

  it("falls back to today when persisted timeCursor is invalid", async () => {
    localStorage.setItem(TIMELINE_TIME_CURSOR_STORAGE_KEY, JSON.stringify("not-a-date"));

    await renderHook();

    expect(latest!.timeCursor).toEqual(startOfDay(new Date("2025-01-15T12:00:00Z")));
  });
});
