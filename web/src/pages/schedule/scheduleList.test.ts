import { describe, expect, it } from "vitest";

import type { UserEvent } from "../../api/userEvents";
import { mergeScheduleList, activeScheduleOneOffs } from "./scheduleList";
import type { ScheduleRecurringItem } from "./useScheduleRecurringFeed";

function oneOff(partial: Partial<UserEvent> & Pick<UserEvent, "id" | "title">): UserEvent {
  return {
    body: "",
    startTime: "2026-01-01T00:00:00Z",
    endTime: null,
    location: null,
    origin: "manual",
    isAllDay: false,
    worksetId: "__general__",
    taskId: "",
    source: "user",
    dismissed: false,
    important: false,
    kind: "normal",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function series(
  partial: Partial<ScheduleRecurringItem> & Pick<ScheduleRecurringItem, "id" | "name">,
): ScheduleRecurringItem {
  return {
    description: null,
    rrule: "FREQ=DAILY",
    eventStartTime: null,
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
    worksetId: "__general__",
    parentTaskId: null,
    itemId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("mergeScheduleList", () => {
  it("mixes one-off and recurring sorted by newest activity", () => {
    const merged = mergeScheduleList(
      [oneOff({ id: "ue-old", title: "Old", updatedAt: "2026-01-01T00:00:00Z" })],
      [series({ id: "rec-new", name: "New", updatedAt: "2026-02-01T00:00:00Z" })],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ kind: "recurring", series: { id: "rec-new" } });
    expect(merged[1]).toMatchObject({ kind: "oneOff", event: { id: "ue-old" } });
  });

  it("drops dismissed one-offs from the manage list", () => {
    const merged = mergeScheduleList(
      [
        oneOff({ id: "keep", title: "Keep" }),
        oneOff({ id: "gone", title: "Gone", dismissed: true }),
      ],
      [],
    );
    expect(merged).toEqual([{ kind: "oneOff", event: expect.objectContaining({ id: "keep" }) }]);
    expect(activeScheduleOneOffs([oneOff({ id: "gone", title: "Gone", dismissed: true })])).toEqual([]);
  });
});
