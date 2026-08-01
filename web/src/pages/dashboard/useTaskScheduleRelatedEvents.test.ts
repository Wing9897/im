import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "../../api/client";

const {
  mockListUserEvents,
  mockFetchCalendarOccurrences,
  mockFetchTaskSchedule,
} = vi.hoisted(() => ({
  mockListUserEvents: vi.fn(),
  mockFetchCalendarOccurrences: vi.fn(),
  mockFetchTaskSchedule: vi.fn(),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEvents: (...args: unknown[]) => mockListUserEvents(...args),
}));

vi.mock("../../api/results", () => ({
  fetchCalendarOccurrences: (...args: unknown[]) =>
    mockFetchCalendarOccurrences(...args),
}));

vi.mock("../../api/taskSchedule", () => ({
  fetchTaskSchedule: (...args: unknown[]) => mockFetchTaskSchedule(...args),
}));

const { isScheduleOnlyAnalysisMode, useTaskScheduleRelatedEvents } = await import(
  "./useTaskScheduleRelatedEvents"
);

describe("isScheduleOnlyAnalysisMode", () => {
  it("matches recurring only", () => {
    expect(isScheduleOnlyAnalysisMode("recurring")).toBe(true);
    expect(isScheduleOnlyAnalysisMode("project")).toBe(false);
    expect(isScheduleOnlyAnalysisMode("event")).toBe(false);
    expect(isScheduleOnlyAnalysisMode("leaderboard")).toBe(false);
  });
});

describe("useTaskScheduleRelatedEvents", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useTaskScheduleRelatedEvents> | null = null;
  let setTaskId: ((id: string) => void) | null = null;

  function Harness({ taskId }: { taskId: string }) {
    const [id, setId] = useState(taskId);
    setTaskId = setId;
    latest = useTaskScheduleRelatedEvents(id, "recurring");
    return null;
  }

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    latest = null;
    setTaskId = null;
    mockListUserEvents.mockReset();
    mockFetchCalendarOccurrences.mockReset();
    mockFetchTaskSchedule.mockReset();
    mockListUserEvents.mockResolvedValue([]);
    mockFetchCalendarOccurrences.mockResolvedValue([
      {
        id: "occ-1",
        taskId: "rec-1",
        title: "Standup",
        startTime: "2026-08-01T01:00:00Z",
        endTime: "2026-08-01T01:30:00Z",
        location: null,
        description: null,
        isAllDay: false,
      },
    ]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("treats schedule 404 as no location without error", async () => {
    mockFetchTaskSchedule.mockRejectedValue(
      new ApiRequestError(404, { error: "not_found", message: "Task schedule not found" }),
    );

    await act(async () => {
      root.render(createElement(Harness, { taskId: "rec-1" }));
      await flush();
    });

    expect(latest?.loading).toBe(false);
    expect(latest?.error).toBeNull();
    expect(latest?.eventLocation).toBeNull();
    expect(latest?.items).toHaveLength(1);
    expect(latest?.items[0]?.title).toBe("Standup");
  });

  it("sets location from a successful schedule fetch", async () => {
    mockFetchTaskSchedule.mockResolvedValue({
      taskId: "rec-1",
      rrule: "FREQ=DAILY",
      eventLocation: "  Room A  ",
    });

    await act(async () => {
      root.render(createElement(Harness, { taskId: "rec-1" }));
      await flush();
    });

    expect(latest?.error).toBeNull();
    expect(latest?.eventLocation).toBe("Room A");
    expect(latest?.items).toHaveLength(1);
  });

  it("keeps prior location and sets error when schedule reload fails", async () => {
    mockFetchTaskSchedule.mockResolvedValue({
      taskId: "rec-1",
      rrule: "FREQ=DAILY",
      eventLocation: "Room A",
    });

    await act(async () => {
      root.render(createElement(Harness, { taskId: "rec-1" }));
      await flush();
    });
    expect(latest?.eventLocation).toBe("Room A");
    expect(latest?.error).toBeNull();

    mockFetchTaskSchedule.mockRejectedValue(new Error("schedule upstream timeout"));
    mockFetchCalendarOccurrences.mockResolvedValue([
      {
        id: "occ-2",
        taskId: "rec-2",
        title: "Sync",
        startTime: "2026-08-01T02:00:00Z",
        endTime: null,
        location: null,
        description: null,
        isAllDay: false,
      },
    ]);

    await act(async () => {
      setTaskId?.("rec-2");
      await flush();
    });

    expect(latest?.error).toBe("schedule upstream timeout");
    expect(latest?.items.map((item) => item.title)).toEqual(["Sync"]);
    // Soft fail preserves previous location rather than pretending none exists.
    expect(latest?.eventLocation).toBe("Room A");
  });
});
