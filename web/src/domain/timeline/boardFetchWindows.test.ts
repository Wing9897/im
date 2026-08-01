import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  currentMonthWindowIso,
  dayWindowIso,
  paddedMonthWindowIso,
} from "./boardFetchWindows";

describe("boardFetchWindows", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0)); // Jul 15, 2026 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("currentMonthWindowIso covers the local calendar month", () => {
    const { startDate, endDate } = currentMonthWindowIso();
    expect(new Date(startDate)).toEqual(new Date(2026, 6, 1));
    expect(new Date(endDate)).toEqual(new Date(2026, 7, 1));
  });

  it("paddedMonthWindowIso pads ±7 days around the month", () => {
    const { startDate, endDate } = paddedMonthWindowIso();
    expect(new Date(startDate)).toEqual(new Date(2026, 5, 24));
    expect(new Date(endDate)).toEqual(new Date(2026, 7, 8));
  });

  it("dayWindowIso covers yesterday through day-after-tomorrow", () => {
    const { startDate, endDate } = dayWindowIso();
    expect(new Date(startDate)).toEqual(new Date(2026, 6, 14));
    expect(new Date(endDate)).toEqual(new Date(2026, 6, 17));
  });
});
