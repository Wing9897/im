import { describe, expect, it } from "vitest";

import { createTimedRangeOnDay, defaultCreateTimedRange } from "./dateUtils";

describe("create timed defaults", () => {
  it("defaults to now and one hour later", () => {
    const now = new Date(2026, 7, 6, 14, 30, 0);
    const range = defaultCreateTimedRange(now);
    expect(range.startTime).toBe("2026-08-06T14:30");
    expect(range.endTime).toBe("2026-08-06T15:30");
  });

  it("prefills wall day with current clock", () => {
    const day = new Date(2026, 7, 15, 0, 0, 0);
    const now = new Date(2026, 7, 6, 9, 5, 0);
    const range = createTimedRangeOnDay(day, now);
    expect(range.startTime).toBe("2026-08-15T09:05");
    expect(range.endTime).toBe("2026-08-15T10:05");
  });
});
