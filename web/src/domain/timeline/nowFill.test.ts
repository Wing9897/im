import { describe, expect, it } from "vitest";

import { fillNowRange, localClockInput, localDateTimeInput } from "./nowFill";

describe("nowFill", () => {
  const now = new Date(2026, 7, 15, 13, 30, 0);

  it("formats local clock and datetime-local values", () => {
    expect(localClockInput(now)).toBe("13:30");
    expect(localDateTimeInput(now)).toBe("2026-08-15T13:30");
  });

  it("fills today only when all-day", () => {
    expect(fillNowRange({ isAllDay: true, now })).toEqual({
      start: "2026-08-15",
      end: "2026-08-15",
    });
  });

  it("fills now and now+1h for timed datetime-local", () => {
    expect(fillNowRange({ isAllDay: false, now })).toEqual({
      start: "2026-08-15T13:30",
      end: "2026-08-15T14:30",
    });
  });

  it("fills HH:MM clocks for recurring timed fields", () => {
    expect(fillNowRange({ isAllDay: false, clockOnly: true, now })).toEqual({
      start: "13:30",
      end: "14:30",
    });
  });
});
