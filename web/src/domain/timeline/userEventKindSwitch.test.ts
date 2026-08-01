import { describe, expect, it } from "vitest";

import { isOvernightClockRange, valuesForKindChange } from "./userEventKindSwitch";

const DEFAULT_RRULE = "FREQ=DAILY;INTERVAL=1";

function base(overrides: Record<string, unknown> = {}) {
  return {
    kind: "one_off" as const,
    startTime: "",
    endTime: "",
    isAllDay: false,
    rrule: DEFAULT_RRULE,
    eventStartTime: "09:00",
    eventEndTime: "10:00",
    ...overrides,
  };
}

describe("valuesForKindChange", () => {
  it("maps one_off datetime clocks into recurring and keeps dates for round-trip", () => {
    const oneOff = base({
      startTime: "2026-08-15T14:30",
      endTime: "2026-08-15T16:00",
    });
    const recurring = valuesForKindChange(oneOff, "recurring", {
      defaultRrule: DEFAULT_RRULE,
      today: "2026-08-01",
    });
    expect(recurring.kind).toBe("recurring");
    expect(recurring.eventStartTime).toBe("14:30");
    expect(recurring.eventEndTime).toBe("16:00");
    expect(recurring.startTime).toBe("2026-08-15T14:30");

    const back = valuesForKindChange(
      { ...recurring, eventStartTime: "15:00", eventEndTime: "17:30" },
      "one_off",
      { defaultRrule: DEFAULT_RRULE, today: "2026-08-01" },
    );
    expect(back.kind).toBe("one_off");
    expect(back.startTime).toBe("2026-08-15T15:00");
    expect(back.endTime).toBe("2026-08-15T17:30");
  });

  it("preserves all-day date range across kind toggles", () => {
    const oneOff = base({
      isAllDay: true,
      startTime: "2026-08-10",
      endTime: "2026-08-12",
    });
    const recurring = valuesForKindChange(oneOff, "recurring", {
      defaultRrule: DEFAULT_RRULE,
      today: "2026-08-01",
    });
    expect(recurring.kind).toBe("recurring");
    expect(recurring.isAllDay).toBe(true);
    expect(recurring.startTime).toBe("2026-08-10");

    const back = valuesForKindChange(recurring, "one_off", {
      defaultRrule: DEFAULT_RRULE,
      today: "2026-08-01",
    });
    expect(back.startTime).toBe("2026-08-10");
    expect(back.endTime).toBe("2026-08-12");
    expect(back.isAllDay).toBe(true);
  });

  it("falls back to today only when no date was stored", () => {
    const recurring = base({
      kind: "recurring",
      startTime: "",
      endTime: "",
      eventStartTime: "22:00",
      eventEndTime: "06:00",
    });
    const oneOff = valuesForKindChange(recurring, "one_off", {
      defaultRrule: DEFAULT_RRULE,
      today: "2026-09-01",
    });
    expect(oneOff.startTime).toBe("2026-09-01T22:00");
    expect(oneOff.endTime).toBe("2026-09-01T06:00");
  });
});

describe("isOvernightClockRange", () => {
  it("detects end-before-start clocks", () => {
    expect(isOvernightClockRange("22:00", "06:00")).toBe(true);
    expect(isOvernightClockRange("09:00", "10:00")).toBe(false);
    expect(isOvernightClockRange("09:00", "")).toBe(false);
  });
});
