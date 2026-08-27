/**
 * Load + poll the published-calendar list. Card mutations stay on the page.
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchCalendarSharePublishList,
  type CalendarSharePublishListItem,
} from "../../api/calendarShare";
import { listWorksets, type Workset } from "../../api/worksets";
import { isCalendarShareNotFound } from "../../domain/calendarShare/subscribedCalendars";
import { isListedPublish, type CalendarSharePublishResult } from "../../domain/calendarShare/publishWorkset";
import { toErrorMessage } from "../../utils/errors";

function applyListed(items: CalendarSharePublishListItem[]): CalendarSharePublishListItem[] {
  return items.filter(isListedPublish);
}

/** Quiet refetch while autosync may clear pendingSync. Stay under publishList 5/10s. */
export const PUBLISHED_PENDING_SYNC_POLL_MS = 15_000;

export function useSubscriptionsPublishedList() {
  const [items, setItems] = useState<CalendarSharePublishListItem[]>([]);
  const [worksets, setWorksets] = useState<Workset[]>([]);
  const [listReady, setListReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    const quiet = Boolean(opts?.quiet);
    const [publishResult, worksetResult] = await Promise.allSettled([
      fetchCalendarSharePublishList(),
      listWorksets(),
    ]);
    if (publishResult.status === "fulfilled") {
      setItems(applyListed(publishResult.value.items ?? []));
    } else if (isCalendarShareNotFound(publishResult.reason)) {
      setItems([]);
    } else if (quiet) {
      if (worksetResult.status === "fulfilled") {
        setWorksets(worksetResult.value);
      }
      return;
    }
    if (worksetResult.status === "fulfilled") {
      setWorksets(worksetResult.value);
    } else if (isCalendarShareNotFound(worksetResult.reason)) {
      setWorksets([]);
    } else if (quiet) {
      if (publishResult.status === "fulfilled") setLoadError(null);
      return;
    }
    const failure =
      (publishResult.status === "rejected" && !isCalendarShareNotFound(publishResult.reason)
        ? publishResult.reason
        : null) ??
      (worksetResult.status === "rejected" && !isCalendarShareNotFound(worksetResult.reason)
        ? worksetResult.reason
        : null);
    setLoadError(failure ? toErrorMessage(failure) : null);
    setListReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingSync = items.some((row) => row.pendingSync);
  useEffect(() => {
    if (!pendingSync) return;
    const id = window.setInterval(() => {
      void load({ quiet: true });
    }, PUBLISHED_PENDING_SYNC_POLL_MS);
    return () => window.clearInterval(id);
  }, [load, pendingSync]);

  const onPublishSaved = (result: CalendarSharePublishResult) => {
    if (result.items.length > 0) {
      setItems(applyListed(result.items));
      setLoadError(null);
      return;
    }
    void load();
  };

  return {
    items,
    setItems,
    worksets,
    listReady,
    loadError,
    setLoadError,
    load,
    onPublishSaved,
  };
}
