import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startOfDay } from "../../domain/timeline/dateUtils";
import type {
  TimelineEventStatusMap,
  TimelineEventTimeOverrideMap,
} from "../../domain/timeline/status";
import { makeEvent } from "../../test/timelineTestHelpers";
import { useTimelineSelection } from "./useTimelineSelection";

type SelectionResult = ReturnType<typeof useTimelineSelection>;

function SelectionHarness({
  rangeStart,
  rangeEnd,
  onReady,
}: {
  rangeStart: Date;
  rangeEnd: Date;
  onReady: (value: {
    selection: SelectionResult;
    overrides: TimelineEventTimeOverrideMap;
    statuses: TimelineEventStatusMap;
  }) => void;
}) {
  const event = makeEvent({
    id: "evt-1",
    startTime: "2025-01-15T09:00:00Z",
    endTime: "2025-01-15T10:00:00Z",
  });
  const eventLookup = new Map([[event.id, event]]);
  const [eventStatuses, setEventStatuses] = useState<TimelineEventStatusMap>({});
  const [eventTimeOverrides, setEventTimeOverrides] = useState<TimelineEventTimeOverrideMap>({});
  const selection = useTimelineSelection({
    eventLookup,
    rawEventLookup: eventLookup,
    rangeStart,
    rangeEnd,
    setEventStatuses,
    setEventTimeOverrides,
  });
  onReady({ selection, overrides: eventTimeOverrides, statuses: eventStatuses });
  return null;
}

describe("useTimelineSelection", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: SelectionResult | null = null;
  let overrides: TimelineEventTimeOverrideMap = {};
  let statuses: TimelineEventStatusMap = {};

  const inRangeStart = startOfDay(new Date("2025-01-15T00:00:00Z"));
  const inRangeEnd = new Date(inRangeStart);
  inRangeEnd.setDate(inRangeEnd.getDate() + 1);

  const outRangeStart = startOfDay(new Date("2025-02-01T00:00:00Z"));
  const outRangeEnd = new Date(outRangeStart);
  outRangeEnd.setDate(outRangeEnd.getDate() + 1);

  beforeEach(() => {
    latest = null;
    overrides = {};
    statuses = {};
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function renderWithRange(rangeStart: Date, rangeEnd: Date) {
    await act(async () => {
      root.render(
        createElement(SelectionHarness, {
          rangeStart,
          rangeEnd,
          onReady: (value) => {
            latest = value.selection;
            overrides = value.overrides;
            statuses = value.statuses;
          },
        }),
      );
      await Promise.resolve();
    });
  }

  it("populates edit fields when an event is selected", async () => {
    await renderWithRange(inRangeStart, inRangeEnd);
    const event = makeEvent({ id: "evt-1" });

    act(() => {
      latest!.setSelectedEvent(event);
    });

    expect(latest!.editStartTime).toContain("2025");
    expect(latest!.editEndTime).toContain("2025");
  });

  it("clears selection when the visible range no longer overlaps", async () => {
    await renderWithRange(inRangeStart, inRangeEnd);
    const event = makeEvent({ id: "evt-1" });

    act(() => {
      latest!.setSelectedEvent(event);
    });

    await act(async () => {
      root.render(
        createElement(SelectionHarness, {
          rangeStart: outRangeStart,
          rangeEnd: outRangeEnd,
          onReady: (value) => {
            latest = value.selection;
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest!.selectedEvent).toBeNull();
  });

  it("setEventStatus stores per-event status overrides", async () => {
    await renderWithRange(inRangeStart, inRangeEnd);

    act(() => {
      latest!.setEventStatus("evt-1", "confirmed");
    });

    expect(statuses["evt-1"]).toBe("confirmed");
  });

  it("resetTimeOverride clears a stored override and restores the raw event", async () => {
    const rawEvent = makeEvent({
      id: "evt-1",
      startTime: "2025-01-15T09:00:00Z",
      endTime: "2025-01-15T10:00:00Z",
    });
    const effectiveEvent = makeEvent({
      id: "evt-1",
      startTime: "2025-01-15T14:00:00.000Z",
      endTime: "2025-01-15T15:00:00.000Z",
    });

    function OverrideHarness({
      onReady,
    }: {
      onReady: (value: {
        selection: SelectionResult;
        overrides: TimelineEventTimeOverrideMap;
      }) => void;
    }) {
      const eventLookup = new Map([[effectiveEvent.id, effectiveEvent]]);
      const rawLookup = new Map([[rawEvent.id, rawEvent]]);
      const [eventStatuses, setEventStatuses] = useState<TimelineEventStatusMap>({});
      const [eventTimeOverrides, setEventTimeOverrides] = useState<TimelineEventTimeOverrideMap>({
        "evt-1": {
          startTime: "2025-01-15T14:00:00.000Z",
          endTime: "2025-01-15T15:00:00.000Z",
        },
      });
      const selection = useTimelineSelection({
        eventLookup,
        rawEventLookup: rawLookup,
        rangeStart: inRangeStart,
        rangeEnd: inRangeEnd,
        setEventStatuses,
        setEventTimeOverrides,
      });
      onReady({ selection, overrides: eventTimeOverrides });
      return null;
    }

    await act(async () => {
      root.render(createElement(OverrideHarness, {
        onReady: (value) => {
          latest = value.selection;
          overrides = value.overrides;
        },
      }));
      await Promise.resolve();
    });

    act(() => {
      latest!.setSelectedEvent(effectiveEvent);
    });

    await act(async () => {
      latest!.resetTimeOverride();
      await Promise.resolve();
    });

    expect(overrides["evt-1"]).toBeUndefined();
    // eventLookup still carries overridden times until the parent recomputes it
    expect(latest!.selectedEvent?.startTime).toBe("2025-01-15T14:00:00.000Z");
  });
});
