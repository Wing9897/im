import { beforeEach, describe, expect, it, vi } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { createRecurringTimelineEvent } from "./createRecurringTimelineEvent";

const { mockCreateRecurringSeries } = vi.hoisted(() => ({
  mockCreateRecurringSeries: vi.fn(),
}));

vi.mock("../../api/recurringSeries", () => ({
  createRecurringSeries: (...args: unknown[]) => mockCreateRecurringSeries(...args),
}));

describe("createRecurringTimelineEvent", () => {
  beforeEach(() => {
    mockCreateRecurringSeries.mockReset().mockResolvedValue({
      id: "rec-1",
    });
  });

  it("posts a single atomic recurring create", async () => {
    await createRecurringTimelineEvent({
      title: "  Standup  ",
      worksetId: SYSTEM_WORKSET_ID,
      isAllDay: false,
      eventStartTime: "09:00",
      eventEndTime: "09:30",
      location: "Room A",
      body: "Daily sync",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
    });

    expect(mockCreateRecurringSeries).toHaveBeenCalledWith({
      name: "Standup",
      description: "Daily sync",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      eventStartTime: "09:00",
      eventEndTime: "09:30",
      eventIsAllDay: false,
      eventLocation: "Room A",
      eventDescription: "Daily sync",
      worksetId: SYSTEM_WORKSET_ID,
      itemId: null,
    });
  });

  it("forwards parent itemId on recurring create", async () => {
    await createRecurringTimelineEvent({
      title: "Renewal",
      worksetId: SYSTEM_WORKSET_ID,
      isAllDay: true,
      eventStartTime: "",
      rrule: "FREQ=YEARLY",
      itemId: " item-9 ",
    });

    expect(mockCreateRecurringSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "item-9",
        eventIsAllDay: true,
      }),
    );
  });

  it("omits clocks for all-day recurring plans", async () => {
    await createRecurringTimelineEvent({
      title: "Holiday",
      worksetId: "",
      isAllDay: true,
      eventStartTime: "09:00",
      eventEndTime: "10:00",
      rrule: "FREQ=YEARLY",
    });

    expect(mockCreateRecurringSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        eventIsAllDay: true,
        eventStartTime: null,
        eventEndTime: null,
        rrule: "FREQ=YEARLY",
        worksetId: SYSTEM_WORKSET_ID,
      }),
    );
  });

  it("rejects missing title or rrule before calling the API", async () => {
    await expect(
      createRecurringTimelineEvent({
        title: "  ",
        worksetId: SYSTEM_WORKSET_ID,
        isAllDay: false,
        eventStartTime: "09:00",
        rrule: "FREQ=DAILY",
      }),
    ).rejects.toThrow("title is required");

    await expect(
      createRecurringTimelineEvent({
        title: "Broken",
        worksetId: SYSTEM_WORKSET_ID,
        isAllDay: false,
        eventStartTime: "09:00",
        rrule: "  ",
      }),
    ).rejects.toThrow("rrule is required");

    expect(mockCreateRecurringSeries).not.toHaveBeenCalled();
  });
});
