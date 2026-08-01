import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTimelineItem } from "../../test/analysisEventFixtures";
import {
  classifyEventTimePhase,
  dayPhaseAnchor,
  groupEventsByDayTimePhase,
  groupEventsByTimePhase,
  isCrossDayEvent,
} from "./eventTimePhase";

describe("eventTimePhase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Local noon on 2026-07-15
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("classifyEventTimePhase (timed)", () => {
    it("marks future events as upcoming", () => {
      const event = makeTimelineItem({
        startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
        endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
      });
      expect(classifyEventTimePhase(event)).toBe("upcoming");
    });

    it("marks events spanning now as ongoing", () => {
      const event = makeTimelineItem({
        startTime: new Date(2026, 6, 15, 10, 0, 0).toISOString(),
        endTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      });
      expect(classifyEventTimePhase(event)).toBe("ongoing");
    });

    it("marks past events as ended", () => {
      const event = makeTimelineItem({
        startTime: new Date(2026, 6, 15, 8, 0, 0).toISOString(),
        endTime: new Date(2026, 6, 15, 9, 0, 0).toISOString(),
      });
      expect(classifyEventTimePhase(event)).toBe("ended");
    });

    it("treats point events (no end) as ended once start has passed", () => {
      const event = makeTimelineItem({
        startTime: new Date(2026, 6, 15, 11, 0, 0).toISOString(),
        endTime: null,
      });
      expect(classifyEventTimePhase(event)).toBe("ended");
    });

    it("treats point events before start as upcoming", () => {
      const event = makeTimelineItem({
        startTime: new Date(2026, 6, 15, 13, 0, 0).toISOString(),
        endTime: null,
      });
      expect(classifyEventTimePhase(event)).toBe("upcoming");
    });
  });

  describe("classifyEventTimePhase (all-day)", () => {
    it("is ongoing for an all-day event on today (exclusive midnight end)", () => {
      const event = makeTimelineItem({
        startTime: "2026-07-15T00:00:00Z",
        endTime: "2026-07-16T00:00:00Z",
        isAllDay: true,
      });
      expect(classifyEventTimePhase(event)).toBe("ongoing");
    });

    it("is ended when the all-day date has passed", () => {
      const event = makeTimelineItem({
        startTime: "2026-07-14T00:00:00Z",
        endTime: "2026-07-15T00:00:00Z",
        isAllDay: true,
      });
      expect(classifyEventTimePhase(event)).toBe("ended");
    });

    it("is upcoming before the all-day start date", () => {
      const event = makeTimelineItem({
        startTime: "2026-07-16T00:00:00Z",
        endTime: "2026-07-17T00:00:00Z",
        isAllDay: true,
      });
      expect(classifyEventTimePhase(event)).toBe("upcoming");
    });

    it("is ongoing across multi-day all-day spans including today", () => {
      const event = makeTimelineItem({
        startTime: "2026-07-14T00:00:00Z",
        endTime: "2026-07-17T00:00:00Z",
        isAllDay: true,
      });
      expect(classifyEventTimePhase(event)).toBe("ongoing");
    });
  });

  describe("groupEventsByTimePhase", () => {
    it("partitions while preserving relative order", () => {
      const upcomingA = makeTimelineItem({
        id: "u-a",
        title: "Upcoming A",
        startTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
        endTime: new Date(2026, 6, 15, 15, 0, 0).toISOString(),
      });
      const ended = makeTimelineItem({
        id: "e",
        title: "Ended",
        startTime: new Date(2026, 6, 15, 8, 0, 0).toISOString(),
        endTime: new Date(2026, 6, 15, 9, 0, 0).toISOString(),
      });
      const ongoing = makeTimelineItem({
        id: "o",
        title: "Ongoing",
        startTime: new Date(2026, 6, 15, 10, 0, 0).toISOString(),
        endTime: new Date(2026, 6, 15, 14, 0, 0).toISOString(),
      });
      const upcomingB = makeTimelineItem({
        id: "u-b",
        title: "Upcoming B",
        startTime: new Date(2026, 6, 15, 16, 0, 0).toISOString(),
        endTime: new Date(2026, 6, 15, 17, 0, 0).toISOString(),
      });

      const groups = groupEventsByTimePhase([
        upcomingA,
        ended,
        ongoing,
        upcomingB,
      ]);
      expect(groups.upcoming.map((e) => e.id)).toEqual(["u-a", "u-b"]);
      expect(groups.ongoing.map((e) => e.id)).toEqual(["o"]);
      expect(groups.ended.map((e) => e.id)).toEqual(["e"]);
    });
  });

  describe("dayPhaseAnchor", () => {
    it("uses now when focused day is today", () => {
      const now = new Date(2026, 6, 15, 12, 0, 0);
      expect(dayPhaseAnchor(new Date(2026, 6, 15), now)).toEqual(now);
    });

    it("uses local midnight for a future focused day", () => {
      const now = new Date(2026, 6, 1, 12, 0, 0);
      expect(dayPhaseAnchor(new Date(2026, 6, 8), now)).toEqual(
        new Date(2026, 6, 8, 0, 0, 0),
      );
    });

    it("uses end-of-day for a past focused day", () => {
      const now = new Date(2026, 6, 20, 12, 0, 0);
      expect(dayPhaseAnchor(new Date(2026, 6, 8), now).getTime()).toBe(
        new Date(2026, 6, 9, 0, 0, 0).getTime() - 1,
      );
    });
  });

  describe("groupEventsByDayTimePhase", () => {
    it("puts overnight ending on the focused day into endingSpan, not upcoming/ongoing", () => {
      // Aligns with month-cell「+N 完結」— started earlier, ends on focused day.
      vi.setSystemTime(new Date(2026, 7, 1, 12, 0, 0));
      const overnight = makeTimelineItem({
        id: "overnight",
        startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
        endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
      });
      const laterSameDay = makeTimelineItem({
        id: "later",
        startTime: new Date(2026, 7, 8, 14, 0, 0).toISOString(),
        endTime: new Date(2026, 7, 8, 15, 0, 0).toISOString(),
      });
      const groups = groupEventsByDayTimePhase(
        [overnight, laterSameDay],
        new Date(2026, 7, 8),
      );
      expect(groups.endingSpan.map((e) => e.id)).toEqual(["overnight"]);
      expect(groups.upcoming.map((e) => e.id)).toEqual(["later"]);
      expect(groups.ongoing).toEqual([]);
      expect(groups.covering).toEqual([]);
      expect(groups.ended).toEqual([]);
    });

    it("keeps overnight ending today in endingSpan even after wall-clock end", () => {
      vi.setSystemTime(new Date(2026, 7, 8, 12, 0, 0));
      const overnight = makeTimelineItem({
        id: "overnight",
        startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
        endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
      });
      const groups = groupEventsByDayTimePhase(
        [overnight],
        new Date(2026, 7, 8),
      );
      expect(groups.endingSpan.map((e) => e.id)).toEqual(["overnight"]);
      expect(groups.ended).toEqual([]);
    });

    it("puts multi-day middle coverage into covering (month-cell「+N 進行中」)", () => {
      vi.setSystemTime(new Date(2026, 7, 1, 12, 0, 0));
      const spanning = makeTimelineItem({
        id: "span",
        startTime: new Date(2026, 7, 6, 9, 0, 0).toISOString(),
        endTime: new Date(2026, 7, 10, 18, 0, 0).toISOString(),
      });
      const groups = groupEventsByDayTimePhase(
        [spanning],
        new Date(2026, 7, 8),
      );
      expect(groups.covering.map((e) => e.id)).toEqual(["span"]);
      expect(groups.endingSpan).toEqual([]);
      expect(groups.ongoing).toEqual([]);
    });

    it("keeps same-day timed events in day-anchor time phases", () => {
      vi.setSystemTime(new Date(2026, 7, 8, 12, 0, 0));
      const upcoming = makeTimelineItem({
        id: "up",
        startTime: new Date(2026, 7, 8, 14, 0, 0).toISOString(),
        endTime: new Date(2026, 7, 8, 15, 0, 0).toISOString(),
      });
      const ongoing = makeTimelineItem({
        id: "on",
        startTime: new Date(2026, 7, 8, 10, 0, 0).toISOString(),
        endTime: new Date(2026, 7, 8, 14, 0, 0).toISOString(),
      });
      const ended = makeTimelineItem({
        id: "en",
        startTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
        endTime: new Date(2026, 7, 8, 9, 0, 0).toISOString(),
      });
      const groups = groupEventsByDayTimePhase(
        [upcoming, ongoing, ended],
        new Date(2026, 7, 8),
      );
      expect(groups.upcoming.map((e) => e.id)).toEqual(["up"]);
      expect(groups.ongoing.map((e) => e.id)).toEqual(["on"]);
      expect(groups.ended.map((e) => e.id)).toEqual(["en"]);
      expect(groups.covering).toEqual([]);
      expect(groups.endingSpan).toEqual([]);
    });
  });

  describe("isCrossDayEvent", () => {
    it("detects timed overnight spans", () => {
      const event = makeTimelineItem({
        startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
        endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
      });
      expect(isCrossDayEvent(event)).toBe(true);
    });

    it("treats same-day timed events as not cross-day", () => {
      const event = makeTimelineItem({
        startTime: new Date(2026, 7, 8, 10, 0, 0).toISOString(),
        endTime: new Date(2026, 7, 8, 11, 0, 0).toISOString(),
      });
      expect(isCrossDayEvent(event)).toBe(false);
    });

    it("treats exclusive midnight all-day single day as not cross-day", () => {
      const event = makeTimelineItem({
        startTime: "2026-08-08T00:00:00Z",
        endTime: "2026-08-09T00:00:00Z",
        isAllDay: true,
      });
      expect(isCrossDayEvent(event)).toBe(false);
    });
  });
});
