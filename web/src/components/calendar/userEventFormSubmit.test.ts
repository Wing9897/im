import { describe, expect, it } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { EMPTY_USER_EVENT_FORM } from "../../domain/timeline/userEventFormModel";
import { buildUserEventSubmitValues } from "./userEventFormSubmit";

describe("buildUserEventSubmitValues", () => {
  it("rejects empty title", () => {
    const result = buildUserEventSubmitValues({
      ...EMPTY_USER_EVENT_FORM,
      title: "  ",
      startTime: "2026-07-21T09:00",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKey).toBe("userEvent.errors.titleRequired");
    }
  });

  it("builds timed one-off wire values", () => {
    const result = buildUserEventSubmitValues({
      ...EMPTY_USER_EVENT_FORM,
      title: "  Meet  ",
      startTime: "2026-07-21T09:00",
      endTime: "2026-07-21T10:00",
      location: "  HQ ",
      body: " notes ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.kind).toBe("one_off");
      expect(result.values.title).toBe("Meet");
      expect(result.values.location).toBe("HQ");
      expect(result.values.body).toBe("notes");
      expect(result.values.worksetId).toBe(SYSTEM_WORKSET_ID);
      expect(result.values.startTime).toBeTruthy();
      expect(result.values.isAllDay).toBe(false);
    }
  });

  it("builds all-day one-off with exclusive end", () => {
    const result = buildUserEventSubmitValues({
      ...EMPTY_USER_EVENT_FORM,
      title: "Trip",
      isAllDay: true,
      startTime: "2026-07-21",
      endTime: "2026-07-22",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.isAllDay).toBe(true);
      expect(result.values.startTime).toMatch(/2026-07-21/);
      expect(result.values.endTime).toBeTruthy();
    }
  });

  it("requires rrule for recurring events", () => {
    const result = buildUserEventSubmitValues({
      ...EMPTY_USER_EVENT_FORM,
      kind: "recurring",
      title: "Standup",
      rrule: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKey).toBe("userEvent.errors.rruleRequired");
    }
  });

  it("builds recurring timed payload", () => {
    const result = buildUserEventSubmitValues({
      ...EMPTY_USER_EVENT_FORM,
      kind: "recurring",
      title: "Standup",
      rrule: "FREQ=DAILY;INTERVAL=1",
      isAllDay: false,
      eventStartTime: "09:30",
      eventEndTime: "10:00",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.kind).toBe("recurring");
      expect(result.values.rrule).toBe("FREQ=DAILY;INTERVAL=1");
      expect(result.values.eventStartTime).toBe("09:30");
      expect(result.values.eventEndTime).toBe("10:00");
      expect(result.values.startTime).toBe("");
    }
  });
});
