import { describe, expect, it } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  DEFAULT_RRULE,
  EMPTY_USER_EVENT_FORM,
  USER_EVENT_CLOCK_RE,
  valuesFromInitial,
} from "./userEventFormModel";

describe("userEventFormModel", () => {
  it("EMPTY_USER_EVENT_FORM uses system workset and default RRULE", () => {
    expect(EMPTY_USER_EVENT_FORM.worksetId).toBe(SYSTEM_WORKSET_ID);
    expect(EMPTY_USER_EVENT_FORM.rrule).toBe(DEFAULT_RRULE);
    expect(EMPTY_USER_EVENT_FORM.kind).toBe("one_off");
  });

  it("USER_EVENT_CLOCK_RE matches HH:MM only", () => {
    expect(USER_EVENT_CLOCK_RE.test("09:00")).toBe(true);
    expect(USER_EVENT_CLOCK_RE.test("9:00")).toBe(false);
  });

  it("valuesFromInitial normalizes timed one-off inputs", () => {
    const values = valuesFromInitial({
      title: "Meet",
      startTime: "2026-08-09T10:00:00Z",
      endTime: "2026-08-09T11:00:00Z",
      worksetId: "  ",
    });
    expect(values.kind).toBe("one_off");
    expect(values.worksetId).toBe(SYSTEM_WORKSET_ID);
    expect(values.startTime.length).toBeGreaterThan(0);
    expect(values.endTime.length).toBeGreaterThan(0);
    expect(values.rrule).toBe(DEFAULT_RRULE);
  });

  it("valuesFromInitial maps all-day exclusive end to inclusive date input", () => {
    const values = valuesFromInitial({
      isAllDay: true,
      startTime: "2026-08-09",
      endTime: "2026-08-11",
    });
    expect(values.isAllDay).toBe(true);
    expect(values.startTime).toBe("2026-08-09");
    expect(values.endTime).toBe("2026-08-10");
  });

  it("valuesFromInitial clears one-off times for recurring kind", () => {
    const values = valuesFromInitial({
      kind: "recurring",
      startTime: "2026-08-09T10:00",
      endTime: "2026-08-09T11:00",
      rrule: "FREQ=WEEKLY;INTERVAL=1",
      eventStartTime: "14:00",
      eventEndTime: "15:30",
    });
    expect(values.kind).toBe("recurring");
    expect(values.startTime).toBe("");
    expect(values.endTime).toBe("");
    expect(values.rrule).toBe("FREQ=WEEKLY;INTERVAL=1");
    expect(values.eventStartTime).toBe("14:00");
    expect(values.eventEndTime).toBe("15:30");
  });
});
