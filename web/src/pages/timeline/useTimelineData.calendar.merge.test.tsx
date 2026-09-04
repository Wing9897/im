/**
 * Regression tests for calendar window merge / source filters.
 *
 * Recurring tasks are expanded server-side (GET /api/v1/calendar/window).
 * Shared harness: `useTimelineData.calendar.testHarness.tsx`.
 */
import { act } from "react";
import { type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGeneralWorksetLabel } from "../../domain/timeline/userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";

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

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../api/tasks", () => ({
  fetchTaskActivitySpans: (...args: unknown[]) => mockFetchTaskActivitySpans(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/context-mocks")).analysisStatusModuleMock());

import { makeAnalysisTask, resetAnalysisStatusState, resetTaskCatalogState } from "../../test/context-mocks";
import {
  makeCalendarWindowItem,
  renderTimelineDataHook,
  setupTimelineDataCalendarDom,
  teardownTimelineDataCalendarDom,
  TIMELINE_CALENDAR_TEST_RANGE,
  type TimelineDataHookResult,
} from "./useTimelineData.calendar.testHarness";

describe("useTimelineData calendar occurrence wiring", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: TimelineDataHookResult | null };

  const rangeStart = TIMELINE_CALENDAR_TEST_RANGE.start;
  const rangeEnd = TIMELINE_CALENDAR_TEST_RANGE.end;

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

  it("fetches the calendar window padded around the visible range", async () => {
    await renderHook();
    expect(mockFetchCalendarWindow).toHaveBeenCalled();
    const params = mockFetchCalendarWindow.mock.calls[0][0] as { startTime: string; endTime: string };
    expect(new Date(params.startTime).getTime()).toBeLessThan(rangeStart.getTime());
    expect(new Date(params.endTime).getTime()).toBeGreaterThan(rangeEnd.getTime());
  });

  it("fetches one window for all sources in the padded visible range", async () => {
    await renderHook();
    expect(mockFetchCalendarWindow).toHaveBeenCalledWith({
      startTime: "2024-12-25T00:00:00.000Z",
      endTime: "2025-02-08T00:00:00.000Z",
      includeAnalysis: true,
      includeUser: true,
      includeRecurring: true,
      includeItems: true,
    }, expect.any(AbortSignal));
  });

  it("maps recurring window rows into events in the all-tasks view", async () => {
    mockFetchCalendarWindow.mockResolvedValue([
      makeCalendarWindowItem({
        id: "cal-1:20250115T090000Z",
        source: "recurring",
        title: "Weekly Standup",
        seriesId: "cal-1",
        taskName: "Weekly Standup",
      }),
    ]);
    await renderHook(null);
    const events = resultRef.current!.events;
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("recurring");
    expect(events[0].title).toBe("Weekly Standup");
  });

  it("maps user events into the all-tasks view", async () => {
    mockFetchCalendarWindow.mockResolvedValue([
      makeCalendarWindowItem({
        id: "ue-1",
        source: "user",
        title: "用戶事件",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        origin: "manual",
        taskId: "",
      }),
    ]);
    await renderHook(null);
    await act(async () => {
      await Promise.resolve();
    });
    const events = resultRef.current!.events;
    expect(events.some((e) => e.id === "ue-1" && e.source === "user")).toBe(true);
    expect(events.find((e) => e.id === "ue-1")?.taskName).toBe(getGeneralWorksetLabel());
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
    mockFetchCalendarWindow.mockResolvedValue([
      makeCalendarWindowItem({
        id: "ue-cross",
        source: "user",
        title: "归属 B，provenance 指向 A 成员",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        origin: "manual",
        taskId: "memberOfA",
        worksetId: "ws-B",
      }),
      makeCalendarWindowItem({
        id: "ue-owned-a",
        source: "user",
        title: "归属 A",
        startTime: "2025-01-12T09:00:00Z",
        endTime: null,
        origin: "manual",
        taskId: "",
        worksetId: "ws-A",
      }),
    ]);
    await renderHook({ taskIds: [], worksetIds: ["ws-A"] });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resultRef.current!.events.map((e) => e.id)).toEqual(["ue-owned-a"]);
  });

  it("shows all user events owned by the general workset when __general__ is selected", async () => {
    mockFetchCalendarWindow.mockResolvedValue([
      makeCalendarWindowItem({
        id: "cal-1:20250115T090000Z",
        source: "recurring",
        title: "Weekly Standup",
        seriesId: "cal-1",
        worksetId: "ws-cal",
      }),
      makeCalendarWindowItem({
        id: "ue-only",
        source: "user",
        title: "用戶事件",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        origin: "assistant",
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
      }),
      makeCalendarWindowItem({
        id: "ue-tagged-same-ws",
        source: "user",
        title: "同工作集但有 provenance",
        startTime: "2025-01-12T09:00:00Z",
        endTime: null,
        origin: "manual",
        taskId: "ct-1",
        worksetId: SYSTEM_WORKSET_ID,
      }),
      makeCalendarWindowItem({
        id: "ue-other-ws",
        source: "user",
        title: "其他工作集",
        startTime: "2025-01-12T10:00:00Z",
        endTime: null,
        origin: "manual",
        taskId: "",
        worksetId: "ws-ops",
      }),
    ]);
    await renderHook({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    await act(async () => {
      await Promise.resolve();
    });
    const events = resultRef.current!.events;
    expect(events.map((e) => e.id).sort()).toEqual(["ue-only", "ue-tagged-same-ws"]);
    expect(events.every((e) => e.source === "user")).toBe(true);
    expect(events.find((e) => e.id === "ue-only")?.taskName).toBe(getGeneralWorksetLabel());
    expect(mockFetchCalendarWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        includeAnalysis: false,
        includeUser: true,
        includeRecurring: true,
        includeItems: true,
      }),
      expect.any(AbortSignal),
    );
    expect(resultRef.current!.timelineEvents).toHaveLength(2);
    expect(resultRef.current!.timelineEventsInitialLoading).toBe(false);
  });

  it("does not keep recurring rows when an event-mode task is selected", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "timeline-task-1", name: "Event Task", analysisMode: "intel_event" }),
    ]);
    mockFetchCalendarWindow.mockResolvedValue([
      makeCalendarWindowItem({
        id: "cal-1:20250115T090000Z",
        source: "recurring",
        title: "Weekly Standup",
        seriesId: "cal-1",
      }),
    ]);
    await renderHook({ taskIds: ["timeline-task-1"], worksetIds: [] });
    expect(resultRef.current!.events).toHaveLength(0);
    expect(mockFetchCalendarWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        includeAnalysis: true,
        includeUser: true,
        includeRecurring: false,
        includeItems: false,
      }),
      expect.any(AbortSignal),
    );
  });

  it("keeps tagged user events when an event-mode task is selected", async () => {
    resetTaskCatalogState([
      makeAnalysisTask({ id: "timeline-task-1", name: "Event Task", analysisMode: "intel_event" }),
    ]);
    mockFetchCalendarWindow.mockResolvedValue([
      makeCalendarWindowItem({
        id: "analysis-1",
        source: "analysis",
        title: "分析事件",
        taskId: "timeline-task-1",
        taskName: "Event Task",
        startTime: "2025-01-10T00:00:00Z",
        endTime: null,
      }),
      makeCalendarWindowItem({
        id: "ue-match",
        source: "user",
        title: "掛到事件任務",
        startTime: "2025-01-12T08:00:00Z",
        endTime: null,
        origin: "manual",
        taskId: "timeline-task-1",
      }),
      makeCalendarWindowItem({
        id: "ue-other",
        source: "user",
        title: "其他",
        startTime: "2025-01-12T09:00:00Z",
        endTime: null,
        origin: "manual",
        taskId: "",
      }),
    ]);
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
    mockFetchCalendarWindow.mockResolvedValue([
      makeCalendarWindowItem({
        id: "cal-1:a",
        source: "recurring",
        title: "Standup",
        seriesId: "cal-1",
        worksetId: "ws-a",
      }),
      makeCalendarWindowItem({
        id: "cal-2:b",
        source: "recurring",
        title: "Other",
        seriesId: "cal-2",
        taskName: "Other Cal",
        worksetId: "ws-b",
      }),
    ]);
    await renderHook({ taskIds: [], worksetIds: ["ws-a"] });
    const events = resultRef.current!.events;
    expect(events).toHaveLength(1);
    expect(events[0].seriesId).toBe("cal-1");
    expect(events[0].source).toBe("recurring");
    expect(mockFetchCalendarWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        includeAnalysis: true,
        includeUser: true,
        includeRecurring: true,
        includeItems: true,
      }),
      expect.any(AbortSignal),
    );
  });
});
