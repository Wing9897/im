import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalysisEvent } from "../../types";
import { CalendarBoardEmbed } from "./CalendarBoardEmbed";

/** Local calendar helpers — avoid UTC ISO pitfalls when asserting "today". */
function localIso(y: number, m0: number, d: number, h = 0, min = 0): string {
  return new Date(y, m0, d, h, min, 0, 0).toISOString();
}

function makeEvent(overrides: Partial<AnalysisEvent> = {}): AnalysisEvent {
  return {
    id: "occ-1",
    seriesId: "series-1",
    version: 1,
    batchId: "",
    title: "Binance 平台用戶積分與活動任務",
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
    taskName: "測試任務",
    createdAt: localIso(2026, 6, 22, 8, 0),
    updatedAt: localIso(2026, 6, 22, 8, 0),
    source: "recurring",
    isAllDay: false,
    ...overrides,
  };
}

describe("CalendarBoardEmbed day mode", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    // Afternoon on the same local day as the 08:00 event.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 16, 22, 0, 0));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("still lists earlier-today timed events after their start time has passed", () => {
    act(() => {
      root.render(
        createElement(CalendarBoardEmbed, {
          mode: "day",
          events: [makeEvent()],
        }),
      );
    });

    expect(container.textContent).toContain("Binance 平台用戶積分與活動任務");
    expect(container.textContent).not.toContain("無行程");
  });

  it("renders one vertical list row per event with time and title", () => {
    act(() => {
      root.render(
        createElement(CalendarBoardEmbed, {
          mode: "day",
          events: [
            makeEvent({ id: "occ-1", title: "早會" }),
            makeEvent({
              id: "occ-2",
              title: "午間簡報",
              startTime: localIso(2026, 6, 22, 12, 30),
              endTime: localIso(2026, 6, 22, 13, 0),
            }),
          ],
        }),
      );
    });

    const list = container.querySelector('[data-testid="board-calendar-day-list"]');
    expect(list).not.toBeNull();
    expect(list?.classList.contains("board-calendar-day__list")).toBe(true);

    const rows = container.querySelectorAll(".board-calendar-day__event");
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector(".board-calendar-day__title")?.textContent).toBe("早會");
    expect(rows[1].querySelector(".board-calendar-day__title")?.textContent).toBe("午間簡報");
    expect(rows[0].querySelector(".board-calendar-day__time")).not.toBeNull();
    expect(rows[1].querySelector(".board-calendar-day__time")).not.toBeNull();
  });

  it("shows 無行程 when there are no events starting today", () => {
    act(() => {
      root.render(
        createElement(CalendarBoardEmbed, {
          mode: "day",
          events: [
            makeEvent({
              id: "occ-tomorrow",
              title: "明日活動",
              startTime: localIso(2026, 6, 23, 8, 0),
              endTime: localIso(2026, 6, 23, 9, 0),
            }),
          ],
        }),
      );
    });

    expect(container.textContent).toContain("無行程");
    expect(container.textContent).not.toContain("明日活動");
  });

  it("keeps analysis source distinct from recurring (no seriesId←taskId)", () => {
    const onSelectEvent = vi.fn();
    act(() => {
      root.render(
        createElement(CalendarBoardEmbed, {
          mode: "day",
          events: [
            makeEvent({
              id: "analysis-1",
              taskId: "task-xyz",
              seriesId: null,
              source: "analysis",
              title: "分析事件",
            }),
          ],
          onSelectEvent,
        }),
      );
    });

    const row = container.querySelector(".board-calendar-day__event") as HTMLButtonElement;
    act(() => {
      row.click();
    });
    expect(onSelectEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "analysis-1",
        source: "analysis",
        taskId: "task-xyz",
        seriesId: null,
      }),
    );
  });
});
