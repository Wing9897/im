import { act } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeEvent } from "../../../test/timelineTestHelpers";
import {
  buildCalendarDays,
  buildWeekDays,
  makeTimelineCalendarViewProps,
  prepareTimelineCalendarViewTests,
  renderTimelineCalendarView,
} from "./timelineCalendarViewTestHarness";

const { mockUseErrorToast } = vi.hoisted(() => ({
  mockUseErrorToast: vi.fn(),
}));

vi.mock("../../../hooks/useMonthWeather", () => ({
  weatherIcon: () => "☀️",
}));

vi.mock("../../../hooks/useErrorToast", () => ({
  useErrorToast: mockUseErrorToast,
}));

const { TimelineCalendarView } = await import("./TimelineCalendarView");

const MONTH_DAY_CELL = '[data-testid="timeline-month-day-cell"]';
const MONTH_WATERMARK = '[data-testid="timeline-month-day-watermark"]';
const MONTH_SURFACE = '[data-testid="timeline-month-day-surface"]';

type Props = Parameters<typeof TimelineCalendarView>[0];

function makeProps(overrides: Partial<Props> = {}): Props {
  return makeTimelineCalendarViewProps<Props>(overrides);
}

function render(props: Props) {
  return renderTimelineCalendarView(TimelineCalendarView, props);
}

describe("TimelineCalendarView", () => {
  beforeEach(async () => {
    await prepareTimelineCalendarViewTests(mockUseErrorToast);
  });

  describe("month view — renders correct number of day cells", () => {
    it("renders 42 day cells for the month grid (6 weeks × 7 days)", () => {
      const props = makeProps({ timeScale: "month" });
      const container = render(props);

      const dayCells = container.querySelectorAll(MONTH_DAY_CELL);
      expect(dayCells.length).toBe(42);
    });

    it("gives every month day cell an accessible name with its event count", () => {
      const events = [
        makeEvent({
          id: "evt-1",
          title: "第一個事件",
          startTime: "2025-01-15T09:00:00",
        }),
        makeEvent({
          id: "evt-2",
          title: "第二個事件",
          startTime: "2025-01-15T11:00:00",
        }),
      ];
      const monthCursor = new Date(2025, 0, 1);
      const container = render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays: buildCalendarDays(monthCursor),
          monthEvents: events,
          timeCursor: new Date(2025, 0, 10),
        }),
      );

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL));
      expect(dayCells).toHaveLength(42);
      expect(dayCells.every((cell) => (cell.getAttribute("aria-label") ?? "").length > 0)).toBe(
        true,
      );

      const jan15 = new Date(2025, 0, 15).toLocaleDateString("zh-Hant", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
      const busyCell = dayCells.find((cell) => cell.textContent?.includes("第一個事件"));
      expect(busyCell?.getAttribute("aria-label")).toBe(`${jan15}，2 則事件`);

      const emptyCell = dayCells.find(
        (cell) => cell.getAttribute("aria-label")?.endsWith("無事件") ?? false,
      );
      expect(emptyCell).toBeTruthy();
    });

    it("renders 42 day cells for February 2025 (non-leap year)", () => {
      const monthCursor = new Date(2025, 1, 1); // February 2025
      const monthDays = buildCalendarDays(monthCursor);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays,
        timeCursor: new Date(2025, 1, 10),
      });
      const container = render(props);

      const dayCells = container.querySelectorAll(MONTH_DAY_CELL);
      expect(dayCells.length).toBe(42);
    });

    it("renders 42 day cells for February 2024 (leap year)", () => {
      const monthCursor = new Date(2024, 1, 1); // February 2024 (leap year)
      const monthDays = buildCalendarDays(monthCursor);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays,
        timeCursor: new Date(2024, 1, 10),
      });
      const container = render(props);

      const dayCells = container.querySelectorAll(MONTH_DAY_CELL);
      expect(dayCells.length).toBe(42);
    });
  });

  describe("week view — renders correct number of day cells", () => {
    it("renders 7 day cells for the week grid", () => {
      const timeCursor = new Date(2025, 0, 15);
      const weekDays = buildWeekDays(timeCursor);
      const props = makeProps({ timeScale: "week", weekDays });
      const container = render(props);

      // Week view renders day cells as role="button" elements
      const dayCells = container.querySelectorAll('[role="button"]');
      expect(dayCells.length).toBe(7);
    });
  });

  describe("today's date highlighting", () => {
    it("highlights today's date with accent styling and label in month view", () => {
      const today = new Date();
      const monthCursor = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthDays = buildCalendarDays(monthCursor);
      // Set timeCursor to a different day so activeDay doesn't override today styling
      const differentDay = new Date(today);
      differentDay.setDate(today.getDate() === 1 ? 2 : 1);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays,
        timeCursor: differentDay,
      });
      const container = render(props);

      expect(container.textContent).toContain("今天");

      const dayCells = container.querySelectorAll(MONTH_DAY_CELL);
      const todayCellWithAccent = Array.from(dayCells).find((cell) => {
        if (!cell.textContent?.includes("今天")) return false;
        const className = (cell as HTMLElement).className;
        return className.includes("accent") || className.includes("var(--accent)");
      });
      expect(todayCellWithAccent).toBeDefined();
    });

    it("highlights today's date with '今天' label in week view", () => {
      const today = new Date();
      const weekDays = buildWeekDays(today);
      const props = makeProps({
        timeScale: "week",
        weekDays,
        timeCursor: new Date(2020, 0, 1), // different from today so activeDay doesn't override
        rangeEvents: [],
      });
      const container = render(props);

      // Week view renders "今天" text for today's cell
      expect(container.textContent).toContain("今天");
    });
  });

  describe("events render in correct day cells", () => {
    it("renders compact weather when the day forecast is available", () => {
      const container = render(makeProps());

      expect(container.querySelector('[aria-label="天氣 25 至 18 度"]')?.textContent).toContain("25°");
    });

    it("does not turn a best-effort weather failure into an error toast", () => {
      render(makeProps());

      expect(mockUseErrorToast).not.toHaveBeenCalled();
    });

    it("renders events in the correct day cell in month view", () => {
      // Event on January 15, 2025
      const event = makeEvent({
        id: "evt-jan15",
        title: "January 15 Event",
        startTime: "2025-01-15T14:00:00Z",
      });
      const monthCursor = new Date(2025, 0, 1);
      const monthDays = buildCalendarDays(monthCursor);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays,
        monthEvents: [event],
        timeCursor: new Date(2025, 0, 10),
      });
      const container = render(props);

      // Month cells show title previews (not a header count badge).
      expect(container.textContent).not.toContain("+1 事件");
      expect(container.textContent).toContain("January 1");
    });

    it("renders multiple events in the same day cell in month view", () => {
      const events = [
        makeEvent({
          id: "evt-1",
          title: "Morning Event",
          startTime: "2025-01-15T09:00:00Z",
        }),
        makeEvent({
          id: "evt-2",
          title: "Afternoon Event",
          startTime: "2025-01-15T14:00:00Z",
        }),
      ];
      const monthCursor = new Date(2025, 0, 1);
      const monthDays = buildCalendarDays(monthCursor);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays,
        monthEvents: events,
        timeCursor: new Date(2025, 0, 10),
      });
      const container = render(props);

      // Both event titles truncate in the cell when two events share a day.
      expect(container.textContent).toContain("Morning E…");
      expect(container.textContent).toContain("Afternoon…");
      expect(container.querySelector('[title="Morning Event"]')).toBeTruthy();
      expect(container.querySelector('[title="Afternoon Event"]')).toBeTruthy();
      expect(container.textContent).not.toContain("+1 事件");
      expect(container.textContent).not.toContain("更多");
    });

    it("shows four event previews and a clickable overflow hint from the fifth", () => {
      const events = [
        makeEvent({
          id: "evt-1",
          title: "第一個事件",
          startTime: "2025-01-15T09:00:00Z",
        }),
        makeEvent({
          id: "evt-2",
          title: "第二個事件",
          startTime: "2025-01-15T11:00:00Z",
        }),
        makeEvent({
          id: "evt-3",
          title: "第三個事件",
          startTime: "2025-01-15T12:00:00Z",
        }),
        makeEvent({
          id: "evt-4",
          title: "第四個事件",
          startTime: "2025-01-15T13:00:00Z",
        }),
        makeEvent({
          id: "evt-5",
          title: "第五個事件",
          startTime: "2025-01-15T14:00:00Z",
        }),
      ];
      const onFocusDay = vi.fn();
      const monthCursor = new Date(2025, 0, 1);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays: buildCalendarDays(monthCursor),
        monthEvents: events,
        timeCursor: new Date(2025, 0, 10),
        onFocusDay,
      });
      const container = render(props);

      const dayCell = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL)).find(
        (cell) => cell.textContent?.includes("第一個事件"),
      );
      expect(dayCell?.textContent).toContain("第一個事件");
      expect(dayCell?.textContent).toContain("第二個事件");
      expect(dayCell?.textContent).toContain("第三個事件");
      expect(dayCell?.textContent).toContain("第四個事件");
      expect(dayCell?.textContent).not.toContain("第五個事件");
      expect(dayCell?.textContent).toContain("+1 事件");
      expect(dayCell?.textContent).not.toContain("更多");
      const overflowHint = dayCell!.querySelector('[data-testid="month-event-overflow"]');
      expect(overflowHint?.textContent).toBe("+1 事件");
      act(() => {
        overflowHint!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(onFocusDay).toHaveBeenCalledWith(expect.any(Date));
      expect(onFocusDay.mock.calls[0][0].getDate()).toBe(15);
    });

    it("right-click focuses the day and opens a context menu before creating", () => {
      const onFocusDay = vi.fn();
      const onCreateOnDay = vi.fn();
      const monthCursor = new Date(2025, 0, 1);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays: buildCalendarDays(monthCursor),
        timeCursor: new Date(2025, 0, 10),
        onFocusDay,
        onCreateOnDay,
      });
      const container = render(props);
      const dayCell = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL)).find(
        (cell) => cell.getAttribute("aria-label")?.includes("15"),
      );
      expect(dayCell).toBeTruthy();

      act(() => {
        dayCell!.dispatchEvent(
          new MouseEvent("contextmenu", { bubbles: true, clientX: 120, clientY: 80 }),
        );
      });

      expect(onFocusDay).toHaveBeenCalledWith(expect.any(Date));
      expect(onFocusDay.mock.calls[0][0].getDate()).toBe(15);
      expect(onCreateOnDay).not.toHaveBeenCalled();
      const menu = container.querySelector('[data-testid="timeline-month-day-context-menu"]');
      expect(menu).not.toBeNull();
      const addBtn = container.querySelector(
        '[data-testid="timeline-month-day-context-add-event"]',
      ) as HTMLButtonElement | null;
      expect(addBtn).not.toBeNull();
      expect(addBtn!.textContent).toContain("新增事件");

      act(() => {
        addBtn!.click();
      });
      expect(onCreateOnDay).toHaveBeenCalledWith(expect.any(Date));
      expect(onCreateOnDay.mock.calls[0][0].getDate()).toBe(15);
      expect(container.querySelector('[data-testid="timeline-month-day-context-menu"]')).toBeNull();
    });

    it("shows ongoing / ending span indicators on middle and end days", () => {
      const events = [
        makeEvent({
          id: "span-trip",
          title: "三日行程",
          startTime: "2025-01-15T09:00:00",
          endTime: "2025-01-17T18:00:00",
        }),
      ];
      const monthCursor = new Date(2025, 0, 1);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays: buildCalendarDays(monthCursor),
        monthEvents: events,
        timeCursor: new Date(2025, 0, 10),
      });
      const container = render(props);

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL));
      const startCell = dayCells.find((cell) => cell.textContent?.includes("三日行程"));
      const ongoingCell = dayCells.find((cell) => cell.querySelector('[data-testid="month-span-ongoing"]'));
      const endingCell = dayCells.find((cell) => cell.querySelector('[data-testid="month-span-ending"]'));

      expect(startCell).toBeTruthy();
      expect(startCell?.querySelector('[data-testid="month-span-ongoing"]')).toBeNull();
      expect(startCell?.querySelector('[data-testid="month-span-ending"]')).toBeNull();
      expect(ongoingCell).toBeTruthy();
      expect(ongoingCell).not.toBe(startCell);
      expect(ongoingCell?.querySelector('[data-testid="month-span-ending"]')).toBeNull();
      expect(ongoingCell?.querySelector('[data-testid="month-span-ongoing"]')?.textContent).toBe("1");
      expect(ongoingCell?.querySelector('[data-testid="month-span-ongoing"]')?.getAttribute("aria-label")).toBe(
        "1 進行中",
      );
      expect(ongoingCell?.textContent).not.toContain("進行中");
      expect(endingCell).toBeTruthy();
      expect(endingCell).not.toBe(startCell);
      expect(endingCell?.querySelector('[data-testid="month-span-ongoing"]')).toBeNull();
      expect(endingCell?.querySelector('[data-testid="month-span-ending"]')?.textContent).toBe("1");
      expect(endingCell?.querySelector('[data-testid="month-span-ending"]')?.getAttribute("aria-label")).toBe(
        "1 結束",
      );
      expect(endingCell?.textContent).not.toContain("結束");
      expect(container.querySelectorAll('[data-testid="month-span-indicators"]').length).toBe(2);
    });

    it("shows ending / ongoing icon counts on a navigated non-current month for prior-month starts", () => {
      // Cursor on September (not “today’s” month): overnight ending 9/1 + multi-day middle.
      const events = [
        makeEvent({
          id: "cross-month-end",
          title: "月末跨月",
          startTime: "2026-08-31T20:00:00",
          endTime: "2026-09-01T02:00:00",
        }),
        makeEvent({
          id: "multi-into-sept",
          title: "跨月行程",
          startTime: "2026-08-30T09:00:00",
          endTime: "2026-09-03T18:00:00",
        }),
      ];
      const monthCursor = new Date(2026, 8, 1);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays: buildCalendarDays(monthCursor),
        monthEvents: events,
        timeCursor: new Date(2026, 8, 1),
      });
      const container = render(props);

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL));
      const day1 = dayCells.find((cell) =>
        (cell.getAttribute("aria-label") ?? "").includes("2026年9月1日"),
      );
      const day2 = dayCells.find((cell) =>
        (cell.getAttribute("aria-label") ?? "").includes("2026年9月2日"),
      );

      expect(day1?.querySelector('[data-testid="month-span-ending"]')?.textContent).toBe("1");
      expect(day1?.querySelector('[data-testid="month-span-ongoing"]')?.textContent).toBe("1");
      expect(day1?.textContent).not.toContain("結束");
      expect(day1?.textContent).not.toContain("進行中");
      expect(day2?.querySelector('[data-testid="month-span-ongoing"]')?.textContent).toBe("1");
      expect(day2?.querySelector('[data-testid="month-span-ending"]')).toBeNull();
    });

    it("hides ongoing / ending span indicators when toggles are off", () => {
      const events = [
        makeEvent({
          id: "span-trip",
          title: "三日行程",
          startTime: "2025-01-15T09:00:00",
          endTime: "2025-01-17T18:00:00",
        }),
      ];
      const monthCursor = new Date(2025, 0, 1);
      const props = makeProps({
        timeScale: "month",
        monthCursor,
        monthDays: buildCalendarDays(monthCursor),
        monthEvents: events,
        timeCursor: new Date(2025, 0, 10),
        showOngoing: false,
        showEnding: false,
      });
      const container = render(props);

      expect(container.textContent).toContain("三日行程");
      expect(container.textContent).not.toContain("進行中");
      expect(container.textContent).not.toContain("結束");
      expect(container.querySelector('[data-testid="month-span-ongoing"]')).toBeNull();
      expect(container.querySelector('[data-testid="month-span-ending"]')).toBeNull();
      expect(container.querySelectorAll('[data-testid="month-span-indicators"]').length).toBe(0);
    });

    it("counts recurring final in ending icon count; remind item still titles in preview", () => {
      const events = [
        makeEvent({
          id: "item:milk:remind",
          title: "提醒 · milk",
          source: "item_remind",
          itemDateKind: "remind",
          isAllDay: true,
          startTime: "2025-01-16T00:00:00",
          endTime: "2025-01-16T23:59:59",
        }),
        makeEvent({
          id: "rec:last",
          title: "最後一次週會",
          source: "recurring",
          isLastOccurrence: true,
          startTime: "2025-01-16T09:00:00",
          endTime: "2025-01-16T10:00:00",
        }),
      ];
      const monthCursor = new Date(2025, 0, 1);
      const container = render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays: buildCalendarDays(monthCursor),
          monthEvents: events,
          timeCursor: new Date(2025, 0, 16),
        }),
      );

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL));
      const day16 = dayCells.find((cell) =>
        (cell.getAttribute("aria-label") ?? "").includes("2025年1月16日"),
      );
      expect(day16).toBeTruthy();
      expect(day16?.querySelector('[data-testid="month-span-ending"]')?.textContent).toBe("1");
      expect(day16?.querySelector('[data-testid="month-span-ending"]')?.getAttribute("aria-label")).toBe(
        "1 結束",
      );
      expect(day16?.textContent).not.toContain("結束");
      // Remind item + recurring final remain normal preview rows (limit 2).
      expect(day16?.textContent).toContain("提醒 · milk");
      expect(day16?.textContent).toContain("最後一次週會");
    });

    it("renders events in the correct day cell in week view", () => {
      // Week starting Monday Jan 13, 2025
      const timeCursor = new Date(2025, 0, 15); // Wednesday
      const weekDays = buildWeekDays(timeCursor);
      // Event on Wednesday Jan 15
      const event = makeEvent({
        id: "evt-wed",
        title: "Wednesday Meeting",
        startTime: "2025-01-15T10:00:00Z",
      });
      const props = makeProps({
        timeScale: "week",
        weekDays,
        timeCursor,
        rangeEvents: [event],
      });
      const container = render(props);

      expect(container.querySelector('[data-testid="timeline-week-view"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="timeline-week-event-chip"]')?.textContent).toContain(
        "Wednesday Meeting",
      );
    });

    it("does not render events in wrong day cells in week view", () => {
      // Week starting Monday Jan 13, 2025
      const timeCursor = new Date(2025, 0, 15);
      const weekDays = buildWeekDays(timeCursor);
      // Event on Thursday Jan 16
      const event = makeEvent({
        id: "evt-thu",
        title: "Thursday Event",
        startTime: "2025-01-16T10:00:00Z",
      });
      const props = makeProps({
        timeScale: "week",
        weekDays,
        timeCursor,
        rangeEvents: [event],
      });
      const container = render(props);

      // The event should appear in the Thursday cell, not in other cells
      // Verify the event title is rendered somewhere
      expect(container.textContent).toContain("Thursday Event");

      // Verify the day cells: Wednesday (Jan 15) should show "無事件"
      // while Thursday (Jan 16) should show the event
      const dayCells = container.querySelectorAll('[role="button"]');
      // Wednesday is index 2 (Mon=0, Tue=1, Wed=2)
      const wednesdayCell = dayCells[2];
      expect(wednesdayCell?.textContent).toContain("無事件");
      // Thursday is index 3
      const thursdayCell = dayCells[3];
      expect(thursdayCell?.textContent).toContain("Thursday Event");
    });

    it("shows event count per day cell in week view", () => {
      const timeCursor = new Date(2025, 0, 15);
      const weekDays = buildWeekDays(timeCursor);
      const events = [
        makeEvent({
          id: "evt-1",
          title: "Event A",
          startTime: "2025-01-15T09:00:00Z",
        }),
        makeEvent({
          id: "evt-2",
          title: "Event B",
          startTime: "2025-01-15T14:00:00Z",
        }),
      ];
      const props = makeProps({
        timeScale: "week",
        weekDays,
        timeCursor,
        rangeEvents: events,
      });
      const container = render(props);

      // Week view shows "{count} 則" for each day
      expect(container.textContent).toContain("2 則");
    });
  });

  describe("holiday overlay", () => {
    const nagerYuanDan = {
      date: "2025-01-01",
      localName: "元旦",
      name: "New Year's Day",
      countryCode: "TW",
      isGlobal: true,
      types: ["Public"],
    };

    function cellFor(container: HTMLElement, label: string) {
      return Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL)).find((cell) =>
        (cell.getAttribute("aria-label") ?? "").includes(label),
      );
    }

    it("paints the date number red and puts the holiday name under it, not in the header", () => {
      const monthCursor = new Date(2025, 0, 1);
      const container = render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays: buildCalendarDays(monthCursor),
          holidaysByDate: { "2025-01-01": [nagerYuanDan] },
        }),
      );

      const jan1 = cellFor(container, "2025年1月1日");
      const watermark = jan1?.querySelector(MONTH_WATERMARK);
      const holidayName = jan1?.querySelector('[data-testid="timeline-month-day-holiday-name"]');
      const header = jan1?.querySelector('[data-testid="timeline-month-day-header"]');

      expect(watermark?.textContent).toBe("1");
      expect(jan1?.querySelector(".im-month-day-watermark-stack")?.className).toContain("is-holiday");
      expect(watermark?.className).not.toContain("is-holiday");
      expect(holidayName?.textContent).toContain("元旦");
      expect(holidayName?.className).toContain("im-month-day-holiday-watermark");
      expect(holidayName?.getAttribute("title")).toContain("元旦");
      expect(header?.querySelector('[data-testid="timeline-month-day-holiday-name"]')).toBeNull();
      expect(header?.querySelector('[data-testid="timeline-holiday-chip"]')).toBeNull();
      expect(jan1?.querySelector('[data-testid="timeline-holiday-chip"]')).toBeNull();
      expect(
        watermark && holidayName
          ? Boolean(watermark.compareDocumentPosition(holidayName) & Node.DOCUMENT_POSITION_FOLLOWING)
          : false,
      ).toBe(true);

      const jan2 = cellFor(container, "2025年1月2日");
      expect(jan2?.querySelector(".im-month-day-watermark-stack")?.className).not.toContain("is-holiday");
      expect(jan2?.querySelector('[data-testid="timeline-month-day-holiday-name"]')).toBeNull();
    });

    it("shows the first holiday name plus +N when several Nager holidays share a day", () => {
      const monthCursor = new Date(2025, 0, 1);
      const container = render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays: buildCalendarDays(monthCursor),
          holidaysByDate: {
            "2025-01-01": [
              nagerYuanDan,
              { ...nagerYuanDan, localName: "開國紀念日", name: "Founding Day" },
            ],
          },
        }),
      );

      const name = cellFor(container, "2025年1月1日")?.querySelector(
        '[data-testid="timeline-month-day-holiday-name"]',
      );
      expect(name?.textContent).toContain("元旦");
      expect(name?.textContent).toContain("+1");
      expect(name?.textContent).not.toContain("開國紀念日");
      expect(name?.getAttribute("title")).toContain("開國紀念日");
    });
  });

  describe("month cell watermark and 顯示", () => {
    function renderBusyMonth(overrides: Partial<Props> = {}) {
      const monthCursor = new Date(2025, 0, 1);
      return render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays: buildCalendarDays(monthCursor),
          monthEvents: [
            makeEvent({
              id: "evt-1",
              title: "第一個事件",
              startTime: "2025-01-15T09:00:00",
            }),
          ],
          holidaysByDate: {
            "2025-01-01": [
              {
                date: "2025-01-01",
                localName: "元旦",
                name: "New Year's Day",
                countryCode: "TW",
                isGlobal: true,
                types: ["Public"],
              },
            ],
          },
          ...overrides,
        }),
      );
    }

    function cellFor(container: HTMLElement, label: string) {
      return Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL)).find((cell) =>
        (cell.getAttribute("aria-label") ?? "").includes(label),
      );
    }

    it("renders a muted watermark date under the holiday/event surface", () => {
      const container = renderBusyMonth();
      const cells = container.querySelectorAll(MONTH_DAY_CELL);
      expect(cells).toHaveLength(42);
      expect(container.querySelectorAll(MONTH_WATERMARK)).toHaveLength(42);
      expect(container.querySelectorAll(`${MONTH_SURFACE}[aria-hidden="true"]`)).toHaveLength(0);

      const jan15 = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL)).find(
        (cell) => cell.textContent?.includes("第一個事件"),
      );
      expect(jan15?.querySelector(MONTH_WATERMARK)?.textContent).toBe("15");
      expect(jan15?.querySelector(MONTH_WATERMARK)?.className).toContain("im-month-day-watermark");
      expect(jan15?.querySelector(".im-month-day-watermark-stack")?.className).not.toContain("is-holiday");
      expect(jan15?.querySelector(MONTH_SURFACE)?.className).toContain("im-month-day-surface");
      expect(jan15?.textContent).toContain("第一個事件");
      const grid = container.querySelector('[data-testid="timeline-month-grid"]');
      expect(grid?.getAttribute("data-dates-revealed")).toBe("false");
      expect(grid?.className).not.toContain("is-revealed");
      expect(container.querySelectorAll('[data-testid="timeline-month-day-header"]')).toHaveLength(42);
      const jan2 = cellFor(container, "2025年1月2日");
      expect(jan2?.querySelector('[data-testid="timeline-holiday-chip"]')).toBeNull();
      expect(jan2?.querySelector('[data-testid="timeline-month-day-holiday-name"]')).toBeNull();
      expect(jan2?.querySelector('[data-testid="timeline-month-day-header"]')?.className).toContain(
        "im-month-day-header",
      );
      const jan1 = cellFor(container, "2025年1月1日");
      expect(jan1?.querySelector(".im-month-day-watermark-stack")?.className).toContain("is-holiday");
      expect(jan1?.querySelector('[data-testid="timeline-month-day-holiday-name"]')?.textContent).toContain(
        "元旦",
      );
      expect(jan1?.querySelector('[data-testid="timeline-month-day-header"]')?.querySelector(
        '[data-testid="timeline-month-day-holiday-name"]',
      )).toBeNull();
    });

    it("caps empty special headers with a muted weekday", () => {
      const container = renderBusyMonth();
      const jan1 = cellFor(container, "2025年1月1日");
      expect(jan1?.querySelector('[data-testid="timeline-holiday-chip"]')).toBeNull();
      expect(jan1?.querySelector('[data-testid="timeline-month-day-holiday-name"]')?.textContent).toContain(
        "元旦",
      );
      expect(jan1?.querySelector('[data-testid="timeline-month-day-weekday-filler"]')?.textContent).toBe(
        "三",
      );

      const jan2 = cellFor(container, "2025年1月2日");
      const filler = jan2?.querySelector('[data-testid="timeline-month-day-weekday-filler"]');
      expect(filler).toBeTruthy();
      expect(filler?.textContent).toBe("四");
      expect(filler?.className).toContain("im-month-day-weekday-filler");
      expect(jan2?.querySelector('[data-testid="timeline-holiday-chip"]')).toBeNull();
    });

    it("keeps header weather when dates are revealed and hides event rows", () => {
      const container = renderBusyMonth({ datesRevealed: true });
      const grid = container.querySelector('[data-testid="timeline-month-grid"]');
      expect(grid?.className).toContain("is-revealed");

      const jan15 = cellFor(container, "2025年1月15日");
      const header = jan15?.querySelector('[data-testid="timeline-month-day-header"]');
      const weather = header?.querySelector('[data-testid="timeline-month-day-weather"]');
      expect(weather).toBeTruthy();
      expect(weather?.textContent).toContain("25°");
      expect(header?.querySelector(".im-weather-chip")).toBeTruthy();
      expect(jan15?.querySelector(".im-month-day-events")).toBeTruthy();
      expect(jan15?.querySelector(".im-month-day-events")?.textContent).toContain("第一個事件");
      expect(jan15?.querySelector(MONTH_SURFACE)?.getAttribute("aria-hidden")).toBeNull();

      const jan1 = cellFor(container, "2025年1月1日");
      expect(jan1?.querySelector('[data-testid="timeline-month-day-header"]')?.textContent).toContain("三");
      expect(jan1?.querySelector('[data-testid="timeline-month-day-holiday-name"]')?.textContent).toContain(
        "元旦",
      );
      expect(jan1?.querySelector(".im-month-day-watermark-stack")?.className).toContain("is-holiday");
    });

    it("datesRevealed marks the month grid root", () => {
      const idle = renderBusyMonth();
      const idleGrid = idle.querySelector('[data-testid="timeline-month-grid"]');
      expect(idleGrid?.className).toContain("im-timeline-month-grid");
      expect(idleGrid?.className).not.toContain("is-revealed");
      expect(idleGrid?.getAttribute("data-dates-revealed")).toBe("false");

      const container = renderBusyMonth({ datesRevealed: true });
      const grid = container.querySelector('[data-testid="timeline-month-grid"]');
      expect(grid?.className).toContain("is-revealed");
      expect(grid?.getAttribute("data-dates-revealed")).toBe("true");
      expect(container.querySelector('[data-testid="timeline-month-day-weekday-filler"]')).toBeTruthy();
    });
  });

  describe("week view — calendar and analysis chips", () => {
    it("renders recurring calendar occurrences beside analysis events with a status rail", () => {
      const calendarEvent = makeEvent({
        id: "cal-task1-2025-01-15T09:00:00Z",
        seriesId: "cal-task-1",
        taskName: "Weekly Standup",
        title: "Weekly Standup",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
        source: "recurring",
        isAllDay: false,
      });
      const analysisEvent = makeEvent({
        id: "evt-analysis-1",
        taskId: "task-analysis-1",
        taskName: "Analysis Task",
        title: "Analysis Meeting",
        startTime: "2025-01-15T14:00:00Z",
        endTime: "2025-01-15T15:00:00Z",
      });
      const container = render(
        makeProps({
          timeScale: "week",
          rangeEvents: [calendarEvent, analysisEvent],
        }),
      );
      expect(container.textContent).toContain("Weekly Standup");
      expect(container.textContent).toContain("Analysis Meeting");
      const calendarCard = Array.from(
        container.querySelectorAll('[data-testid="timeline-week-event-chip"]'),
      ).find((btn) => btn.textContent?.includes("Weekly Standup"));
      expect(calendarCard).toBeDefined();
      expect((calendarCard as HTMLElement).className).toContain("im-surface-inset");
      expect((calendarCard as HTMLElement).className).not.toContain("bg-surface-card");
      const statusRail = calendarCard!.querySelector('[aria-hidden="true"]') as HTMLElement | null;
      expect(statusRail).not.toBeNull();
      expect(statusRail!.style.backgroundColor).toBe("var(--warning)");
    });
  });

  describe("day view — all-day zone", () => {
    it("shows all-day calendar events with the 全日 label beside timed calendar and analysis cards", () => {
      const allDayCalendar = makeEvent({
        id: "cal-task2-2025-01-15T00:00:00Z",
        seriesId: "cal-task-2",
        title: "Company Holiday",
        startTime: "2025-01-15T00:00:00Z",
        endTime: "2025-01-15T23:59:59Z",
        source: "recurring",
        isAllDay: true,
      });
      const timedCalendar = makeEvent({
        id: "cal-task1-2025-01-15T09:00:00Z",
        seriesId: "cal-task-1",
        title: "Weekly Standup",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
        source: "recurring",
        isAllDay: false,
      });
      const analysisEvent = makeEvent({
        id: "evt-analysis-1",
        title: "Analysis Meeting",
        startTime: "2025-01-15T14:00:00Z",
        endTime: "2025-01-15T15:00:00Z",
      });
      const container = render(
        makeProps({
          timeScale: "day",
          rangeStart: new Date(2025, 0, 15),
          rangeEvents: [allDayCalendar, timedCalendar, analysisEvent],
        }),
      );
      const cards = Array.from(
        container.querySelectorAll('[data-testid="timeline-day-event-card"]'),
      );
      expect(cards).toHaveLength(3);
      const holiday = cards.find((card) => card.textContent?.includes("Company Holiday"));
      const standup = cards.find((card) => card.textContent?.includes("Weekly Standup"));
      const analysis = cards.find((card) => card.textContent?.includes("Analysis Meeting"));
      expect(holiday?.textContent).toContain("全日");
      expect(standup?.textContent).not.toContain("全日");
      expect(analysis?.textContent).not.toContain("全日");
    });
  });

  describe("schedule emojis from entity columns", () => {
    it("shows the one-off emoji on month titles instead of the default dot", () => {
      const event = makeEvent({
        id: "ue-bday",
        title: "生日派對",
        source: "user",
        emoji: "🎂",
        startTime: "2025-01-15T09:00:00",
        endTime: "2025-01-15T10:00:00",
      });
      const monthCursor = new Date(2025, 0, 1);
      const container = render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays: buildCalendarDays(monthCursor),
          monthEvents: [event],
          timeCursor: new Date(2025, 0, 15),
        }),
      );
      const dayCells = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL));
      const day15 = dayCells.find((cell) =>
        (cell.getAttribute("aria-label") ?? "").includes("2025年1月15日"),
      );
      expect(day15?.querySelector('[data-testid="schedule-event-emoji"]')?.textContent).toBe("🎂");
      expect(day15?.textContent).toContain("生日派對");
    });

    it("shows the series emoji on day cards for RRULE occurrences", () => {
      const event = makeEvent({
        id: "cal-task-1:20250115T090000Z",
        seriesId: "cal-task-1",
        title: "Weekly Standup",
        source: "recurring",
        emoji: "🔁",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T10:00:00Z",
      });
      const container = render(
        makeProps({
          timeScale: "day",
          rangeStart: new Date(2025, 0, 15),
          rangeEvents: [event],
        }),
      );
      const card = container.querySelector('[data-testid="timeline-day-event-card"]');
      expect(card?.querySelector('[data-testid="schedule-event-emoji"]')?.textContent).toContain("🔁");
      expect(card?.querySelector('[data-testid="card-title-icon"]')).toBeNull();
    });
  });
});
