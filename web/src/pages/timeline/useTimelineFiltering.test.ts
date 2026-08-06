import { describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import type { TimelineItem } from "../../types";
import { useTimelineFiltering } from "./useTimelineFiltering";

function makeEvent(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: "e1",
    title: "Alpha meeting",
    body: "discuss roadmap",
    startTime: "2026-07-15T10:00:00.000Z",
    endTime: "2026-07-15T11:00:00.000Z",
    location: "TW Office",
    participants: ["Alice"],
    taskId: "task-1",
    taskName: "Ops",
    dismissed: false,
    ...overrides,
  };
}

function renderHook(props: Parameters<typeof useTimelineFiltering>[0]) {
  let latest: ReturnType<typeof useTimelineFiltering> | null = null;
  function Probe() {
    latest = useTimelineFiltering(props);
    return null;
  }
  const host = document.createElement("div");
  act(() => {
    createRoot(host).render(createElement(Probe));
  });
  return () => latest!;
}

describe("useTimelineFiltering", () => {
  const rangeStart = new Date("2026-07-01T00:00:00.000Z");
  const rangeEnd = new Date("2026-08-01T00:00:00.000Z");
  const monthCursor = new Date("2026-07-01T00:00:00.000Z");

  it("includes dismissed by default and hides them when showDismissed is off", () => {
    const events = [
      makeEvent({ id: "a", title: "Active" }),
      makeEvent({ id: "d", title: "Gone", dismissed: true }),
    ];

    const getOn = renderHook({
      events,
      eventTimeOverrides: {},
      rangeStart,
      rangeEnd,
      monthCursor,
      showDismissed: true,
      focusedDay: null,
    });
    expect(getOn().filteredEvents.map((e) => e.id).sort()).toEqual(["a", "d"]);

    const getOff = renderHook({
      events,
      eventTimeOverrides: {},
      rangeStart,
      rangeEnd,
      monthCursor,
      showDismissed: false,
      focusedDay: null,
    });
    expect(getOff().filteredEvents.map((e) => e.id)).toEqual(["a"]);
  });

  it("keeps annotation time overrides independent from soft-dismiss visibility", () => {
    const rawStart = "2026-07-15T10:00:00.000Z";
    const overriddenStart = "2026-07-20T08:00:00.000Z";
    const getResult = renderHook({
      events: [makeEvent({ id: "d", dismissed: true, startTime: rawStart })],
      eventTimeOverrides: {
        d: { startTime: overriddenStart, endTime: null },
      },
      rangeStart,
      rangeEnd,
      monthCursor,
      showDismissed: false,
      focusedDay: null,
    });

    const result = getResult();
    expect(result.rawEventLookup.get("d")?.startTime).toBe(rawStart);
    expect(result.eventLookup.get("d")?.startTime).toBe(overriddenStart);
    expect(result.eventLookup.get("d")?.dismissed).toBe(true);
    expect(result.filteredEvents).toEqual([]);
  });

  it("monthEvents includes prior-month starts that overlap the navigated month grid", () => {
    // Viewing September while today may be August: overnight that starts Aug 31
    // and ends Sept 1 must still be in monthEvents for「+N 结束」chips.
    const septemberCursor = new Date(2026, 8, 1);
    const septemberRangeStart = new Date(2026, 8, 1);
    const septemberRangeEnd = new Date(2026, 9, 1);
    const crossMonthOvernight = makeEvent({
      id: "cross-month-end",
      title: "月末跨月",
      startTime: "2026-08-31T20:00:00",
      endTime: "2026-09-01T02:00:00",
    });
    const multiDayIntoSept = makeEvent({
      id: "multi-into-sept",
      title: "跨月行程",
      startTime: "2026-08-30T09:00:00",
      endTime: "2026-09-03T18:00:00",
    });
    const augustOnly = makeEvent({
      id: "aug-only",
      title: "八月会议",
      startTime: "2026-08-15T10:00:00",
      endTime: "2026-08-15T11:00:00",
    });
    const septemberStart = makeEvent({
      id: "sept-start",
      title: "九月会议",
      startTime: "2026-09-10T10:00:00",
      endTime: "2026-09-10T11:00:00",
    });

    const getResult = renderHook({
      events: [crossMonthOvernight, multiDayIntoSept, augustOnly, septemberStart],
      eventTimeOverrides: {},
      rangeStart: septemberRangeStart,
      rangeEnd: septemberRangeEnd,
      monthCursor: septemberCursor,
      showDismissed: true,
      focusedDay: null,
    });

    const ids = getResult().monthEvents.map((e) => e.id).sort();
    expect(ids).toEqual(["cross-month-end", "multi-into-sept", "sept-start"]);
    expect(ids).not.toContain("aug-only");
  });
});
