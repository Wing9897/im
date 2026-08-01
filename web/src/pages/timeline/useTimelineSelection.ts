import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";

import {
  eventOverlapsRange,
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from "../../domain/timeline/dateUtils";
import type {
  TimelineEventStatus,
  TimelineEventStatusMap,
  TimelineEventTimeOverrideMap,
} from "../../domain/timeline/status";
import type { TimelineItem } from "../../types";

interface UseTimelineSelectionOptions {
  eventLookup: Map<string, TimelineItem>;
  rawEventLookup: Map<string, TimelineItem>;
  rangeStart: Date;
  rangeEnd: Date;
  setEventStatuses: Dispatch<SetStateAction<TimelineEventStatusMap>>;
  setEventTimeOverrides: Dispatch<SetStateAction<TimelineEventTimeOverrideMap>>;
}

interface UseTimelineSelectionReturn {
  selectedEvent: TimelineItem | null;
  setSelectedEvent: (event: TimelineItem | null) => void;
  editStartTime: string;
  setEditStartTime: (value: string) => void;
  editEndTime: string;
  setEditEndTime: (value: string) => void;
  setEventStatus: (eventId: string, status: TimelineEventStatus) => void;
  saveTimeOverride: () => void;
  resetTimeOverride: () => void;
}

/**
 * Encapsulates event selection state and handlers:
 * - Selected event tracking with edit time fields
 * - Per-event status overrides (pending/confirmed/completed)
 * - Per-event time overrides (user-adjusted start/end times)
 * - Auto-deselect when selected event leaves visible range
 * - Auto-sync edit fields when event data refreshes
 */
export function useTimelineSelection({
  eventLookup,
  rawEventLookup,
  rangeStart,
  rangeEnd,
  setEventStatuses,
  setEventTimeOverrides,
}: UseTimelineSelectionOptions): UseTimelineSelectionReturn {
  const [selectedEvent, setSelectedEvent] = useState<TimelineItem | null>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  // Deselect when selected event leaves visible range
  useEffect(() => {
    if (!selectedEvent) return;
    if (!eventOverlapsRange(selectedEvent, rangeStart, rangeEnd)) {
      setSelectedEvent(null);
    }
  }, [rangeEnd, rangeStart, selectedEvent]);

  // Sync edit fields when event data refreshes
  useEffect(() => {
    if (!selectedEvent) {
      setEditStartTime("");
      setEditEndTime("");
      return;
    }
    const fresh = eventLookup.get(selectedEvent.id) ?? selectedEvent;
    if (
      fresh.startTime !== selectedEvent.startTime ||
      fresh.endTime !== selectedEvent.endTime
    ) {
      setSelectedEvent(fresh);
      return;
    }
    setEditStartTime(toDateTimeLocalInput(fresh.startTime));
    setEditEndTime(toDateTimeLocalInput(fresh.endTime));
  }, [eventLookup, selectedEvent]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const setEventStatus = useCallback(
    (eventId: string, status: TimelineEventStatus) => {
      setEventStatuses((current) => ({
        ...current,
        [eventId]: status,
      }));
    },
    [setEventStatuses],
  );

  const saveTimeOverride = useCallback(() => {
    if (!selectedEvent) return;
    const nextStart = fromDateTimeLocalInput(editStartTime);
    if (!nextStart) return;
    const nextEnd = editEndTime.trim()
      ? fromDateTimeLocalInput(editEndTime)
      : null;
    const original = rawEventLookup.get(selectedEvent.id);
    if (
      original &&
      original.startTime === nextStart &&
      (original.endTime ?? null) === nextEnd
    ) {
      setEventTimeOverrides((current) => {
        const next = { ...current };
        delete next[selectedEvent.id];
        return next;
      });
      setSelectedEvent({
        ...selectedEvent,
        startTime: original.startTime,
        endTime: original.endTime,
      });
      return;
    }
    setEventTimeOverrides((current) => ({
      ...current,
      [selectedEvent.id]: {
        startTime: nextStart,
        endTime: nextEnd,
      },
    }));
    setSelectedEvent({
      ...selectedEvent,
      startTime: nextStart,
      endTime: nextEnd,
    });
  }, [selectedEvent, editStartTime, editEndTime, rawEventLookup, setEventTimeOverrides]);

  const resetTimeOverride = useCallback(() => {
    if (!selectedEvent) return;
    const original = rawEventLookup.get(selectedEvent.id);
    setEventTimeOverrides((current) => {
      const next = { ...current };
      delete next[selectedEvent.id];
      return next;
    });
    if (original) {
      setSelectedEvent(original);
    }
  }, [selectedEvent, rawEventLookup, setEventTimeOverrides]);

  return {
    selectedEvent,
    setSelectedEvent,
    editStartTime,
    setEditStartTime,
    editEndTime,
    setEditEndTime,
    setEventStatus,
    saveTimeOverride,
    resetTimeOverride,
  };
}
