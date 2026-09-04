import { describe, expect, it } from "vitest";

import { makeTimelineItem } from "../../test/analysisEventFixtures";
import { computeSidebarEvents, eventOverlapsLocalDay, resolveSidebarFocusForWindow } from "./timelinePageUtils";

describe("eventOverlapsLocalDay", () => {
  it("includes overnight timed spans on the end day", () => {
    const event = makeTimelineItem({
      startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
    });
    expect(eventOverlapsLocalDay(event, new Date(2026, 7, 8))).toBe(true);
    expect(eventOverlapsLocalDay(event, new Date(2026, 7, 7))).toBe(true);
    expect(eventOverlapsLocalDay(event, new Date(2026, 7, 9))).toBe(false);
  });

  it("excludes exclusive-midnight all-day from the end calendar day", () => {
    const event = makeTimelineItem({
      startTime: "2026-08-07T00:00:00Z",
      endTime: "2026-08-08T00:00:00Z",
      isAllDay: true,
    });
    expect(eventOverlapsLocalDay(event, new Date(2026, 7, 7))).toBe(true);
    expect(eventOverlapsLocalDay(event, new Date(2026, 7, 8))).toBe(false);
  });

  it("matches point events on their start day only", () => {
    const event = makeTimelineItem({
      startTime: new Date(2026, 7, 8, 12, 0, 0).toISOString(),
      endTime: null,
    });
    expect(eventOverlapsLocalDay(event, new Date(2026, 7, 8))).toBe(true);
    expect(eventOverlapsLocalDay(event, new Date(2026, 7, 7))).toBe(false);
  });
});

describe("computeSidebarEvents", () => {
  it("defaults to today when no day is focused", () => {
    const today = makeTimelineItem({
      id: "today",
      startTime: new Date(2026, 7, 8, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 11, 0, 0).toISOString(),
    });
    const other = makeTimelineItem({
      id: "other",
      startTime: new Date(2026, 7, 9, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 9, 11, 0, 0).toISOString(),
    });
    const result = computeSidebarEvents(null, [today, other], new Date(2026, 7, 8, 12, 0, 0));
    expect(result.map((e) => e.id)).toEqual(["today"]);
  });

  it("filters to events intersecting the focused local day", () => {
    const onDay = makeTimelineItem({
      id: "on",
      startTime: new Date(2026, 7, 8, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 11, 0, 0).toISOString(),
    });
    const overnight = makeTimelineItem({
      id: "overnight",
      startTime: new Date(2026, 7, 7, 8, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 8, 8, 0, 0).toISOString(),
    });
    const other = makeTimelineItem({
      id: "other",
      startTime: new Date(2026, 7, 9, 10, 0, 0).toISOString(),
      endTime: new Date(2026, 7, 9, 11, 0, 0).toISOString(),
    });
    const result = computeSidebarEvents(new Date(2026, 7, 8), [
      onDay,
      overnight,
      other,
    ]);
    expect(result.map((e) => e.id)).toEqual(["on", "overnight"]);
  });
});

describe("resolveSidebarFocusForWindow", () => {
  it("keeps focusedDay when it still overlaps the visible window", () => {
    const focused = new Date(2026, 6, 15);
    const result = resolveSidebarFocusForWindow(
      focused,
      new Date(2026, 6, 9),
      new Date(2026, 6, 23),
    );
    expect(result.outOfView).toBe(false);
    expect(result.day.getDate()).toBe(15);
  });

  it("follows the window center when focusedDay is off-screen", () => {
    const result = resolveSidebarFocusForWindow(
      new Date(2026, 7, 4),
      new Date(2026, 6, 9),
      new Date(2026, 6, 23),
    );
    expect(result.outOfView).toBe(true);
    expect(result.day.getMonth()).toBe(6);
    expect(result.day.getDate()).toBe(16);
  });
});
