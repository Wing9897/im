/**
 * Regression tests for calendar refresh / SSE / errors.
 *
 * Recurring tasks are expanded server-side (GET /api/v1/calendar/window).
 * Shared harness: `useTimelineData.calendar.testHarness.tsx`.
 */
import { act } from "react";
import { type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

const {
  mockFetchCalendarWindow,
  mockFetchTaskActivitySpans,
} = vi.hoisted(() => ({
  mockFetchCalendarWindow: vi.fn().mockResolvedValue([]),
  mockFetchTaskActivitySpans: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/calendarWindow", () => ({
  fetchCalendarWindow: (...args: unknown[]) => mockFetchCalendarWindow(...args),
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
import { createElement } from "react";
import { MonitorModeProvider } from "../../context/MonitorModeContext";
import { makeAnalysisTask, resetAnalysisStatusState, resetTaskCatalogState, taskCatalogState } from "../../test/context-mocks";
import { emitResourceModified } from "../../domain/sse/resourceModified";
import {
  makeCalendarWindowItem,
  renderTimelineDataHook,
  setupTimelineDataCalendarDom,
  teardownTimelineDataCalendarDom,
  TimelineDataHookHarness,
  type TimelineDataHookResult,
} from "./useTimelineData.calendar.testHarness";

describe("useTimelineData calendar refresh and errors", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: TimelineDataHookResult | null };

  async function renderHook(selectedSources: SourceFilterSelection = null) {
    root = await renderTimelineDataHook(container, resultRef, selectedSources);
  }

  beforeEach(() => {
    container = setupTimelineDataCalendarDom();
    mockFetchCalendarWindow.mockReset().mockResolvedValue([]);
    mockFetchTaskActivitySpans.mockReset().mockResolvedValue([]);
    resetTaskCatalogState();
    resetAnalysisStatusState();
    resultRef = { current: null };
  });

  afterEach(() => {
    teardownTimelineDataCalendarDom(root, container);
    root = null;
  });

  it("refreshEvents fetches standalone recurring rows without a task catalog override", async () => {
    resetTaskCatalogState([]);
    mockFetchCalendarWindow.mockResolvedValue([]);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    expect(mockFetchCalendarWindow).toHaveBeenCalledWith(
      expect.objectContaining({ includeItems: true }),
    );

    mockFetchCalendarWindow.mockClear();
    mockFetchCalendarWindow.mockResolvedValue([
      makeCalendarWindowItem({
        id: "rec-new:a",
        source: "recurring",
        seriesId: "rec-new",
        title: "每日",
        worksetId: SYSTEM_WORKSET_ID,
      }),
      makeCalendarWindowItem({
        id: "rec-new:b",
        source: "recurring",
        seriesId: "rec-new",
        title: "每日",
        worksetId: SYSTEM_WORKSET_ID,
        startTime: "2025-01-16T09:00:00Z",
      }),
    ]);

    await act(async () => {
      await resultRef.current!.refreshEvents();
    });

    expect(mockFetchCalendarWindow).toHaveBeenCalledWith(
      expect.objectContaining({ includeItems: true }),
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
    mockFetchCalendarWindow.mockResolvedValue([
      makeCalendarWindowItem({
        id: "item:i1:remind",
        source: "item_remind",
        title: "Milk",
        startTime: "2025-01-20T00:00:00",
        endTime: "2025-01-20T23:59:59",
        isAllDay: true,
        worksetId: SYSTEM_WORKSET_ID,
        itemId: "i1",
        itemDateKind: "remind",
      }),
    ]);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchCalendarWindow).toHaveBeenCalledWith(
      expect.objectContaining({ includeItems: true }),
    );
    const itemEvent = resultRef.current!.events.find((e) => e.source === "item_remind");
    expect(itemEvent?.id).toBe("item:i1:remind");
    expect(itemEvent?.itemId).toBe("i1");
    expect(itemEvent?.itemDateKind).toBe("remind");

    mockFetchCalendarWindow.mockClear();
    mockFetchCalendarWindow.mockResolvedValue([]);
    await act(async () => {
      emitResourceModified({
        resourceType: "item",
        resourceId: "i1",
        action: "updated",
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockFetchCalendarWindow).toHaveBeenCalled();
  });

  it("refreshes user events after user_event SSE", async () => {
    mockFetchCalendarWindow.mockResolvedValue([
      {
        id: "ue-1",
        source: "user",
        title: "Standup",
        startTime: "2025-01-20T09:00:00Z",
        endTime: "2025-01-20T10:00:00Z",
        body: "",
        location: "",
        isAllDay: false,
        worksetId: SYSTEM_WORKSET_ID,
        origin: "manual",
      },
    ]);
    await renderHook(null);
    await act(async () => {
      await Promise.resolve();
    });

    mockFetchCalendarWindow.mockClear();
    mockFetchCalendarWindow.mockResolvedValue([]);
    await act(async () => {
      emitResourceModified({
        resourceType: "user_event",
        resourceId: "ue-1",
        action: "updated",
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockFetchCalendarWindow).toHaveBeenCalled();
  });

  it("refreshes calendar without refreshing tasks after recurring SSE", async () => {
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    mockFetchCalendarWindow.mockClear();
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

    expect(mockFetchCalendarWindow).toHaveBeenCalled();
    expect(taskCatalogState.refreshTasks).not.toHaveBeenCalled();
  });

  it("refreshes catalog before calendar fetch when a task row changes", async () => {
    const refreshedCatalog = [
      makeAnalysisTask({ id: "evt-new", name: "Daily", analysisMode: "intel_event" }),
    ];
    taskCatalogState.refreshTasks.mockResolvedValueOnce(refreshedCatalog);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    mockFetchCalendarWindow.mockClear();

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
    expect(mockFetchCalendarWindow).toHaveBeenCalledWith(
      expect.objectContaining({ includeItems: true }),
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
    mockFetchCalendarWindow.mockRejectedValue(new Error("calendar boom"));
    await renderHook(null);
    await act(async () => {
      await Promise.resolve();
    });
    expect(resultRef.current!.pageError).toBe("calendar boom");
    expect(resultRef.current!.timelineEventsError).toBe("calendar boom");
  });

  it("surfaces a user event fetch failure instead of an empty calendar", async () => {
    mockFetchCalendarWindow.mockRejectedValue(new Error("user events boom"));
    await renderHook(null);
    await act(async () => {
      await Promise.resolve();
    });
    expect(resultRef.current!.pageError).toBe("user events boom");
    expect(resultRef.current!.timelineEventsError).toBe("user events boom");
  });

  it("re-fetches calendar occurrences when the visible range changes", async () => {
    await renderHook();
    expect(mockFetchCalendarWindow).toHaveBeenCalled();
    const firstWindow = mockFetchCalendarWindow.mock.calls[0][0] as { startTime: string };
    mockFetchCalendarWindow.mockClear();

    await act(async () => {
      root!.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(TimelineDataHookHarness, {
              selectedSources: null,
              refOut: resultRef,
              rangeStart: new Date("2025-02-01T00:00:00Z"),
              rangeEnd: new Date("2025-03-01T00:00:00Z"),
            }),
          ),
        ),
      );
    });

    expect(mockFetchCalendarWindow).toHaveBeenCalled();
    const nextWindow = mockFetchCalendarWindow.mock.calls[0][0] as { startTime: string };
    expect(nextWindow.startTime).not.toBe(firstWindow.startTime);
  });

  it("leaves schedule events untouched when there are no occurrences", async () => {
    const scheduleEvent = {
      id: "evt-1",
      source: "analysis" as const,
      taskId: "t1",
      title: "分析事件",
      body: "",
      startTime: "2025-01-10T00:00:00Z",
      endTime: null,
      taskName: "任務",
    };
    mockFetchCalendarWindow.mockResolvedValue([scheduleEvent]);
    await renderHook(null);
    expect(resultRef.current!.events.map((event) => event.id)).toEqual(["evt-1"]);
    expect(resultRef.current!.events[0].title).toBe("分析事件");
  });
});
