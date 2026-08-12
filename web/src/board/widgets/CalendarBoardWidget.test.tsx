import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MONITOR_MODE_KEY } from "../../context/MonitorModeContext";
import {
  makeAnalysisTask,
  resetTaskCatalogState,
} from "../../test/context-mocks";
import { wrapBoardProviders } from "../boardTestHarness";
import { CalendarBoardWidget, CalendarDayBoardWidget } from "./CalendarBoardWidget";
import type { AnalysisEvent } from "../../types";

const mockFetchMerged = vi.fn();

vi.mock("../../domain/timeline/timedEventMerge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../domain/timeline/timedEventMerge")>();
  return {
    ...actual,
    fetchMergedTimedBoardEvents: (...args: unknown[]) => mockFetchMerged(...args),
  };
});

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock(),
);

vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/context-mocks")).analysisStatusModuleMock(),
);

vi.mock("../embeds/CalendarBoardEmbed", () => ({
  CalendarBoardEmbed: ({
    events,
    mode,
  }: {
    events: Array<{ id: string; title: string; seriesId?: string | null; source?: string | null }>;
    mode: string;
  }) =>
    createElement(
      "div",
      { "data-testid": `board-calendar-embed-${mode}` },
      events.map((evt) =>
        createElement(
          "div",
          {
            key: evt.id,
            "data-testid": `board-cal-occ-${evt.id}`,
            "data-series-id": evt.seriesId ?? "",
            "data-source": evt.source ?? "",
          },
          evt.title,
        ),
      ),
    ),
}));

function localIso(y: number, m0: number, d: number, h = 0, min = 0): string {
  return new Date(y, m0, d, h, min, 0, 0).toISOString();
}

function makeMergedEvents(): AnalysisEvent[] {
  return [
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
      source: "analysis",
    },
    {
      id: "cal-task:20260722T100000Z",
      seriesId: "cal-task",
      taskId: null,
      version: 1,
      batchId: "",
      title: "RRULE 週會",
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
      taskName: "週期任務",
      createdAt: localIso(2026, 6, 22, 10, 0),
      updatedAt: localIso(2026, 6, 22, 10, 0),
      source: "recurring",
      worksetId: "ws-1",
    },
  ];
}

describe("CalendarBoardWidget recurring occurrences", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 22, 12, 0, 0, 0));
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    resetTaskCatalogState([
      makeAnalysisTask({ id: "event-task", name: "情報任務", analysisMode: "intel_event" }),
    ]);
    mockFetchMerged.mockReset().mockResolvedValue(makeMergedEvents());
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
      await Promise.resolve();
    });
  }

  function wrap(node: React.ReactNode) {
    return wrapBoardProviders(node);
  }

  it("month widget fetches and renders RRULE calendar occurrences", async () => {
    act(() => {
      root.render(wrap(createElement(CalendarBoardWidget, { widgetId: "test-cal-month" })));
    });
    await flush();

    expect(mockFetchMerged).toHaveBeenCalled();
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

    expect(mockFetchMerged).toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="board-cal-occ-cal-task:20260722T100000Z"]'),
    ).toBeTruthy();
  });

  it("does not double-count when analysis event already matches occurrence id", async () => {
    mockFetchMerged.mockResolvedValue([
      {
        ...makeMergedEvents()[1],
        title: "已存在的分析列",
      },
    ]);

    act(() => {
      root.render(wrap(createElement(CalendarBoardWidget, { widgetId: "test-cal-dedupe" })));
    });
    await flush();

    const rows = container.querySelectorAll("[data-testid^='board-cal-occ-']");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toBe("已存在的分析列");
  });

  it("preserves analysis source and does not fall seriesId back to taskId", async () => {
    act(() => {
      root.render(wrap(createElement(CalendarBoardWidget, { widgetId: "test-cal-source" })));
    });
    await flush();

    const analysis = container.querySelector('[data-testid="board-cal-occ-evt-1"]');
    expect(analysis?.getAttribute("data-source")).toBe("analysis");
    expect(analysis?.getAttribute("data-series-id")).toBe("");

    const rrule = container.querySelector(
      '[data-testid="board-cal-occ-cal-task:20260722T100000Z"]',
    );
    expect(rrule?.getAttribute("data-source")).toBe("recurring");
    expect(rrule?.getAttribute("data-series-id")).toBe("cal-task");
  });
});
