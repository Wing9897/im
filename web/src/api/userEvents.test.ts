import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./client";
import {
  createUserEvent,
  deleteUserEvent,
  listUserEventsPage,
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
    vi.mocked(apiClient.get).mockResolvedValue({ items: [], totalCount: 0, hasMore: false });

    await listUserEventsPage({
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
      kind: "normal",
      source: "user",
      dismissed: false,
      important: false,
      createdAt: "2026-07-28T08:00:00Z",
      updatedAt: "2026-07-28T08:00:00Z",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ items: [event], totalCount: 1, hasMore: false });

    await expect(listUserEventsPage()).resolves.toEqual({
      items: [expect.objectContaining({ origin: "a2a" })],
      totalCount: 1,
      hasMore: false,
    });
  });

  it("forwards taskId on list when provided", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [], totalCount: 0, hasMore: false });

    await listUserEventsPage({ taskId: "proj-1" });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      taskId: "proj-1",
    });
  });

  it("forwards search and paging params and returns the page envelope", async () => {
    const event: UserEvent = {
      id: "event-page",
      title: "Paged",
      body: "",
      startTime: "2026-07-28T09:00:00Z",
      endTime: null,
      location: null,
      origin: "manual",
      taskId: "",
      kind: "normal",
      source: "user",
      dismissed: false,
      important: false,
      createdAt: "2026-07-28T08:00:00Z",
      updatedAt: "2026-07-28T08:00:00Z",
    };
    vi.mocked(apiClient.get).mockResolvedValue({ items: [event], totalCount: 3, hasMore: true });

    await expect(
      listUserEventsPage({ search: "Paged", limit: 1, offset: 2 }),
    ).resolves.toEqual({
      items: [expect.objectContaining({ id: "event-page" })],
      totalCount: 3,
      hasMore: true,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      search: "Paged",
      limit: "1",
      offset: "2",
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
      isAllDay: false,
      remindBeforeDays: null,
    });
  });

  it("forwards real provenance taskId on create", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    await createUserEvent({
      title: "Tagged",
      startTime: "2026-07-20T10:00:00Z",
      taskId: "ct-1",
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      title: "Tagged",
      startTime: "2026-07-20T10:00:00Z",
      endTime: null,
      body: "",
      location: "",
      isAllDay: false,
      remindBeforeDays: null,
      taskId: "ct-1",
    });
  });

  it("strips fake __general__ taskId on create (worksetId __general__ stays live)", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    await createUserEvent({
      title: "Owned",
      startTime: "2026-07-20T10:00:00Z",
      taskId: "__general__",
      worksetId: "__general__",
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      title: "Owned",
      startTime: "2026-07-20T10:00:00Z",
      endTime: null,
      body: "",
      location: "",
      isAllDay: false,
      remindBeforeDays: null,
      taskId: null,
      worksetId: "__general__",
    });
  });

  it("forwards isAllDay on create", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    await createUserEvent({
      title: "Holiday",
      startTime: "2026-08-01T00:00:00Z",
      endTime: "2026-08-04T00:00:00Z",
      isAllDay: true,
    });

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      title: "Holiday",
      startTime: "2026-08-01T00:00:00Z",
      endTime: "2026-08-04T00:00:00Z",
      body: "",
      location: "",
      isAllDay: true,
      remindBeforeDays: null,
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

  it("patches isAllDay when provided", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({});

    await updateUserEvent("event-1", { isAllDay: true });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/calendar/user-events/event-1", {
      isAllDay: true,
    });
  });

  it("patches taskId when provided", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({});

    await updateUserEvent("event-1", { taskId: "ct-1" });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/calendar/user-events/event-1", {
      taskId: "ct-1",
    });
  });

  it("strips fake __general__ taskId on patch", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({});

    await updateUserEvent("event-1", { taskId: "__general__" });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/calendar/user-events/event-1", {
      taskId: null,
    });
  });

  it("deletes by event id", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);

    await deleteUserEvent("event-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/calendar/user-events/event-1");
  });

  it("forwards itemId on create and list", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});
    vi.mocked(apiClient.get).mockResolvedValue({ items: [], totalCount: 0, hasMore: false });

    await createUserEvent({
      title: "Under item",
      startTime: "2026-07-20T10:00:00Z",
      itemId: " item-1 ",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      title: "Under item",
      startTime: "2026-07-20T10:00:00Z",
      endTime: null,
      body: "",
      location: "",
      isAllDay: false,
      remindBeforeDays: null,
      itemId: "item-1",
    });

    await listUserEventsPage({ itemId: "item-1" });
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar/user-events", {
      itemId: "item-1",
    });
  });
});
