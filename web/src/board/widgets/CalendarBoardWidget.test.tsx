import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MONITOR_MODE_KEY,
  MonitorModeProvider,
} from "../../context/MonitorModeContext";
import {
  makeAnalysisTask,
  resetTaskCatalogState,
} from "../../test/context-mocks";
import { CalendarBoardWidget, CalendarDayBoardWidget } from "./CalendarBoardWidget";

const mockFetchEvents = vi.fn();
const mockFetchCalendarOccurrences = vi.fn();
const mockListUserEvents = vi.fn();

vi.mock("../../api/results", () => ({
  fetchEvents: (...args: unknown[]) => mockFetchEvents(...args),
  fetchCalendarOccurrences: (...args: unknown[]) => mockFetchCalendarOccurrences(...args),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEvents: (...args: unknown[]) => mockListUserEvents(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock(),
);

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    queueStatus: {
      pendingCount: 0,
      processingBatches: [],
      attentionBatches: [],
      analysisPaused: false,
    },
    analysisPaused: false,
    activeAnalysis: null,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null,
    lastAccountStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../embeds/CalendarBoardEmbed", () => ({
  CalendarBoardEmbed: ({
    occurrences,
    mode,
  }: {
    occurrences: Array<{ id: string; title: string; taskId: string }>;
    mode: string;
  }) =>
    createElement(
      "div",
      { "data-testid": `board-calendar-embed-${mode}` },
      occurrences.map((occ) =>
        createElement(
          "div",
          { key: occ.id, "data-testid": `board-cal-occ-${occ.id}`, "data-task-id": occ.taskId },
          occ.title,
        ),
      ),
    ),
}));

function localIso(y: number, m0: number, d: number, h = 0, min = 0): string {
  return new Date(y, m0, d, h, min, 0, 0).toISOString();
}

describe("CalendarBoardWidget recurring occurrences", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 12, 0, 0, 0));
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    resetTaskCatalogState([
      makeAnalysisTask({ id: "event-task", name: "情報任務", analysisMode: "event" }),
      makeAnalysisTask({ id: "cal-task", name: "循環任務", analysisMode: "recurring" }),
    ]);
    mockFetchEvents.mockReset().mockResolvedValue({
      items: [
        {
          id: "evt-1",
          taskId: "event-task",
          version: 1,
          batchId: "b1",
          title: "分析事件",
          body: "",
          startTime: localIso(2026, 6, 22, 8, 0),
          endTime: localIso(2026, 6, 22, 9, 0),
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
          taskName: "情報任務",
          createdAt: localIso(2026, 6, 22, 8, 0),
          updatedAt: localIso(2026, 6, 22, 8, 0),
        },
      ],
      totalCount: 1,
      hasMore: false,
    });
    mockListUserEvents.mockReset().mockResolvedValue([]);
    mockFetchCalendarOccurrences.mockReset().mockResolvedValue([
      {
        id: "cal-task:20260722T100000Z",
        taskId: "cal-task",
        taskName: "循環任務",
        title: "RRULE 週會",
        startTime: localIso(2026, 6, 22, 10, 0),
        endTime: localIso(2026, 6, 22, 11, 0),
        isAllDay: false,
        location: null,
        description: null,
        rrule: "FREQ=WEEKLY",
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
    window.localStorage.clear();
    vi.useRealTimers();
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function wrap(node: React.ReactNode) {
    return createElement(
      MemoryRouter,
      null,
      createElement(MonitorModeProvider, null, node),
    );
  }

  it("month widget fetches and renders RRULE calendar occurrences", async () => {
    act(() => {
      root.render(wrap(createElement(CalendarBoardWidget, { widgetId: "test-cal-month" })));
    });
    await flush();

    expect(mockFetchCalendarOccurrences).toHaveBeenCalled();
    const [startIso, endIso] = mockFetchCalendarOccurrences.mock.calls[0] as [string, string];
    expect(new Date(startIso).getTime()).toBeLessThan(new Date(endIso).getTime());

    expect(container.querySelector('[data-testid="board-cal-occ-evt-1"]')?.textContent).toBe(
      "分析事件",
    );
    expect(
      container.querySelector('[data-testid="board-cal-occ-cal-task:20260722T100000Z"]')
        ?.textContent,
    ).toBe("RRULE 週會");
  });

  it("day widget also merges calendar occurrences into the schedule", async () => {
    act(() => {
      root.render(wrap(createElement(CalendarDayBoardWidget, { widgetId: "test-cal-day" })));
    });
    await flush();

    expect(mockFetchCalendarOccurrences).toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="board-cal-occ-cal-task:20260722T100000Z"]'),
    ).toBeTruthy();
  });

  it("does not double-count when analysis event already matches occurrence id", async () => {
    mockFetchEvents.mockResolvedValue({
      items: [
        {
          id: "cal-task:20260722T100000Z",
          taskId: "cal-task",
          version: 1,
          batchId: "",
          title: "已存在的分析列",
          body: "",
          startTime: localIso(2026, 6, 22, 10, 0),
          endTime: localIso(2026, 6, 22, 11, 0),
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
          taskName: "循環任務",
          createdAt: localIso(2026, 6, 22, 10, 0),
          updatedAt: localIso(2026, 6, 22, 10, 0),
        },
      ],
      totalCount: 1,
      hasMore: false,
    });

    act(() => {
      root.render(wrap(createElement(CalendarBoardWidget, { widgetId: "test-cal-dedupe" })));
    });
    await flush();

    const rows = container.querySelectorAll("[data-testid^='board-cal-occ-']");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toBe("已存在的分析列");
  });
});
