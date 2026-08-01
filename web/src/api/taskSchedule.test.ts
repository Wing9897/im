/**
 * Unit tests for src/api/taskSchedule.ts — OpenAPI-aligned schedule subresource.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  deleteTaskSchedule,
  fetchTaskSchedule,
  putTaskSchedule,
  type TaskSchedule,
  type TaskScheduleConfig,
} from "./taskSchedule";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("taskSchedule API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchTaskSchedule GETs /tasks/{id}/schedule", async () => {
    const schedule: TaskSchedule = {
      taskId: "t-1",
      rrule: "FREQ=DAILY",
      eventIsAllDay: false,
      eventStartTime: "09:00",
      eventEndTime: "10:00",
    };
    vi.mocked(apiClient.get).mockResolvedValue(schedule);

    const result = await fetchTaskSchedule("t-1");

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/tasks/t-1/schedule");
    expect(result).toEqual(schedule);
  });

  it("putTaskSchedule PUTs TaskScheduleBody shape", async () => {
    const body: TaskScheduleConfig = {
      rrule: "FREQ=WEEKLY",
      eventIsAllDay: true,
      eventStartTime: null,
      eventEndTime: null,
    };
    const response: TaskSchedule = { taskId: "t-1", ...body };
    vi.mocked(apiClient.put).mockResolvedValue(response);

    const result = await putTaskSchedule("t-1", body);

    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/tasks/t-1/schedule", body);
    expect(result).toEqual(response);
  });

  it("deleteTaskSchedule deletes the schedule subresource", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);

    await deleteTaskSchedule("t-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/tasks/t-1/schedule");
  });
});
