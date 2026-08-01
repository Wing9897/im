import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAppLocale } from "../../i18n/locale";
import {
  addDays,
  addMonths,
  buildCalendarDays,
  buildWeekDays,
  eventOverlapsRange,
  eventStartsOnDay,
  formatRangeLabel,
  fromDateTimeLocalInput,
  isSameDay,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  timelineEventDateRange,
  toDateTimeLocalInput,
} from "./dateUtils";
import { makeAnalysisEvent } from "../../test/analysisEventFixtures";

describe("dateUtils", () => {
  beforeEach(() => {
    setAppLocale("en");
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes day / week / month starts", () => {
    const d = new Date(2024, 5, 15, 18, 30);
    expect(startOfDay(d)).toEqual(new Date(2024, 5, 15));
    // Monday-based week (Sat 15 → Mon 10)
    expect(startOfWeek(d)).toEqual(new Date(2024, 5, 10));
    expect(startOfMonth(d)).toEqual(new Date(2024, 5, 1));
  });

  it("adds days and months", () => {
    const d = new Date(2024, 5, 15);
    expect(addDays(d, 3)).toEqual(new Date(2024, 5, 18));
    expect(addMonths(d, 1)).toEqual(new Date(2024, 6, 1));
  });

  it("builds a 42-cell calendar grid and 7-day week", () => {
    const days = buildCalendarDays(new Date(2024, 5, 1));
    expect(days).toHaveLength(42);
    expect(buildWeekDays(new Date(2024, 5, 15))).toHaveLength(7);
  });

  it("detects same day / today", () => {
    expect(isSameDay(new Date(2024, 5, 15, 1), new Date(2024, 5, 15, 23))).toBe(true);
    expect(isToday(new Date(2024, 5, 15))).toBe(true);
    expect(isToday(new Date(2024, 5, 14))).toBe(false);
  });

  it("formats range labels per scale", () => {
    const cursor = new Date(2024, 5, 15);
    expect(formatRangeLabel("day", cursor)).toMatch(/2024/);
    expect(formatRangeLabel("week", cursor)).toContain("-");
    expect(formatRangeLabel("quarter", cursor)).toBe("2024 Q2");
    expect(formatRangeLabel("year", cursor)).toMatch(/2024/);
  });

  it("checks event overlap and day start", () => {
    const event = makeAnalysisEvent({
      id: "e1",
      taskId: "t1",
      title: "Meet",
      startTime: new Date(2024, 5, 15, 10).toISOString(),
      endTime: new Date(2024, 5, 15, 12).toISOString(),
    });
    const day = startOfDay(new Date(2024, 5, 15));
    expect(eventStartsOnDay(event, day)).toBe(true);
    expect(
      eventOverlapsRange(event, day, addDays(day, 1)),
    ).toBe(true);
    expect(
      eventOverlapsRange(event, addDays(day, 2), addDays(day, 3)),
    ).toBe(false);
  });

  it("keeps all-day calendar dates as local wall dates", () => {
    const event = makeAnalysisEvent({
      startTime: "2026-01-15T00:00:00Z",
      endTime: "2026-01-16T00:00:00Z",
      isAllDay: true,
      timezone: null,
    });
    const { start, end } = timelineEventDateRange(event);
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 0, 15]);
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 0, 16]);
  });

  it("round-trips datetime-local inputs", () => {
    const iso = new Date(2024, 5, 15, 14, 30).toISOString();
    const local = toDateTimeLocalInput(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDateTimeLocalInput(local)).toBeTruthy();
    expect(fromDateTimeLocalInput("not-a-date")).toBeNull();
    expect(toDateTimeLocalInput(null)).toBe("");
  });
});
