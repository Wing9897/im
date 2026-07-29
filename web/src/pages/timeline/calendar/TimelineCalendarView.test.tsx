import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { buildCalendarDays, buildWeekDays } from "../../../domain/timeline/dateUtils";
import { makeEvent } from "../../../test/timelineTestHelpers";

vi.mock("../../../hooks/useMonthWeather", () => ({
  useMonthWeather: () => ({
    weatherByDate: {
      "2025-01-15": { code: 0, high: 25, low: 18 },
    },
    error: null,
  }),
  weatherIcon: () => "☀️",
}));

const { TimelineCalendarView } = await import("./TimelineCalendarView");

type Props = Parameters<typeof TimelineCalendarView>[0];

function makeProps(overrides: Partial<Props> = {}): Props {
  const timeCursor = new Date(2025, 0, 15); // January 15, 2025
  const monthCursor = new Date(2025, 0, 1); // January 2025
  const monthDays = buildCalendarDays(monthCursor);
  const weekDays = buildWeekDays(timeCursor);

  return {
    timeScale: "month",
    rangeStart: new Date(2025, 0, 13), // Monday of the week
    rangeEvents: [],
    weekDays,
    timeCursor,
    monthCursor,
    monthDays,
    monthEvents: [],
    focusedDay: null,
    eventStatuses: {},
    onSelectEvent: vi.fn(),
    onFocusDay: vi.fn(),
    ...overrides,
  };
}

function render(props: Props) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(TimelineCalendarView, props),
      ),
    );
  });
  return container;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("TimelineCalendarView", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
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
      const endingCell = dayCells.find((cell) => cell.textContent?.includes("+1 完結"));

      expect(startCell).toBeTruthy();
      expect(startCell?.textContent).not.toContain("進行中");
      expect(startCell?.textContent).not.toContain("完結");
      expect(ongoingCell).toBeTruthy();
      expect(ongoingCell).not.toBe(startCell);
      expect(ongoingCell?.textContent).not.toContain("完結");
      expect(endingCell).toBeTruthy();
      expect(endingCell).not.toBe(startCell);
      expect(endingCell?.textContent).not.toContain("進行中");
      expect(container.querySelectorAll('[data-testid="month-span-indicators"]').length).toBe(2);
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
      expect(container.textContent).not.toContain("完結");
      expect(container.querySelectorAll('[data-testid="month-span-indicators"]').length).toBe(0);
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

      // Week view renders event titles via TimelineEventCard
      expect(container.textContent).toContain("Wednesday Meeting");
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
