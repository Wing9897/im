import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { startOfDay } from "../../domain/timeline/dateUtils";
import type { TimelineItem } from "../../types";
import { getOsTimeMs } from "../../utils/time";

type Args = {
  initialLoading: boolean;
  events: TimelineItem[];
  filteredEvents: TimelineItem[];
  goToDay: (day: Date) => void;
  setSelectedEvent: (event: TimelineItem | null) => void;
  openCreateDialog: (worksetId?: string | null) => void;
};

/** Handle /timeline?newEvent=1 and /timeline?eventId=…&at=… deep links. */
export function useTimelineDeepLinks({
  initialLoading,
  events,
  filteredEvents,
  goToDay,
  setSelectedEvent,
  openCreateDialog,
}: Args) {
  const [searchParams, setSearchParams] = useSearchParams();
  const createLinkHandled = useRef(false);
  const eventLinkHandled = useRef<string | null>(null);
  const eventDayJumped = useRef<string | null>(null);

  // Deep-link from workset detail: /timeline?newEvent=1&worksetId=…
  useEffect(() => {
    const wantsNew = searchParams.get("newEvent") === "1";
    if (!wantsNew) {
      createLinkHandled.current = false;
      return;
    }
    if (createLinkHandled.current) return;
    createLinkHandled.current = true;
    const wid = searchParams.get("worksetId")?.trim() || null;
    openCreateDialog(wid);
    const next = new URLSearchParams(searchParams);
    next.delete("newEvent");
    next.delete("worksetId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openCreateDialog]);

  // Deep-link from workset summary: /timeline?eventId=…&at=…
  useEffect(() => {
    const eventId = searchParams.get("eventId")?.trim();
    if (!eventId) {
      eventLinkHandled.current = null;
      eventDayJumped.current = null;
      return;
    }

    if (eventDayJumped.current !== eventId) {
      const atRaw = searchParams.get("at")?.trim();
      if (atRaw) {
        const atMs = getOsTimeMs(atRaw);
        if (Number.isFinite(atMs)) {
          goToDay(startOfDay(new Date(atMs)));
        }
      }
      eventDayJumped.current = eventId;
    }

    if (eventLinkHandled.current === eventId) return;
    if (initialLoading) return;

    const match =
      events.find((row) => row.id === eventId) ??
      filteredEvents.find((row) => row.id === eventId) ??
      null;

    eventLinkHandled.current = eventId;
    const next = new URLSearchParams(searchParams);
    next.delete("eventId");
    next.delete("at");
    setSearchParams(next, { replace: true });

    if (match) {
      setSelectedEvent(match);
    }
  }, [
    searchParams,
    setSearchParams,
    initialLoading,
    events,
    filteredEvents,
    goToDay,
    setSelectedEvent,
  ]);
}
