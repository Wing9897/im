import { act } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeEvent } from "../../../test/timelineTestHelpers";import {
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

      // TimelineMonthGrid renders day cells as role="button" elements
      const dayCells = container.querySelectorAll('[role="button"]');
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

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'));
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

      const dayCells = container.querySelectorAll('[role="button"]');
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

      const dayCells = container.querySelectorAll('[role="button"]');
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

      const dayCells = container.querySelectorAll('[role="button"]');
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
      expect(container.textContent).not.toContain("1 事件");
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
      expect(container.textContent).not.toContain("+1 更多");
    });

    it("shows two event previews and a clickable overflow hint in month view", () => {
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

      const dayCell = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find(
        (cell) => cell.textContent?.includes("第一個事件"),
      );
      expect(dayCell?.textContent).toContain("第一個事件");
      expect(dayCell?.textContent).toContain("第二個事件");
      expect(dayCell?.textContent).not.toContain("第三個事件");
      expect(dayCell?.textContent).toContain("+1 更多");

      const overflowHint = Array.from(dayCell!.querySelectorAll("span")).find(
        (element) => element.textContent === "+1 更多",
      );
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
      const dayCell = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]')).find(
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

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'));
      const startCell = dayCells.find((cell) => cell.textContent?.includes("三日行程"));
      const ongoingCell = dayCells.find((cell) => cell.textContent?.includes("+1 進行中"));
      const endingCell = dayCells.find((cell) => cell.textContent?.includes("+1 結束"));

      expect(startCell).toBeTruthy();
      expect(startCell?.textContent).not.toContain("進行中");
      expect(startCell?.textContent).not.toContain("結束");
      expect(ongoingCell).toBeTruthy();
      expect(ongoingCell).not.toBe(startCell);
      expect(ongoingCell?.textContent).not.toContain("結束");
      expect(endingCell).toBeTruthy();
      expect(endingCell).not.toBe(startCell);
      expect(endingCell?.textContent).not.toContain("進行中");
      expect(container.querySelectorAll('[data-testid="month-span-indicators"]').length).toBe(2);
    });

    it("shows +N ending / ongoing on a navigated non-current month for prior-month starts", () => {
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

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'));
      const day1 = dayCells.find((cell) =>
        (cell.getAttribute("aria-label") ?? "").includes("2026年9月1日"),
      );
      const day2 = dayCells.find((cell) =>
        (cell.getAttribute("aria-label") ?? "").includes("2026年9月2日"),
      );

      expect(day1?.textContent).toContain("+1 結束");
      expect(day1?.textContent).toContain("+1 進行中");
      expect(day2?.textContent).toContain("+1 進行中");
      expect(day2?.textContent).not.toContain("結束");
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
      expect(container.querySelectorAll('[data-testid="month-span-indicators"]').length).toBe(0);
    });

    it("counts recurring final in +N 結束; remind item still titles in preview", () => {
      const events = [
        makeEvent({
          id: "item:milk:remind",
          title: "提醒 · milk",
          source: "item",
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

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'));
      const day16 = dayCells.find((cell) =>
        (cell.getAttribute("aria-label") ?? "").includes("2025年1月16日"),
      );
      expect(day16).toBeTruthy();
      expect(day16?.textContent).toContain("+1 結束");
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

});
