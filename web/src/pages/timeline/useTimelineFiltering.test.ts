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
});
