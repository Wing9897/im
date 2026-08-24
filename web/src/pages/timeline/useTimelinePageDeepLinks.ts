import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { startOfDay } from "../../domain/timeline/dateUtils";
import { getOsTimeMs } from "../../utils/time";
import type { useTimelinePageContainer } from "./useTimelinePageContainer";
import type { useTimelinePageDialogs } from "./useTimelinePageDialogs";

type Container = ReturnType<typeof useTimelinePageContainer>;
type Dialogs = ReturnType<typeof useTimelinePageDialogs>;

type Args = {
  sources: Container["sources"];
  data: Container["data"];
  filters: Container["filters"];
  selection: Container["selection"];
  dialogs: Dialogs;
};

/** One-shot `/timeline?newEvent=` and `/timeline?eventId=` query handling. */
export function useTimelinePageDeepLinks({
  sources,
  data,
  filters,
  selection,
  dialogs,
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
    const itemId = searchParams.get("itemId")?.trim() || null;
    dialogs.openCreateDialog({ worksetId: wid, itemId });
    const next = new URLSearchParams(searchParams);
    next.delete("newEvent");
    next.delete("worksetId");
    next.delete("itemId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, dialogs]);

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
          sources.goToDay(startOfDay(new Date(atMs)));
        }
      }
      eventDayJumped.current = eventId;
    }

    if (eventLinkHandled.current === eventId) return;
    if (data.initialLoading) return;

    const match =
      data.events.find((row) => row.id === eventId) ??
      filters.filteredEvents.find((row) => row.id === eventId) ??
      null;

    eventLinkHandled.current = eventId;
    const next = new URLSearchParams(searchParams);
    next.delete("eventId");
    next.delete("at");
    setSearchParams(next, { replace: true });

    if (match) {
      selection.setSelectedEvent(match);
    }
  }, [
    searchParams,
    setSearchParams,
    data.initialLoading,
    data.events,
    filters.filteredEvents,
    sources,
    selection,
  ]);
}
