/**
 * Regression tests for recurring-task occurrence wiring.
 *
 * Recurring tasks are expanded server-side (GET /api/v1/calendar/items).
 * These tests pin:
 * - occurrences are fetched for the visible range (padded for the month grid)
 * - occurrences are adapted to TimelineItem with source: "recurring"
 * - "all tasks" merges analysis + calendar occurrences
 * - filtering by a recurring task shows only that task's occurrences
 * - filtering by an event task does not mix in calendar occurrences
 * - timelineTasks includes event, recurring, and project modes
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

const mockUseRefreshOnAnalysisEvent = vi.hoisted(() => vi.fn());

vi.mock("../../hooks/useRefreshOnAnalysisEvent", () => ({
  useRefreshOnAnalysisEvent: (...args: unknown[]) => mockUseRefreshOnAnalysisEvent(...args),
}));

import { MemoryRouter } from "react-router-dom";
import {
  MONITOR_MODE_KEY,
  MonitorModeProvider,
} from "../../context/MonitorModeContext";
import { makeAnalysisTask, resetTaskCatalogState } from "../../test/context-mocks";
import { ANALYSIS_EVENTS_MODES } from "../../domain/tasks/analysisModeCapabilities";
import { calendarOccurrenceToBoardEvent } from "../../domain/timeline/timedEventMerge";
import { emitResourceModified } from "../../domain/sse/resourceModified";
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
    source: "recurring",
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
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(HookHarness, { selectedSources, refOut: resultRef }),
          ),
        ),
      );
    });
  }

  beforeEach(() => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "pages");
    container = document.createElement("div");
    document.body.appendChild(container);
    mockFetchTimelineEvents.mockReset().mockResolvedValue([]);
    mockFetchCalendarOccurrences.mockReset().mockResolvedValue([]);
    mockFetchTaskActivitySpans.mockReset().mockResolvedValue([]);
    mockListUserEvents.mockReset().mockResolvedValue([]);
    mockUseRefreshOnAnalysisEvent.mockReset();
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
      taskIds: undefined,
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

  it("excludes B-owned user_events when only workset A is selected (no provenance leak)", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({
        id: "memberOfA",
        name: "A member",
        analysisMode: "event",
        worksetId: "ws-A",
      }),
    ]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "ue-cross",
        title: "归属 B，provenance 指向 A 成员",
        body: "",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "memberOfA",
        worksetId: "ws-B",
        createdAt: "2025-01-12T08:00:00Z",
        updatedAt: "2025-01-12T08:00:00Z",
      },
      {
        id: "ue-owned-a",
        title: "归属 A",
        body: "",
        startTime: "2025-01-12T09:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        source: "user",
        taskId: "",
        worksetId: "ws-A",
        createdAt: "2025-01-12T09:00:00Z",
        updatedAt: "2025-01-12T09:00:00Z",
      },
    ]);
    await renderHook({ taskIds: [], worksetIds: ["ws-A"] });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resultRef.current!.events.map((e) => e.id)).toEqual(["ue-owned-a"]);
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
    // Workset selection fetches unified calendar/items (source=item); RRULE taskIds=[].
    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { taskIds: [], includeItems: true },
    );
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

  it("refreshEvents(catalogOverride) fetches calendar for a just-created recurring task", async () => {
    // Source filter is __user__ only with an empty catalog → fetchCalendar false
    // but fetchItems true (workset) so calendar/items is already called once.
    // After create, caller passes the refreshed catalog so RRULE rows appear.
    resetTaskCatalogState([]);
    mockFetchCalendarOccurrences.mockResolvedValue([]);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { taskIds: [], includeItems: true },
    );

    mockFetchCalendarOccurrences.mockClear();
    mockFetchCalendarOccurrences.mockResolvedValue([
      makeOccurrence({ id: "rec-new:a", taskId: "rec-new", title: "每日" }),
      makeOccurrence({
        id: "rec-new:b",
        taskId: "rec-new",
        title: "每日",
        startTime: "2025-01-16T09:00:00Z",
      }),
    ]);

    await act(async () => {
      await resultRef.current!.refreshEvents([
        makeAnalysisTask({
          id: "rec-new",
          name: "每日",
          analysisMode: "recurring",
          worksetId: SYSTEM_WORKSET_ID,
        }),
      ]);
    });

    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { taskIds: ["rec-new"], includeItems: true },
    );
    const events = resultRef.current!.events;
    expect(events.filter((e) => e.source === "recurring")).toHaveLength(2);
  });

  it("includes event, web_intel, recurring, and project modes in timelineTasks", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "evt-1", name: "Event Task", analysisMode: "event" }),
      makeAnalysisTask({ id: "web-1", name: "Web Intel", analysisMode: "web_intel" }),
      makeAnalysisTask({ id: "cal-1", name: "Calendar Task", analysisMode: "recurring" }),
      makeAnalysisTask({ id: "proj-1", name: "Project Alpha", analysisMode: "project" }),
      makeAnalysisTask({ id: "lb-1", name: "Leaderboard", analysisMode: "leaderboard" }),
    ]);
    await renderHook(null);
    const ids = resultRef.current!.timelineTasks.map((t) => t.id);
    expect(ids).toEqual(["evt-1", "web-1", "cal-1", "proj-1"]);
  });

  it("wires SSE refresh to event + web_intel analysis modes", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "evt-1", name: "Event Task", analysisMode: "event" }),
      makeAnalysisTask({ id: "web-1", name: "Web Intel", analysisMode: "web_intel" }),
    ]);
    await renderHook(null);
    const options = mockUseRefreshOnAnalysisEvent.mock.calls.at(-1)?.[1] as {
      analysisMode?: unknown;
      taskIds?: unknown;
    };
    expect(options.analysisMode).toEqual(ANALYSIS_EVENTS_MODES);
    expect(options.analysisMode).toEqual(["event", "web_intel"]);
    expect(options.taskIds).toBeNull();
  });

  it("merges source=item calendar rows and refreshes on item SSE", async () => {
    mockFetchCalendarOccurrences.mockResolvedValue([
      makeOccurrence({
        id: "item:i1:expires",
        taskId: "",
        taskName: "",
        title: "Milk",
        startTime: "2025-01-20T00:00:00",
        endTime: "2025-01-20T23:59:59",
        isAllDay: true,
        rrule: "",
        source: "item",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "i1",
        itemDateKind: "expires",
      }),
    ]);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { taskIds: [], includeItems: true },
    );
    const itemEvent = resultRef.current!.events.find((e) => e.source === "item");
    expect(itemEvent?.id).toBe("item:i1:expires");
    expect(itemEvent?.itemId).toBe("i1");
    expect(itemEvent?.itemDateKind).toBe("expires");

    mockFetchCalendarOccurrences.mockClear();
    mockFetchCalendarOccurrences.mockResolvedValue([]);
    await act(async () => {
      emitResourceModified({
        resourceType: "item",
        resourceId: "i1",
        action: "updated",
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockFetchCalendarOccurrences).toHaveBeenCalled();
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
