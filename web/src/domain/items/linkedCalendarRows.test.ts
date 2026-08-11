import { describe, expect, it } from "vitest";
import type { UserEvent } from "../../api/userEvents";
import type { RecurringSeries } from "../../types/recurring";
import {
  countActiveLinkedExpiryEvents,
  mergeLinkedCalendarRows,
  toLinkedOneOffRow,
  toLinkedRecurringRow,
} from "./linkedCalendarRows";

function makeEvent(overrides: Partial<UserEvent> = {}): UserEvent {
  return {
    id: "ue-1",
    title: "到期",
    startTime: "2026-08-10T00:00:00.000Z",
    endTime: null,
    body: "",
    location: "",
    isAllDay: true,
    worksetId: "ws",
    itemId: "item-1",
    dismissed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSeries(overrides: Partial<RecurringSeries> = {}): RecurringSeries {
  return {
    id: "task-1",
    name: "Recurring",
    description: null,
    rrule: "FREQ=WEEKLY",
    eventStartTime: "09:00",
    eventEndTime: null,
    eventIsAllDay: false,
    eventLocation: null,
    eventDescription: null,
    eventTimezone: null,
    eventExdates: [],
    eventRdates: [],
    icsUid: null,
    icsSource: null,
    isActive: true,
    worksetId: "ws",
    parentTaskId: null,
    itemId: "item-1",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("mergeLinkedCalendarRows", () => {
  it("keeps all non-dismissed events including primary expiry, then sorts", () => {
    const primary = makeEvent({
      id: "exp-primary",
      title: "到期",
      kind: "expires",
      startTime: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const secondaryExpiry = makeEvent({
      id: "exp-secondary",
      title: "Expires",
      kind: "expires",
      startTime: "2026-10-01T00:00:00.000Z",
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    const kept = makeEvent({
      id: "a",
      title: "A",
      kind: "normal",
      startTime: "2026-08-01T00:00:00.000Z",
    });
    const dismissed = makeEvent({
      id: "b",
      title: "B",
      kind: "normal",
      startTime: "2026-07-01T00:00:00.000Z",
      dismissed: true,
    });
    const recurring = makeSeries({ id: "r1", name: "R", createdAt: "2026-08-15T00:00:00.000Z" });

    const rows = mergeLinkedCalendarRows(
      [primary, secondaryExpiry, kept, dismissed],
      [recurring],
    );
    expect(rows.map((r) => r.id)).toEqual([
      "ue:a",
      "rs:r1",
      "ue:exp-primary",
      "ue:exp-secondary",
    ]);
    expect(rows[0]?.kind).toBe("oneOff");
    expect(rows[1]?.kind).toBe("recurring");
  });

  it("counts active expires for primary badge", () => {
    const events = [
      makeEvent({ id: "a", kind: "expires", dismissed: false }),
      makeEvent({ id: "b", kind: "expires", dismissed: true }),
      makeEvent({ id: "c", kind: "expires", dismissed: false }),
      makeEvent({ id: "d", kind: "normal", dismissed: false }),
    ];
    expect(countActiveLinkedExpiryEvents(events)).toBe(2);
  });
});

describe("row mappers", () => {
  it("maps one-off and recurring rows", () => {
    const oneOff = toLinkedOneOffRow(makeEvent({ title: "Meet" }));
    expect(oneOff).toMatchObject({ kind: "oneOff", title: "Meet", id: "ue:ue-1" });

    const recurring = toLinkedRecurringRow(makeSeries({ name: "Weekly" }));
    expect(recurring).toMatchObject({
      kind: "recurring",
      title: "Weekly",
      detail: "FREQ=WEEKLY",
      seriesId: "task-1",
    });
  });
});
