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

describe("useTimelineData calendar refresh and errors", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: HookResult | null };

  const rangeStart = new Date("2025-01-01T00:00:00Z");
  const rangeEnd = new Date("2025-02-01T00:00:00Z");

  function HookHarness({
    selectedSources,
    refOut,
    rangeStart: start = rangeStart,
    rangeEnd: end = rangeEnd,
  }: {
    selectedSources: SourceFilterSelection;
    refOut: { current: HookResult | null };
    rangeStart?: Date;
    rangeEnd?: Date;
  }) {
    const result = useTimelineData({
      selectedSources,
      viewMode: "calendar",
      rangeStart: start,
      rangeEnd: end,
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

  it("refreshEvents fetches standalone recurring rows without a task catalog override", async () => {
    resetTaskCatalogState([]);
    mockFetchCalendarOccurrences.mockResolvedValue([]);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { includeItems: true },
    );

    mockFetchCalendarOccurrences.mockClear();
    mockFetchCalendarOccurrences.mockResolvedValue([
      makeOccurrence({ id: "rec-new:a", seriesId: "rec-new", title: "每日", worksetId: SYSTEM_WORKSET_ID }),
      makeOccurrence({
        id: "rec-new:b",
        seriesId: "rec-new",
        title: "每日",
        worksetId: SYSTEM_WORKSET_ID,
        startTime: "2025-01-16T09:00:00Z",
      }),
    ]);

    await act(async () => {
      await resultRef.current!.refreshEvents();
    });

    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { includeItems: true },
    );
    const events = resultRef.current!.events;
    expect(events.filter((e) => e.source === "recurring")).toHaveLength(2);
  });

  it("includes timeline-owning analysis modes in timelineTasks", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "evt-1", name: "Event Task", analysisMode: "intel_event" }),
      makeAnalysisTask({
        id: "web-1",
        name: "Web Intel",
        analysisMode: "agent",
        outputAnalysisEvents: true,
      }),
      makeAnalysisTask({
        id: "proj-1",
        name: "Project Alpha",
        analysisMode: "agent",
        outputCalendar: true,
      }),
      makeAnalysisTask({ id: "lb-1", name: "Leaderboard", analysisMode: "leaderboard" }),
    ]);
    await renderHook(null);
    const ids = resultRef.current!.timelineTasks.map((t) => t.id);
    expect(ids).toEqual(["evt-1", "web-1", "proj-1"]);
  });

  it("merges source=item_remind calendar rows and refreshes on item SSE", async () => {
    mockFetchCalendarOccurrences.mockResolvedValue([
      makeOccurrence({
        id: "item:i1:remind",
        taskId: "",
        taskName: "",
        title: "Milk",
        startTime: "2025-01-20T00:00:00",
        endTime: "2025-01-20T23:59:59",
        isAllDay: true,
        rrule: "",
        source: "item_remind",
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "i1",
        itemDateKind: "remind",
      }),
    ]);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { includeItems: true },
    );
    const itemEvent = resultRef.current!.events.find((e) => e.source === "item_remind");
    expect(itemEvent?.id).toBe("item:i1:remind");
    expect(itemEvent?.itemId).toBe("i1");
    expect(itemEvent?.itemDateKind).toBe("remind");

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

  it("refreshes user events after user_event SSE", async () => {
    mockListUserEvents.mockResolvedValue(userEventsPage([
      {
        id: "ue-1",
        title: "Standup",
        startTime: "2025-01-20T09:00:00Z",
        endTime: "2025-01-20T10:00:00Z",
        body: "",
        location: "",
        isAllDay: false,
        worksetId: SYSTEM_WORKSET_ID,
        seriesId: null,
        origin: "user",
      },
    ]));
    await renderHook(null);
    await act(async () => {
      await Promise.resolve();
    });

    mockListUserEvents.mockClear();
    mockListUserEvents.mockResolvedValue(emptyUserEventsPage);
    await act(async () => {
      emitResourceModified({
        resourceType: "user_event",
        resourceId: "ue-1",
        action: "updated",
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockListUserEvents).toHaveBeenCalled();
  });

  it("refreshes calendar without refreshing tasks after recurring SSE", async () => {
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    mockFetchCalendarOccurrences.mockClear();
    taskCatalogState.refreshTasks.mockClear();

    await act(async () => {
      emitResourceModified({
        resourceType: "recurring",
        resourceId: "series-1",
        action: "updated",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchCalendarOccurrences).toHaveBeenCalled();
    expect(taskCatalogState.refreshTasks).not.toHaveBeenCalled();
  });

  it("refreshes catalog before calendar fetch when a task row changes", async () => {
    const refreshedCatalog = [
      makeAnalysisTask({ id: "evt-new", name: "Daily", analysisMode: "intel_event" }),
    ];
    taskCatalogState.refreshTasks.mockResolvedValueOnce(refreshedCatalog);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    mockFetchCalendarOccurrences.mockClear();

    await act(async () => {
      emitResourceModified({
        resourceType: "task",
        resourceId: "evt-new",
        action: "created",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(taskCatalogState.refreshTasks).toHaveBeenCalled();
    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { includeItems: true },
    );
  });

  it("drops inactive analysis tasks from the assignable timeline task list", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "cal-live", name: "Live", analysisMode: "intel_event" }),
      makeAnalysisTask({
        id: "cal-deleted",
        name: "Soft deleted",
        analysisMode: "intel_event",
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

  it("re-fetches calendar occurrences when the visible range changes", async () => {
    await renderHook();
    expect(mockFetchCalendarOccurrences).toHaveBeenCalled();
    const firstWindow = mockFetchCalendarOccurrences.mock.calls[0] as [string, string];
    mockFetchCalendarOccurrences.mockClear();

    await act(async () => {
      root!.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(HookHarness, {
              selectedSources: null,
              refOut: resultRef,
              rangeStart: new Date("2025-02-01T00:00:00Z"),
              rangeEnd: new Date("2025-03-01T00:00:00Z"),
            }),
          ),
        ),
      );
    });

    expect(mockFetchCalendarOccurrences).toHaveBeenCalled();
    const nextWindow = mockFetchCalendarOccurrences.mock.calls[0] as [string, string];
    expect(nextWindow[0]).not.toBe(firstWindow[0]);
    expect(nextWindow[1]).not.toBe(firstWindow[1]);
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
