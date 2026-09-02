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
