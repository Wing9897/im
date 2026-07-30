/**
 * Regression tests for recurring-task occurrence wiring.
 *
 * Recurring tasks are expanded server-side (GET /api/v1/results/calendar).
 * These tests pin:
 * - occurrences are fetched for the visible range (padded for the month grid)
 * - occurrences are adapted to TimelineItem with source: "recurring"
 * - "all tasks" merges analysis + calendar occurrences
 * - filtering by a recurring task shows only that task's occurrences
 * - filtering by an event task does not mix in calendar occurrences
 * - timelineTasks includes event, recurring, and calendar_task modes
 * - __user__ workset shows its owned user_events (incl. tagged provenance); other worksets excluded
 * - task filters include tagged user_events for that task
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarOccurrence } from "../../types";
import { getGeneralWorksetLabel } from "../../domain/timeline/userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";

const {
  mockFetchTimelineEvents,
  mockFetchCalendarOccurrences,
  mockFetchTaskActivitySpans,
  mockListUserEvents,
} = vi.hoisted(() => ({
  mockFetchTimelineEvents: vi.fn().mockResolvedValue([]),
  mockFetchCalendarOccurrences: vi.fn().mockResolvedValue([]),
  mockFetchTaskActivitySpans: vi.fn().mockResolvedValue([]),
  mockListUserEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/results", () => ({
  fetchTimelineEvents: (...args: unknown[]) => mockFetchTimelineEvents(...args),
  fetchCalendarOccurrences: (...args: unknown[]) => mockFetchCalendarOccurrences(...args),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEvents: (...args: unknown[]) => mockListUserEvents(...args),
}));

vi.mock("../../api/tasks", () => ({
  fetchTaskActivitySpans: (...args: unknown[]) => mockFetchTaskActivitySpans(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../hooks/useRefreshOnAnalysisEvent", () => ({
  useRefreshOnAnalysisEvent: vi.fn(),
}));

import { makeAnalysisTask, resetTaskCatalogState } from "../../test/context-mocks";
import { calendarOccurrenceToBoardEvent } from "../../domain/timeline/timedEventMerge";
import { useTimelineData } from "./useTimelineData";

type HookResult = ReturnType<typeof useTimelineData>;

function makeOccurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: "cal-1:20250115T090000Z",
    taskId: "cal-1",
    taskName: "Weekly Standup",
    title: "Weekly Standup",
    startTime: "2025-01-15T09:00:00Z",
    endTime: "2025-01-15T10:00:00Z",
    isAllDay: false,
    location: null,
    description: "Team sync",
    rrule: "FREQ=WEEKLY;BYDAY=WE",
    ...overrides,
  };
}

describe("calendarOccurrenceToBoardEvent (timeline wiring)", () => {
  it("adapts an occurrence with the calendar discriminator and all-day flag", () => {
    const event = calendarOccurrenceToBoardEvent(makeOccurrence({ isAllDay: true }));
    expect(event.source).toBe("recurring");
    expect(event.isAllDay).toBe(true);
    expect(event.id).toBe("cal-1:20250115T090000Z");
    expect(event.title).toBe("Weekly Standup");
    expect(event.body).toBe("Team sync");
    expect(event.startTime).toBe("2025-01-15T09:00:00Z");
    expect(event.endTime).toBe("2025-01-15T10:00:00Z");
    expect(event.taskName).toBe("Weekly Standup");
    expect(event.participants).toEqual([]);
  });
});

describe("useTimelineData calendar occurrence wiring", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: HookResult | null };

  const rangeStart = new Date("2025-01-01T00:00:00Z");
  const rangeEnd = new Date("2025-02-01T00:00:00Z");

  function HookHarness({
    selectedSources,
    refOut,
  }: {
    selectedSources: SourceFilterSelection;
    refOut: { current: HookResult | null };
  }) {
    const result = useTimelineData({
      selectedSources,
      viewMode: "calendar",
      rangeStart,
      rangeEnd,
    });
    refOut.current = result;
    return null;
  }

  async function renderHook(selectedSources: SourceFilterSelection = null) {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(HookHarness, { selectedSources, refOut: resultRef }));
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockFetchTimelineEvents.mockReset().mockResolvedValue([]);
    mockFetchCalendarOccurrences.mockReset().mockResolvedValue([]);
    mockFetchTaskActivitySpans.mockReset().mockResolvedValue([]);
    mockListUserEvents.mockReset().mockResolvedValue([]);
    resetTaskCatalogState();
    resultRef = { current: null };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    container.remove();
  });

  it("fetches calendar occurrences with a window padded around the visible range", async () => {
    await renderHook();
    expect(mockFetchCalendarOccurrences).toHaveBeenCalled();
    const [startIso, endIso] = mockFetchCalendarOccurrences.mock.calls[0] as [string, string];
    expect(new Date(startIso).getTime()).toBeLessThan(rangeStart.getTime());
    expect(new Date(endIso).getTime()).toBeGreaterThan(rangeEnd.getTime());
  });

  it("fetches all timed analysis pages within the same padded visible window", async () => {
    await renderHook();
    expect(mockFetchTimelineEvents).toHaveBeenCalledWith({
      taskId: undefined,
      startDate: "2024-12-25T00:00:00.000Z",
      endDate: "2025-02-08T00:00:00.000Z",
    });
  });

  it("merges adapted occurrences into events in the all-tasks view", async () => {
    mockFetchCalendarOccurrences.mockResolvedValue([makeOccurrence()]);
    await renderHook(null);
    const events = resultRef.current!.events;
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("recurring");
    expect(events[0].title).toBe("Weekly Standup");
  });

  it("merges user events into the all-tasks view", async () => {
    mockListUserEvents.mockResolvedValue([
      {
        id: "ue-1",
        title: "用戶事件",
        body: "",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "",
        createdAt: "2025-01-12T08:00:00Z",
        updatedAt: "2025-01-12T08:00:00Z",
      },
    ]);
    await renderHook(null);
    await act(async () => {
      await Promise.resolve();
    });
    const events = resultRef.current!.events;
    expect(events.some((e) => e.id === "ue-1" && e.source === "user")).toBe(true);
    expect(events.find((e) => e.id === "ue-1")?.taskName).toBe(getGeneralWorksetLabel());
    expect(mockListUserEvents).toHaveBeenCalled();
  });

  it("shows all user events owned by the general workset when __user__ is selected", async () => {
    mockFetchCalendarOccurrences.mockResolvedValue([makeOccurrence()]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "ue-only",
        title: "用戶事件",
        body: "",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        location: null,
        origin: "assistant",
        source: "user",
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
        createdAt: "2025-01-12T08:00:00Z",
        updatedAt: "2025-01-12T08:00:00Z",
      },
      {
        id: "ue-tagged-same-ws",
        title: "同工作集但有 provenance",
        body: "",
        startTime: "2025-01-12T09:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "ct-1",
        worksetId: SYSTEM_WORKSET_ID,
        createdAt: "2025-01-12T09:00:00Z",
        updatedAt: "2025-01-12T09:00:00Z",
      },
      {
        id: "ue-other-ws",
        title: "其他工作集",
        body: "",
        startTime: "2025-01-12T10:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "",
        worksetId: "ws-ops",
        createdAt: "2025-01-12T10:00:00Z",
        updatedAt: "2025-01-12T10:00:00Z",
      },
    ]);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    await act(async () => {
      await Promise.resolve();
    });
    const events = resultRef.current!.events;
    expect(events.map((e) => e.id).sort()).toEqual(["ue-only", "ue-tagged-same-ws"]);
    expect(events.every((e) => e.source === "user")).toBe(true);
    expect(events.find((e) => e.id === "ue-only")?.taskName).toBe(getGeneralWorksetLabel());
    expect(mockFetchTimelineEvents).not.toHaveBeenCalled();
    expect(mockFetchCalendarOccurrences).not.toHaveBeenCalled();
    expect(resultRef.current!.timelineEvents).toHaveLength(2);
    expect(resultRef.current!.timelineEventsInitialLoading).toBe(false);
  });

  it("does not merge calendar occurrences when an event-mode task is selected", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "timeline-task-1", name: "Event Task", analysisMode: "event" }),
      makeAnalysisTask({ id: "cal-1", name: "Weekly Standup", analysisMode: "recurring" }),
    ]);
    mockFetchCalendarOccurrences.mockResolvedValue([makeOccurrence()]);
    await renderHook({ taskIds: ["timeline-task-1"], worksetIds: [] });
    expect(resultRef.current!.events).toHaveLength(0);
    expect(mockListUserEvents).toHaveBeenCalled();
  });

  it("merges tagged user events when an event-mode task is selected", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "timeline-task-1", name: "Event Task", analysisMode: "event" }),
    ]);
    mockFetchTimelineEvents.mockResolvedValue([
      {
        id: "analysis-1",
        taskId: "timeline-task-1",
        version: 1,
        batchId: "b1",
        title: "分析事件",
        body: "",
        startTime: "2025-01-10T00:00:00Z",
        endTime: null,
        location: null,
        latitude: null,
        longitude: null,
        participants: [],
        sourceMessageId: null,
        sourcePlatform: null,
        sourceChannelName: null,
        sourceMessageTime: null,
        analysisTimeRange: null,
        batchSourceChannelNames: [],
        taskName: "Event Task",
        createdAt: "2025-01-10T00:00:00Z",
        updatedAt: "2025-01-10T00:00:00Z",
      },
    ]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "ue-match",
        title: "掛到事件任務",
        body: "",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "timeline-task-1",
        createdAt: "2025-01-12T08:00:00Z",
        updatedAt: "2025-01-12T08:00:00Z",
      },
      {
        id: "ue-other",
        title: "其他",
        body: "",
        startTime: "2025-01-12T09:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "",
        createdAt: "2025-01-12T09:00:00Z",
        updatedAt: "2025-01-12T09:00:00Z",
      },
    ]);
    await renderHook({ taskIds: ["timeline-task-1"], worksetIds: [] });
    await act(async () => {
      await Promise.resolve();
    });
    const ids = resultRef.current!.events.map((e) => e.id).sort();
    expect(ids).toEqual(["analysis-1", "ue-match"]);
  });

  it("filters calendar occurrences when a recurring task is selected", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "cal-1", name: "Weekly Standup", analysisMode: "recurring" }),
      makeAnalysisTask({ id: "cal-2", name: "Other Cal", analysisMode: "recurring" }),
    ]);
    mockFetchCalendarOccurrences.mockResolvedValue([
      makeOccurrence({ id: "cal-1:a", taskId: "cal-1", title: "Standup" }),
      makeOccurrence({ id: "cal-2:b", taskId: "cal-2", title: "Other", taskName: "Other Cal" }),
    ]);
    await renderHook({ taskIds: ["cal-1"], worksetIds: [] });
    const events = resultRef.current!.events;
    expect(events).toHaveLength(1);
    expect(events[0].taskId).toBe("cal-1");
    expect(events[0].source).toBe("recurring");
    expect(mockFetchTimelineEvents).not.toHaveBeenCalled();
  });

  it("shows only tagged user events when a calendar_task is selected", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "ct-1", name: "日曆任務", analysisMode: "calendar_task" }),
    ]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "ue-calendar-task",
        title: "日曆任務事件",
        body: "",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "ct-1",
        createdAt: "2025-01-12T08:00:00Z",
        updatedAt: "2025-01-12T08:00:00Z",
      },
      {
        id: "ue-free",
        title: "未歸屬",
        body: "",
        startTime: "2025-01-12T09:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "",
        createdAt: "2025-01-12T09:00:00Z",
        updatedAt: "2025-01-12T09:00:00Z",
      },
    ]);
    await renderHook({ taskIds: ["ct-1"], worksetIds: [] });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resultRef.current!.events).toHaveLength(1);
    expect(resultRef.current!.events[0].id).toBe("ue-calendar-task");
    expect(resultRef.current!.events[0].taskId).toBe("ct-1");
    expect(mockFetchTimelineEvents).not.toHaveBeenCalled();
    expect(mockFetchCalendarOccurrences).not.toHaveBeenCalled();
  });

  it("includes event, recurring, calendar_task, and project modes in timelineTasks", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "evt-1", name: "Event Task", analysisMode: "event" }),
      makeAnalysisTask({ id: "cal-1", name: "Calendar Task", analysisMode: "recurring" }),
      makeAnalysisTask({ id: "ct-1", name: "Calendar Task Bucket", analysisMode: "calendar_task" }),
      makeAnalysisTask({ id: "proj-1", name: "Project Alpha", analysisMode: "project" }),
      makeAnalysisTask({ id: "lb-1", name: "Leaderboard", analysisMode: "leaderboard" }),
    ]);
    await renderHook(null);
    const ids = resultRef.current!.timelineTasks.map((t) => t.id);
    expect(ids).toEqual(["evt-1", "cal-1", "ct-1", "proj-1"]);
  });

  it("drops soft-deleted calendar tasks from the assignable timeline task list", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "cal-live", name: "Live", analysisMode: "recurring" }),
      makeAnalysisTask({
        id: "cal-deleted",
        name: "Soft deleted",
        analysisMode: "recurring",
        isActive: false,
      }),
    ]);
    await renderHook(null);
    const ids = resultRef.current!.timelineTasks.map((t) => t.id);
    expect(ids).toEqual(["cal-live"]);
  });

  it("surfaces a calendar occurrence fetch failure instead of an empty calendar", async () => {
    mockFetchCalendarOccurrences.mockRejectedValue(new Error("calendar boom"));
    await renderHook(null);
    await act(async () => {
      await Promise.resolve();
    });
    expect(resultRef.current!.pageError).toBe("calendar boom");
    expect(resultRef.current!.timelineEventsError).toBe("calendar boom");
  });

  it("surfaces a user event fetch failure instead of an empty calendar", async () => {
    mockListUserEvents.mockRejectedValue(new Error("user events boom"));
    await renderHook(null);
    await act(async () => {
      await Promise.resolve();
    });
    expect(resultRef.current!.pageError).toBe("user events boom");
    expect(resultRef.current!.timelineEventsError).toBe("user events boom");
  });

  it("ignores a calendar failure in a mode that does not fetch calendar occurrences", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "ct-1", name: "日曆任務", analysisMode: "calendar_task" }),
    ]);
    mockFetchCalendarOccurrences.mockRejectedValue(new Error("calendar boom"));
    await renderHook({ taskIds: ["ct-1"], worksetIds: [] });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resultRef.current!.pageError).toBeNull();
  });

  it("leaves schedule events untouched when there are no occurrences", async () => {
    const scheduleEvent = {
      id: "evt-1",
      taskId: "t1",
      version: 1,
      batchId: "b1",
      title: "分析事件",
      body: "",
      startTime: "2025-01-10T00:00:00Z",
      endTime: null,
      location: null,
      latitude: null,
      longitude: null,
      participants: [],
      sourceMessageId: null,
      sourcePlatform: null,
      sourceChannelName: null,
      sourceMessageTime: null,
      analysisTimeRange: null,
      batchSourceChannelNames: [],
      taskName: "任務",
      createdAt: "2025-01-10T00:00:00Z",
      updatedAt: "2025-01-10T00:00:00Z",
    };
    mockFetchTimelineEvents.mockResolvedValue([scheduleEvent]);
    await renderHook(null);
    expect(resultRef.current!.events).toEqual([scheduleEvent]);
  });
});
