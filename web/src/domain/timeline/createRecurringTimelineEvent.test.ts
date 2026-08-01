import { beforeEach, describe, expect, it, vi } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { createRecurringTimelineEvent } from "./createRecurringTimelineEvent";

const { mockCreateTask, mockPutTaskSchedule, mockDeleteTask } = vi.hoisted(() => ({
  mockCreateTask: vi.fn(),
  mockPutTaskSchedule: vi.fn(),
  mockDeleteTask: vi.fn(),
}));

vi.mock("../../api/tasks", () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
  deleteTask: (...args: unknown[]) => mockDeleteTask(...args),
}));

vi.mock("../../api/taskSchedule", () => ({
  putTaskSchedule: (...args: unknown[]) => mockPutTaskSchedule(...args),
}));

describe("createRecurringTimelineEvent", () => {
  beforeEach(() => {
    mockCreateTask.mockReset().mockResolvedValue({ id: "rec-1", deletedBatchCount: 0 });
    mockPutTaskSchedule.mockReset().mockResolvedValue({ taskId: "rec-1", rrule: "FREQ=DAILY" });
    mockDeleteTask.mockReset().mockResolvedValue({ deletedBatchCount: 0 });
  });

  it("creates a recurring shell then upserts the schedule", async () => {
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

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Standup",
        analysisMode: "recurring",
        worksetId: SYSTEM_WORKSET_ID,
        includeInTimeline: true,
        promptTemplate: "",
        channelIds: [],
        description: "Daily sync",
      }),
    );
    expect(mockPutTaskSchedule).toHaveBeenCalledWith("rec-1", {
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      eventStartTime: "09:00",
      eventEndTime: "09:30",
      eventIsAllDay: false,
      eventLocation: "Room A",
      eventDescription: "Daily sync",
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

    expect(mockPutTaskSchedule).toHaveBeenCalledWith(
      "rec-1",
      expect.objectContaining({
        eventIsAllDay: true,
        eventStartTime: null,
        eventEndTime: null,
        rrule: "FREQ=YEARLY",
      }),
    );
  });

  it("deletes the shell task when schedule upsert fails", async () => {
    mockPutTaskSchedule.mockRejectedValueOnce(new Error("bad rrule"));

    await expect(
      createRecurringTimelineEvent({
        title: "Broken",
        worksetId: SYSTEM_WORKSET_ID,
        isAllDay: false,
        eventStartTime: "09:00",
        rrule: "FREQ=DAILY",
      }),
    ).rejects.toThrow("bad rrule");

    expect(mockDeleteTask).toHaveBeenCalledWith("rec-1");
  });
});
