import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./client";
import {
  createUserEvent,
  deleteUserEvent,
  listUserEvents,
  type UserEvent,
  updateUserEvent,
} from "./userEvents";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("user events API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists events with the requested overlap window", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    await listUserEvents({
      start: "2026-07-01T00:00:00Z",
      end: "2026-08-01T00:00:00Z",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      start: "2026-07-01T00:00:00Z",
      end: "2026-08-01T00:00:00Z",
    });
  });

  it("preserves the generated a2a origin contract", async () => {
    const event: UserEvent = {
      id: "event-a2a",
      title: "Agent event",
      body: "",
      startTime: "2026-07-28T09:00:00Z",
      endTime: null,
      location: null,
      origin: "a2a",
      taskId: "",
      source: "user",
      dismissed: false,
      createdAt: "2026-07-28T08:00:00Z",
      updatedAt: "2026-07-28T08:00:00Z",
    };
    vi.mocked(apiClient.get).mockResolvedValue([event]);

    await expect(listUserEvents()).resolves.toEqual([expect.objectContaining({ origin: "a2a" })]);
  });

  it("forwards taskId on list when provided", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    await listUserEvents({ taskId: "proj-1" });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      task_id: "proj-1",
    });
  });

  it("creates a manual REST event without a client-controlled origin", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    await createUserEvent({
      title: "Manual event",
      startTime: "2026-07-20T10:00:00Z",
      endTime: null,
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      title: "Manual event",
      startTime: "2026-07-20T10:00:00Z",
      endTime: null,
      body: "",
      location: "",
    });
  });

  it("forwards taskId on create when provided", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    await createUserEvent({
      title: "Tagged",
      startTime: "2026-07-20T10:00:00Z",
      taskId: "__user__",
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      title: "Tagged",
      startTime: "2026-07-20T10:00:00Z",
      endTime: null,
      body: "",
      location: "",
      taskId: "__user__",
    });
  });

  it("patches only supplied editable fields", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({});

    await updateUserEvent("event-1", { title: "Renamed", endTime: null });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/calendar/user-events/event-1", {
      title: "Renamed",
      endTime: null,
    });
  });

  it("patches taskId when provided", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({});

    await updateUserEvent("event-1", { taskId: "ct-1" });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/calendar/user-events/event-1", {
      taskId: "ct-1",
    });
  });

  it("deletes by event id", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);

    await deleteUserEvent("event-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/calendar/user-events/event-1");
  });
});
