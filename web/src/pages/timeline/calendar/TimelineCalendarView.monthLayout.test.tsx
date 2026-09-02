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

    it("renders month cards instead of the unified grid when layout is split", () => {
      const container = render(
        makeProps({
          timeScale: "month",
          monthLayout: "split",
          monthCardModels: [
            { kind: "workset", worksetId: "ws-a", title: "Alpha", cover: "", events: [] },
          ],
        }),
      );
      expect(container.querySelector('[data-testid="timeline-month-cards-grid"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="timeline-month-card"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="timeline-month-grid"]')).toBeNull();
      expect(container.querySelectorAll('[data-testid="timeline-split-month-day"]').length).toBe(42);
      expect(container.querySelectorAll(MONTH_DAY_CELL).length).toBe(0);
    });

    it("renders the empty cards hint when split has no sources", () => {
      const container = render(makeProps({ timeScale: "month", monthLayout: "split" }));
      expect(container.querySelector('[data-testid="timeline-month-cards-empty"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="timeline-month-grid"]')).toBeNull();
    });

    it("does not paint a shared timeCursor or focusedDay as selected on split cards", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 7, 30, 15, 0, 0));
      const monthCursor = new Date(2026, 7, 1);
      try {
        const container = render(
          makeProps({
            timeScale: "month",
            monthLayout: "split",
            monthCursor,
            monthDays: buildCalendarDays(monthCursor),
            timeCursor: new Date(2026, 7, 31),
            focusedDay: new Date(2026, 7, 31),
            monthCardModels: [
              { kind: "workset", worksetId: "ws-a", title: "Alpha", cover: "", events: [] },
              { kind: "subscribe", key: "Alice/Work", title: "Alice/Work", cover: "", events: [] },
            ],
          }),
        );
        const days30 = container.querySelectorAll(
          '[data-testid="timeline-split-month-day"][data-day="2026-08-30"]',
        );
        const days31 = container.querySelectorAll(
          '[data-testid="timeline-split-month-day"][data-day="2026-08-31"]',
        );
        expect(days30).toHaveLength(2);
        expect(days31).toHaveLength(2);
        expect([...days30].every((day) => day.className.includes("is-today"))).toBe(true);
        expect([...days31].every((day) => !day.className.includes("is-today"))).toBe(true);
        expect([...days31].every((day) => !day.className.includes("is-active"))).toBe(true);
      } finally {
        vi.useRealTimers();
      }
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

  describe("month cell header day number", () => {
    const MONTH_DAY_NUMBER = '[data-testid="timeline-month-day-number"]';

    it("puts 1–31 in the header top-left of every cell, including other-month days", () => {
      const monthCursor = new Date(2025, 0, 1);
      const monthDays = buildCalendarDays(monthCursor);
      const container = render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays,
          timeCursor: new Date(2025, 0, 15),
        }),
      );

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL));
      expect(dayCells).toHaveLength(42);
      expect(monthDays).toHaveLength(42);

      dayCells.forEach((cell, index) => {
        const day = monthDays[index]!;
        const header = cell.querySelector('[data-testid="timeline-month-day-header"]');
        const number = header?.querySelector<HTMLElement>(MONTH_DAY_NUMBER);
        expect(number?.textContent).toBe(String(day.getDate()));
        expect(header?.contains(number ?? null)).toBe(true);
        expect(header?.firstElementChild?.firstElementChild).toBe(number);

        const isCurrentMonth = day.getMonth() === 0;
        const isActive = day.getDate() === 15 && isCurrentMonth;
        if (isActive) {
          expect(number?.className).toContain("rounded-full");
          expect(number?.className).toContain("bg-accent");
        } else if (isCurrentMonth) {
          expect(number?.className).toContain("text-text-primary");
          expect(number?.className).not.toContain("text-text-muted");
        } else {
          expect(number?.className).toContain("text-text-muted");
          expect(cell.className).toMatch(/opacity-\[0\.72\]/);
        }
      });

      expect(dayCells[0]?.querySelector(MONTH_DAY_NUMBER)?.textContent).toBe("29");
      expect(dayCells[0]?.querySelector(MONTH_DAY_NUMBER)?.className).toContain("text-text-muted");
    });

    it("keeps Timer/CircleCheck counts beside the header date instead of covering it", () => {
      const monthCursor = new Date(2025, 0, 1);
      const container = render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays: buildCalendarDays(monthCursor),
          monthEvents: [
            makeEvent({
              id: "span-trip",
              title: "三日行程",
              startTime: "2025-01-15T09:00:00",
              endTime: "2025-01-17T18:00:00",
            }),
          ],
          timeCursor: new Date(2025, 0, 10),
        }),
      );

      const dayCells = Array.from(container.querySelectorAll<HTMLElement>(MONTH_DAY_CELL));
      const ongoingCell = dayCells.find((cell) =>
        cell.querySelector('[data-testid="month-span-ongoing"]'),
      );
      const header = ongoingCell?.querySelector('[data-testid="timeline-month-day-header"]');
      const number = header?.querySelector(MONTH_DAY_NUMBER);
      const span = header?.querySelector('[data-testid="month-span-indicators"]');

      expect(number?.textContent).toBe("16");
      expect(span?.querySelector('[data-testid="month-span-ongoing"]')?.textContent).toBe("1");
      expect(
        span?.querySelector('[data-testid="month-span-ongoing"] svg')?.classList.contains("lucide-timer"),
      ).toBe(true);
      expect(
        number && span
          ? Boolean(number.compareDocumentPosition(span) & Node.DOCUMENT_POSITION_FOLLOWING)
          : false,
      ).toBe(true);
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
      expect(header?.querySelector('[data-testid="timeline-month-day-number"]')?.textContent).toBe("15");
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

    it("keeps first-row 進行中/結束 counts when dates are revealed", () => {
      const container = renderBusyMonth({
        datesRevealed: true,
        monthEvents: [
          makeEvent({
            id: "span-trip",
            title: "三日行程",
            startTime: "2025-01-15T09:00:00",
            endTime: "2025-01-17T18:00:00",
          }),
        ],
      });
      const grid = container.querySelector('[data-testid="timeline-month-grid"]');
      expect(grid?.className).toContain("is-revealed");

      const jan16 = cellFor(container, "2025年1月16日");
      const jan17 = cellFor(container, "2025年1月17日");
      const header16 = jan16?.querySelector('[data-testid="timeline-month-day-header"]');
      const header17 = jan17?.querySelector('[data-testid="timeline-month-day-header"]');

      expect(header16?.querySelector('[data-testid="timeline-month-day-number"]')?.textContent).toBe("16");
      expect(header16?.querySelector('[data-testid="month-span-ongoing"]')?.textContent).toBe("1");
      expect(
        header16
          ?.querySelector('[data-testid="month-span-ongoing"] svg')
          ?.classList.contains("lucide-timer"),
      ).toBe(true);
      expect(header16?.querySelector('[data-testid="month-span-indicators"]')).toBeTruthy();

      expect(header17?.querySelector('[data-testid="timeline-month-day-number"]')?.textContent).toBe("17");
      expect(header17?.querySelector('[data-testid="month-span-ending"]')?.textContent).toBe("1");
      expect(
        header17
          ?.querySelector('[data-testid="month-span-ending"] svg')
          ?.classList.contains("lucide-circle-check"),
      ).toBe(true);

      const jan15 = cellFor(container, "2025年1月15日");
      expect(jan15?.querySelector('[data-testid="timeline-month-day-number"]')?.textContent).toBe("15");
      expect(jan15?.querySelector(".im-month-day-events")?.textContent).toContain("三日行程");
      expect(jan15?.querySelector('[data-testid="month-span-indicators"]')).toBeNull();
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

});
