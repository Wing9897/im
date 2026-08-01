import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTimelineItem } from "../../test/analysisEventFixtures";
import {
  classifyEventTimePhase,
  groupEventsByTimePhase,
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
});
