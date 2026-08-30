/**
 * Load + poll the published-calendar list. Card mutations stay on the page.
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchCalendarSharePublishList,
  type CalendarSharePublishListItem,
} from "../../api/calendarShare";
import { listWorksets, type Workset } from "../../api/worksets";
import { useOptionalTaskCatalog } from "../../context/TaskCatalogContext";
import { isCalendarShareNotFound } from "../../domain/calendarShare/subscribedCalendars";
import { AUTO_SYNC_INTERVAL_FLOOR_SECONDS } from "../../domain/calendarShare/autoSyncPresets";
import { isListedPublish, type CalendarSharePublishResult } from "../../domain/calendarShare/publishWorkset";
import { toErrorMessage } from "../../utils/errors";

function applyListed(items: CalendarSharePublishListItem[]): CalendarSharePublishListItem[] {
  return items.filter(isListedPublish);
}

function applyAutoSyncFields(
  value: {
    autoSync?: boolean | null;
    autoSyncIntervalSeconds?: number | null;
    autoSyncIntervalFloorSeconds?: number | null;
  },
  setAutoSync: (next: boolean) => void,
  setAutoSyncIntervalSeconds: (next: number) => void,
  setAutoSyncIntervalFloorSeconds: (next: number) => void,
) {
  setAutoSync(value.autoSync ?? true);
  setAutoSyncIntervalSeconds(value.autoSyncIntervalSeconds ?? AUTO_SYNC_INTERVAL_FLOOR_SECONDS);
  setAutoSyncIntervalFloorSeconds(
    value.autoSyncIntervalFloorSeconds ?? AUTO_SYNC_INTERVAL_FLOOR_SECONDS,
  );
}

/** Quiet refetch while autosync may clear pendingSync. Stay under publishList 5/10s. */
export const PUBLISHED_PENDING_SYNC_POLL_MS = 15_000;

export function useSubscriptionsPublishedList() {
  const catalog = useOptionalTaskCatalog();
  const catalogMounted = catalog != null;
  const [items, setItems] = useState<CalendarSharePublishListItem[]>([]);
  const [fallbackWorksets, setFallbackWorksets] = useState<Workset[]>([]);
  const [listReady, setListReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [autoSyncIntervalSeconds, setAutoSyncIntervalSeconds] = useState(
    AUTO_SYNC_INTERVAL_FLOOR_SECONDS,
  );
  const [autoSyncIntervalFloorSeconds, setAutoSyncIntervalFloorSeconds] = useState(
    AUTO_SYNC_INTERVAL_FLOOR_SECONDS,
  );

  const worksets = catalogMounted ? catalog.worksets : fallbackWorksets;

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    const quiet = Boolean(opts?.quiet);

    if (catalogMounted) {
      try {
        const value = await fetchCalendarSharePublishList();
        setItems(applyListed(value.items ?? []));
        applyAutoSyncFields(
          value,
          setAutoSync,
          setAutoSyncIntervalSeconds,
          setAutoSyncIntervalFloorSeconds,
        );
        setLoadError(null);
      } catch (reason) {
        if (isCalendarShareNotFound(reason)) {
          setItems([]);
          setLoadError(null);
        } else if (quiet) {
          return;
        } else {
          setLoadError(toErrorMessage(reason));
        }
      }
      setListReady(true);
      return;
    }

    const [publishResult, worksetResult] = await Promise.allSettled([
      fetchCalendarSharePublishList(),
      listWorksets(),
    ]);
    if (publishResult.status === "fulfilled") {
      setItems(applyListed(publishResult.value.items ?? []));
      applyAutoSyncFields(
        publishResult.value,
        setAutoSync,
        setAutoSyncIntervalSeconds,
        setAutoSyncIntervalFloorSeconds,
      );
    } else if (isCalendarShareNotFound(publishResult.reason)) {
      setItems([]);
    } else if (quiet) {
      if (worksetResult.status === "fulfilled") {
        setFallbackWorksets(worksetResult.value);
      }
      return;
    }
    if (worksetResult.status === "fulfilled") {
      setFallbackWorksets(worksetResult.value);
    } else if (isCalendarShareNotFound(worksetResult.reason)) {
      setFallbackWorksets([]);
    } else if (quiet) {
      if (publishResult.status === "fulfilled") setLoadError(null);
      return;
    }
    const failure: unknown =
      (publishResult.status === "rejected" && !isCalendarShareNotFound(publishResult.reason)
        ? publishResult.reason
        : null) ??
      (worksetResult.status === "rejected" && !isCalendarShareNotFound(worksetResult.reason)
        ? worksetResult.reason
        : null);
    setLoadError(failure ? toErrorMessage(failure) : null);
    setListReady(true);
  }, [catalogMounted]);

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
    autoSync,
    setAutoSync,
    autoSyncIntervalSeconds,
    setAutoSyncIntervalSeconds,
    autoSyncIntervalFloorSeconds,
  };
}
