/**
 * Regression tests for recurring-task occurrence wiring.
 *
 * Recurring tasks are expanded server-side (GET /api/v1/calendar/occurrences).
 * These tests pin hook wiring (adapter unit coverage lives in timedEventMerge.test.ts):
 * - occurrences are fetched for the visible range (padded for the month grid)
 * - "all tasks" merges analysis + calendar occurrences
 * - filtering by a recurring task shows only that task's occurrences
 * - filtering by an event task does not mix in calendar occurrences
 * - timelineTasks includes event, recurring, and agent modes
 * - __general__ workset shows its owned user_events (incl. tagged provenance); other worksets excluded
 * - task filters include tagged user_events for that task
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarOccurrence } from "../../types";
import { getGeneralWorksetLabel } from "../../domain/timeline/userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";

const emptyUserEventsPage = { items: [] as unknown[], totalCount: 0, hasMore: false };

function userEventsPage(items: unknown[]) {
  return { items, totalCount: items.length, hasMore: false };
}

const {
  mockFetchTimelineEvents,
  mockFetchCalendarOccurrences,
  mockFetchTaskActivitySpans,
  mockListUserEvents,
} = vi.hoisted(() => ({
  mockFetchTimelineEvents: vi.fn().mockResolvedValue([]),
  mockFetchCalendarOccurrences: vi.fn().mockResolvedValue([]),
  mockFetchTaskActivitySpans: vi.fn().mockResolvedValue([]),
  mockListUserEvents: vi.fn().mockResolvedValue({ items: [], totalCount: 0, hasMore: false }),
}));

vi.mock("../../api/results", () => ({
  fetchTimelineEvents: (...args: unknown[]) => mockFetchTimelineEvents(...args),
  fetchCalendarOccurrences: (...args: unknown[]) => mockFetchCalendarOccurrences(...args),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEventsPage: (...args: unknown[]) => mockListUserEvents(...args),
}));

vi.mock("../../api/tasks", () => ({
  fetchTaskActivitySpans: (...args: unknown[]) => mockFetchTaskActivitySpans(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/context-mocks")).analysisStatusModuleMock());

import { MemoryRouter } from "react-router-dom";
import {
  MONITOR_MODE_KEY,
  MonitorModeProvider,
} from "../../context/MonitorModeContext";
import { makeAnalysisTask, resetAnalysisStatusState, resetTaskCatalogState, taskCatalogState } from "../../test/context-mocks";
import { emitResourceModified } from "../../domain/sse/resourceModified";
import { useTimelineData } from "./useTimelineData";

type HookResult = ReturnType<typeof useTimelineData>;

function makeOccurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: "cal-1:20250115T090000Z",
    seriesId: "cal-1",
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
    mockListUserEvents.mockReset().mockResolvedValue(emptyUserEventsPage);
    resetTaskCatalogState();
    resetAnalysisStatusState();
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
    mockListUserEvents.mockResolvedValue(userEventsPage([
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
    ]));
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
        analysisMode: "intel_event",
        worksetId: "ws-A",
      }),
    ]);
    mockListUserEvents.mockResolvedValue(userEventsPage([
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
    ]));
    await renderHook({ taskIds: [], worksetIds: ["ws-A"] });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resultRef.current!.events.map((e) => e.id)).toEqual(["ue-owned-a"]);
  });

  it("shows all user events owned by the general workset when __general__ is selected", async () => {
    mockFetchCalendarOccurrences.mockResolvedValue([makeOccurrence()]);
    mockListUserEvents.mockResolvedValue(userEventsPage([
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
    ]));
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    await act(async () => {
      await Promise.resolve();
    });
    const events = resultRef.current!.events;
    expect(events.map((e) => e.id).sort()).toEqual(["ue-only", "ue-tagged-same-ws"]);
    expect(events.every((e) => e.source === "user")).toBe(true);
    expect(events.find((e) => e.id === "ue-only")?.taskName).toBe(getGeneralWorksetLabel());
    expect(mockFetchTimelineEvents).not.toHaveBeenCalled();
    // Workset selection fetches unified standalone recurring + item rows.
    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { includeItems: true },
    );
    expect(resultRef.current!.timelineEvents).toHaveLength(2);
    expect(resultRef.current!.timelineEventsInitialLoading).toBe(false);
  });

  it("does not merge calendar occurrences when an event-mode task is selected", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "timeline-task-1", name: "Event Task", analysisMode: "intel_event" }),
    ]);
    mockFetchCalendarOccurrences.mockResolvedValue([makeOccurrence()]);
    await renderHook({ taskIds: ["timeline-task-1"], worksetIds: [] });
    expect(resultRef.current!.events).toHaveLength(0);
    expect(mockListUserEvents).toHaveBeenCalled();
  });

  it("merges tagged user events when an event-mode task is selected", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "timeline-task-1", name: "Event Task", analysisMode: "intel_event" }),
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
    mockListUserEvents.mockResolvedValue(userEventsPage([
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
    ]));
    await renderHook({ taskIds: ["timeline-task-1"], worksetIds: [] });
    await act(async () => {
      await Promise.resolve();
    });
    const ids = resultRef.current!.events.map((e) => e.id).sort();
    expect(ids).toEqual(["analysis-1", "ue-match"]);
  });

  it("filters standalone recurring occurrences by workset", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "evt-1", name: "Event", analysisMode: "intel_event", worksetId: "ws-a" }),
    ]);
    mockFetchCalendarOccurrences.mockResolvedValue([
      makeOccurrence({ id: "cal-1:a", seriesId: "cal-1", title: "Standup", worksetId: "ws-a" }),
      makeOccurrence({ id: "cal-2:b", seriesId: "cal-2", title: "Other", taskName: "Other Cal", worksetId: "ws-b" }),
    ]);
    await renderHook({ taskIds: [], worksetIds: ["ws-a"] });
    const events = resultRef.current!.events;
    expect(events).toHaveLength(1);
    expect(events[0].seriesId).toBe("cal-1");
    expect(events[0].source).toBe("recurring");
    expect(mockFetchTimelineEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        taskIds: ["evt-1"],
        startDate: expect.any(String),
        endDate: expect.any(String),
      }),
    );
  });
});
