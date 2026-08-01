import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type {
  TimelineEventStatus,
  TimelineEventStatusMap,
  TimelineEventTimeOverrideMap,
} from "../../domain/timeline/status";
import {
  hydrateTimelineAnnotations,
  saveTimelineAnnotations,
} from "./timelineAnnotationsStore";

const ANNOTATIONS_SAVE_DEBOUNCE_MS = 400;

export type UseTimelineAnnotationsReturn = {
  eventStatuses: TimelineEventStatusMap;
  eventTimeOverrides: TimelineEventTimeOverrideMap;
  setEventStatuses: Dispatch<SetStateAction<TimelineEventStatusMap>>;
  setEventTimeOverrides: Dispatch<SetStateAction<TimelineEventTimeOverrideMap>>;
  setEventStatus: (eventId: string, status: TimelineEventStatus) => void;
  annotationsReady: boolean;
};

/**
 * Client annotation maps (status + time overrides) backed by ui-prefs SQLite.
 * Soft-dismiss stays on the dismissals API — never conflate the two.
 */
export function useTimelineAnnotations(): UseTimelineAnnotationsReturn {
  const [eventStatuses, setEventStatuses] = useState<TimelineEventStatusMap>({});
  const [eventTimeOverrides, setEventTimeOverrides] = useState<TimelineEventTimeOverrideMap>({});
  const [annotationsReady, setAnnotationsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hydrateTimelineAnnotations().then((data) => {
      if (cancelled) return;
      setEventStatuses(data.eventStatuses);
      setEventTimeOverrides(data.eventTimeOverrides);
      setAnnotationsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!annotationsReady) return;
    const timer = window.setTimeout(() => {
      void saveTimelineAnnotations({ eventStatuses, eventTimeOverrides });
    }, ANNOTATIONS_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [annotationsReady, eventStatuses, eventTimeOverrides]);

  const setEventStatus = useCallback(
    (eventId: string, status: TimelineEventStatus) => {
      setEventStatuses((current) => ({ ...current, [eventId]: status }));
    },
    [],
  );

  return {
    eventStatuses,
    eventTimeOverrides,
    setEventStatuses,
    setEventTimeOverrides,
    setEventStatus,
    annotationsReady,
  };
}
