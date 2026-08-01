import { beforeEach, describe, expect, it, vi } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { createRecurringTimelineEvent } from "./createRecurringTimelineEvent";

const { mockCreateRecurringTask } = vi.hoisted(() => ({
  mockCreateRecurringTask: vi.fn(),
}));

vi.mock("../../api/tasks", () => ({
  createRecurringTask: (...args: unknown[]) => mockCreateRecurringTask(...args),
}));

describe("createRecurringTimelineEvent", () => {
  beforeEach(() => {
    mockCreateRecurringTask.mockReset().mockResolvedValue({
      id: "rec-1",
      deletedBatchCount: 0,
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

    expect(mockCreateRecurringTask).toHaveBeenCalledWith({
      name: "Standup",
      description: "Daily sync",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      eventStartTime: "09:00",
      eventEndTime: "09:30",
      eventIsAllDay: false,
      eventLocation: "Room A",
      eventDescription: "Daily sync",
      worksetId: SYSTEM_WORKSET_ID,
    });
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

    expect(mockCreateRecurringTask).toHaveBeenCalledWith(
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

    expect(mockCreateRecurringTask).not.toHaveBeenCalled();
  });
});
