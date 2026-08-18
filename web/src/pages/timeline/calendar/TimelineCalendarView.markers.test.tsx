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

type Props = Parameters<typeof TimelineCalendarView>[0];

function makeProps(overrides: Partial<Props> = {}): Props {
  return makeTimelineCalendarViewProps<Props>(overrides);
}

function render(props: Props) {
  return renderTimelineCalendarView(TimelineCalendarView, props);
}

describe("TimelineCalendarView markers", () => {
  beforeEach(async () => {
    await prepareTimelineCalendarViewTests(mockUseErrorToast);
  });

  describe("day view — card location + layout", () => {
    it("shows location when present and omits literal N/A when missing", () => {
      const events = [
        makeEvent({
          id: "with-loc",
          title: "有地點",
          startTime: "2025-01-15T09:00:00",
          endTime: "2025-01-15T10:00:00",
          location: "會議室 A",
        }),
        makeEvent({
          id: "no-loc",
          title: "無地點",
          startTime: "2025-01-15T11:00:00",
          endTime: "2025-01-15T12:00:00",
          location: null,
        }),
      ];
      const container = render(
        makeProps({
          timeScale: "day",
          rangeStart: new Date(2025, 0, 15),
          rangeEvents: events,
        }),
      );

      const cards = container.querySelectorAll('[data-testid="timeline-day-event-card"]');
      expect(cards.length).toBe(2);
      const locations = Array.from(
        container.querySelectorAll('[data-testid="timeline-day-event-location"]'),
      ).map((node) => node.textContent ?? "");
      expect(locations.some((text) => text.includes("會議室 A"))).toBe(true);
      expect(locations.every((text) => !text.includes("N/A"))).toBe(true);
    });

    it("user schedule cards stack fields and show N/A for empty location and notes", () => {
      const events = [
        makeEvent({
          id: "user-empty",
          title: "用戶空欄",
          source: "user",
          origin: "manual",
          startTime: "2025-01-15T09:00:00",
          endTime: "2025-01-15T10:00:00",
          location: null,
          body: "",
        }),
      ];
      const container = render(
        makeProps({
          timeScale: "day",
          rangeStart: new Date(2025, 0, 15),
          rangeEvents: events,
        }),
      );

      const card = container.querySelector('[data-testid="timeline-day-event-card"]');
      expect(card).toBeTruthy();
      expect(
        container.querySelector('[data-testid="timeline-day-event-location"]')?.textContent,
      ).toContain("地點：N/A");
      expect(
        container.querySelector('[data-testid="timeline-day-event-notes"]')?.textContent,
      ).toContain("說明：N/A");
    });
  });

  describe("item remind projection styling", () => {
    it("month preview keeps remind emoji marker and prefixed title", () => {
      const remind = makeEvent({
        id: "item:milk:remind",
        title: "提醒 · milk",
        source: "item_remind",
        itemDateKind: "remind",
        isAllDay: true,
        startTime: "2025-01-05T00:00:00",
        endTime: "2025-01-05T23:59:59",
      });
      const monthCursor = new Date(2025, 0, 1);
      const container = render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays: buildCalendarDays(monthCursor),
          monthEvents: [remind],
          timeCursor: new Date(2025, 0, 5),
        }),
      );

      expect(
        container.querySelector('[data-testid="month-item-marker-remind"]')?.textContent,
      ).toBe("🔔");
      expect(container.textContent).toContain("提醒 · milk");
    });
  });

  describe("important marker — single leading glyph", () => {
    /** Remind stays in month titled preview; important ❗ replaces kind glyph. */
    const importantPreviewItem = makeEvent({
      id: "item-important-preview",
      title: "提醒 · milk",
      source: "item_remind",
      itemDateKind: "remind",
      important: true,
      startTime: "2025-01-15T00:00:00",
      endTime: "2025-01-15T23:59:59",
    });
    const importantItem = makeEvent({
      id: "item-important",
      title: "milk",
      source: "item_remind",
      itemDateKind: "remind",
      important: true,
      startTime: "2025-01-15T00:00:00",
      endTime: "2025-01-15T23:59:59",
    });

    it("month preview shows ❗ without item-kind emoji", () => {
      const monthCursor = new Date(2025, 0, 1);
      const container = render(
        makeProps({
          timeScale: "month",
          monthCursor,
          monthDays: buildCalendarDays(monthCursor),
          monthEvents: [importantPreviewItem],
          timeCursor: new Date(2025, 0, 15),
        }),
      );

      expect(container.querySelector('[data-testid="month-important-marker"]')?.textContent).toBe(
        "❗",
      );
      expect(container.querySelector('[data-testid="month-item-marker-remind"]')).toBeNull();
      expect(container.textContent).toContain("提醒 · milk");
      expect(container.textContent).not.toContain("🔔");
    });

    it("week chip shows ❗ without item-kind emoji", () => {
      const timeCursor = new Date(2025, 0, 15);
      const container = render(
        makeProps({
          timeScale: "week",
          weekDays: buildWeekDays(timeCursor),
          timeCursor,
          rangeEvents: [importantItem],
        }),
      );

      const chip = container.querySelector('[data-testid="timeline-week-event-chip"]');
      expect(chip?.querySelector('[data-testid="week-important-marker"]')?.textContent).toBe("❗");
      expect(chip?.querySelector('[data-testid="week-item-kind-marker"]')).toBeNull();
      expect(chip?.textContent).toContain("milk");
      expect(chip?.textContent).not.toContain("🔔");
    });

    it("day card shows ❗ without item-kind emoji", () => {
      const container = render(
        makeProps({
          timeScale: "day",
          rangeStart: new Date(2025, 0, 15),
          rangeEvents: [importantItem],
        }),
      );

      const card = container.querySelector('[data-testid="timeline-day-event-card"]');
      expect(card?.querySelector('[data-testid="day-important-marker"]')?.textContent).toBe("❗");
      expect(card?.querySelector('[data-testid="day-item-kind-marker"]')).toBeNull();
      expect(card?.textContent).toContain("milk");
      expect(card?.textContent).not.toContain("🔔");
    });
  });

  describe("week / day phase tags and remind badge", () => {
    it("week chip shows remind badge; ending tag comes from recurring final", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 15, 12, 0, 0));
      const timeCursor = new Date(2025, 0, 15);
      const remind = makeEvent({
        id: "item-remind",
        title: "提醒 · milk",
        source: "item_remind",
        itemDateKind: "remind",
        startTime: "2025-01-15T00:00:00",
        endTime: "2025-01-15T23:59:59",
      });
      const last = makeEvent({
        id: "rec:last",
        title: "最後一次週會",
        source: "recurring",
        isLastOccurrence: true,
        startTime: "2025-01-15T09:00:00",
        endTime: "2025-01-15T10:00:00",
      });
      const container = render(
        makeProps({
          timeScale: "week",
          weekDays: buildWeekDays(timeCursor),
          timeCursor,
          rangeEvents: [remind, last],
        }),
      );

      expect(
        container.querySelector('[data-testid="timeline-remind-badge"]')?.textContent,
      ).toBe("提醒");
      expect(
        container.querySelector(
          '[data-testid="timeline-event-day-phase-ending-today"]',
        )?.textContent,
      ).toBe("結束於本日");
      expect(container.textContent).not.toContain("提醒 · milk");
      expect(container.textContent).toContain("milk");
      expect(container.textContent).toContain("最後一次週會");
      vi.useRealTimers();
    });

    it("day card shows 跨日进行中 / ending tag and remind badge", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 15, 12, 0, 0));
      const covering = makeEvent({
        id: "cover",
        title: "Conference Week",
        startTime: "2025-01-13T09:00:00",
        endTime: "2025-01-17T18:00:00",
      });
      const ending = makeEvent({
        id: "overnight",
        title: "Overnight",
        startTime: "2025-01-14T20:00:00",
        endTime: "2025-01-15T08:00:00",
      });
      const userRemind = makeEvent({
        id: "user-remind",
        title: "提醒會議",
        source: "user",
        origin: "manual",
        remindBeforeDays: 1,
        startTime: "2025-01-15T10:00:00",
        endTime: "2025-01-15T11:00:00",
      });
      const container = render(
        makeProps({
          timeScale: "day",
          rangeStart: new Date(2025, 0, 15),
          rangeEvents: [covering, ending, userRemind],
        }),
      );

      expect(
        container.querySelector(
          '[data-testid="timeline-event-day-phase-ongoing-multi-day"]',
        )?.textContent,
      ).toBe("跨日進行中");
      expect(
        container.querySelector(
          '[data-testid="timeline-event-day-phase-ending-today"]',
        )?.textContent,
      ).toBe("結束於本日");
      expect(
        container.querySelector('[data-testid="timeline-remind-badge"]')?.textContent,
      ).toBe("提醒");
      vi.useRealTimers();
    });
  });

});
