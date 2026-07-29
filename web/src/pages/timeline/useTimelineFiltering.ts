import { useMemo } from "react";

import {
  addMonths,
  eventOverlapsRange,
  startOfMonth,
} from "../../domain/timeline/dateUtils";
import type { TimelineEventTimeOverrideMap } from "../../domain/timeline/status";
import type { TimelineItem } from "../../types";
import { computeSidebarEvents } from "./timelinePageUtils";
import {
  partitionDismissed,
  sortActiveThenDismissed,
} from "./timelineDismissUtils";

interface UseTimelineFilteringOptions {
  events: TimelineItem[];
  eventTimeOverrides: TimelineEventTimeOverrideMap;
  rangeStart: Date;
  rangeEnd: Date;
  monthCursor: Date;
  /** When false, soft-dismissed events are excluded from timeline views. Product default is true. */
  showDismissed: boolean;
  focusedDay: Date | null;
}

interface UseTimelineFilteringReturn {
  effectiveEvents: TimelineItem[];
  eventLookup: Map<string, TimelineItem>;
  rawEventLookup: Map<string, TimelineItem>;
  filteredEvents: TimelineItem[];
  visibleEvents: TimelineItem[];
  monthEvents: TimelineItem[];
  rangeEvents: TimelineItem[];
  sidebarEvents: TimelineItem[];
  activeEvents: TimelineItem[];
  dismissedEvents: TimelineItem[];
}

/**
 * Timeline visible-event derivation (task multi-select is applied upstream in data fetch).
 *
 * INVARIANTS:
 * - When `showDismissed` is false, strip `event.dismissed` before calendar/gantt.
 *   Product default is on (`im:timeline:show-dismissed` → true).
 * - Client annotations (`eventStatuses`) are separate from soft-dismiss visibility.
 * - Do not replace dismiss partitioning with a single `.filter(!dismissed)` used
 *   everywhere (month preview / showDismissed / prefer-active semantics differ).
 */
export function useTimelineFiltering({
  events,
  eventTimeOverrides,
  rangeStart,
  rangeEnd,
  monthCursor,
  showDismissed,
  focusedDay,
}: UseTimelineFilteringOptions): UseTimelineFilteringReturn {
  const effectiveEvents = useMemo(
    () =>
      events.map((event) => {
        const override = eventTimeOverrides[event.id];
        if (!override) return event;
        return { ...event, startTime: override.startTime, endTime: override.endTime };
      }),
    [eventTimeOverrides, events],
  );

  const eventLookup = useMemo(
    () => new Map(effectiveEvents.map((event) => [event.id, event])),
    [effectiveEvents],
  );

  const rawEventLookup = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events],
  );

  const filteredEvents = useMemo(() => {
    if (showDismissed) return effectiveEvents;
    return effectiveEvents.filter((event) => !event.dismissed);
  }, [effectiveEvents, showDismissed]);

  const visibleEvents = useMemo(
    () =>
      filteredEvents.filter((event) =>
        eventOverlapsRange(event, rangeStart, rangeEnd),
      ),
    [filteredEvents, rangeEnd, rangeStart],
  );

  const monthEvents = useMemo(
    () =>
      filteredEvents.filter((event) => {
        const start = new Date(event.startTime);
        return (
          start >= startOfMonth(monthCursor) &&
          start < addMonths(startOfMonth(monthCursor), 1)
        );
      }),
    [filteredEvents, monthCursor],
  );

  const rangeEvents = useMemo(
    () => sortActiveThenDismissed(visibleEvents),
    [visibleEvents],
  );

  const sidebarEvents = useMemo(
    () => computeSidebarEvents(focusedDay, rangeEvents),
    [focusedDay, rangeEvents],
  );

  const { activeEvents, dismissedEvents } = useMemo(
    () => partitionDismissed(filteredEvents),
    [filteredEvents],
  );

  return {
    effectiveEvents,
    eventLookup,
    rawEventLookup,
    filteredEvents,
    visibleEvents,
    monthEvents,
    rangeEvents,
    sidebarEvents,
    activeEvents,
    dismissedEvents,
  };
}
