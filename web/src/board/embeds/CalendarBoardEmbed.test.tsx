import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalysisEvent } from "../../types";
import { CalendarBoardEmbed } from "./CalendarBoardEmbed";

const { mockUseMonthHolidays } = vi.hoisted(() => ({
  mockUseMonthHolidays: vi.fn(),
}));

vi.mock("../../hooks/useMonthHolidays", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/useMonthHolidays")>();
  return {
    ...actual,
    useMonthHolidays: mockUseMonthHolidays,
  };
});

const emptyHolidays = {
  holidaysByDate: {} as Record<string, Array<{ date: string; localName: string; name: string }>>,
  error: null,
  loading: false,
  refresh: () => {},
};

function nagerHoliday(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-07-01",
    localName: "元旦",
    name: "New Year's Day",
    countryCode: "TW",
    isGlobal: true,
    types: ["Public"],
    ...overrides,
  };
}

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
    mockUseMonthHolidays.mockReset().mockReturnValue(emptyHolidays);
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

    const rows = container.querySelectorAll(".board-event-list-row, .board-calendar-day__event");
    expect(rows).toHaveLength(2);
    expect(container.textContent).toContain("早會");
    expect(container.textContent).toContain("午間簡報");
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

    const row = container.querySelector(
      '[data-testid="board-calendar-day-row-analysis-1"] .board-event-list-row__main',
    ) as HTMLButtonElement;
    act(() => {
      row?.click();
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

  it("does not paint a Nager overlay in day mode", () => {
    mockUseMonthHolidays.mockReturnValue({
      ...emptyHolidays,
      holidaysByDate: { "2026-07-22": [nagerHoliday({ date: "2026-07-22" })] },
    });
    act(() => {
      root.render(createElement(CalendarBoardEmbed, { mode: "day", events: [makeEvent()] }));
    });
    expect(mockUseMonthHolidays).toHaveBeenCalledWith(false, expect.any(Array));
    expect(container.querySelector('[data-testid="board-calendar-month-holiday"]')).toBeNull();
    expect(container.querySelector(".board-calendar-month__day--holiday")).toBeNull();
  });
});

describe("CalendarBoardEmbed month Nager overlay", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mockUseMonthHolidays.mockReset().mockReturnValue(emptyHolidays);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 12, 0, 0, 0));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function renderMonth(events: AnalysisEvent[] = []) {
    act(() => {
      root.render(createElement(CalendarBoardEmbed, { mode: "month", events }));
    });
  }

  it("paints the in-month date red and puts the Nager name under the number", () => {
    mockUseMonthHolidays.mockReturnValue({
      ...emptyHolidays,
      holidaysByDate: { "2026-07-01": [nagerHoliday()] },
    });
    renderMonth();

    expect(mockUseMonthHolidays).toHaveBeenCalledWith(true, expect.any(Array));
    const jul1 = container.querySelector('[data-date="2026-07-01"]');
    const num = jul1?.querySelector(".board-calendar-month__num");
    const holiday = jul1?.querySelector('[data-testid="board-calendar-month-holiday"]');
    expect(jul1?.className).toContain("board-calendar-month__day--holiday");
    expect(num?.textContent).toBe("1");
    expect(holiday?.textContent).toContain("元旦");
    expect(holiday?.className).toContain("board-calendar-month__holiday");
    expect(holiday?.getAttribute("title")).toContain("元旦");
    expect(
      num && holiday
        ? Boolean(num.compareDocumentPosition(holiday) & Node.DOCUMENT_POSITION_FOLLOWING)
        : false,
    ).toBe(true);

    const jul2 = container.querySelector('[data-date="2026-07-02"]');
    expect(jul2?.className).not.toContain("board-calendar-month__day--holiday");
    expect(jul2?.querySelector('[data-testid="board-calendar-month-holiday"]')).toBeNull();
  });

  it("shows the first holiday name plus +N when several Nager holidays share a day", () => {
    mockUseMonthHolidays.mockReturnValue({
      ...emptyHolidays,
      holidaysByDate: {
        "2026-07-01": [
          nagerHoliday(),
          nagerHoliday({ localName: "開國紀念日", name: "Founding Day" }),
        ],
      },
    });
    renderMonth();

    const holiday = container.querySelector(
      '[data-date="2026-07-01"] [data-testid="board-calendar-month-holiday"]',
    );
    expect(holiday?.textContent).toContain("元旦");
    expect(holiday?.textContent).toContain("+1");
    expect(holiday?.textContent).not.toContain("開國紀念日");
    expect(holiday?.getAttribute("title")).toContain("開國紀念日");
  });

  it("keeps event dots under the holiday name instead of cloning the Timeline month grid", () => {
    mockUseMonthHolidays.mockReturnValue({
      ...emptyHolidays,
      holidaysByDate: { "2026-07-22": [nagerHoliday({ date: "2026-07-22", localName: "假期" })] },
    });
    renderMonth([makeEvent()]);

    const cell = container.querySelector('[data-date="2026-07-22"]');
    expect(cell?.className).toContain("board-calendar-month__day--holiday");
    expect(cell?.querySelector('[data-testid="board-calendar-month-holiday"]')?.textContent).toContain(
      "假期",
    );
    expect(cell?.querySelectorAll(".board-calendar-month__chip")).toHaveLength(1);
    expect(container.querySelector(".im-timeline-month-grid")).toBeNull();
    expect(container.querySelector(".im-month-day-watermark-stack")).toBeNull();
  });

  it("does not overlay Nager names on out-of-month padded days", () => {
    mockUseMonthHolidays.mockReturnValue({
      ...emptyHolidays,
      holidaysByDate: { "2026-06-30": [nagerHoliday({ date: "2026-06-30", localName: "六月假" })] },
    });
    renderMonth();

    const jun30 = container.querySelector('[data-date="2026-06-30"]');
    expect(jun30?.className).toContain("board-calendar-month__day--muted");
    expect(jun30?.className).not.toContain("board-calendar-month__day--holiday");
    expect(jun30?.querySelector('[data-testid="board-calendar-month-holiday"]')).toBeNull();
  });
});
