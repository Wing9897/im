/**
 * Module-level calendar-share session + subscription catalog.
 * Timeline, Mine, and Search share one snapshot so add/remove can invalidate
 * the Timeline filter without remounting the page.
 */

import { useEffect, useSyncExternalStore } from "react";

import {
  fetchCalendarShareSession,
  fetchCalendarShareSubscriptions,
  type CalendarShareSession,
  type CalendarShareSubscription,
} from "../../api/calendarShare";
import { toErrorMessage } from "../../utils/errors";
import { calendarShareKey } from "./subscribedCalendars";
import { pruneSubscribedDismissals } from "./subscribedDismissals";

export type CalendarShareCatalog = {
  session: CalendarShareSession | null;
  items: CalendarShareSubscription[];
  ownHandle: string;
  loading: boolean;
  error: string | null;
};

const EMPTY: CalendarShareCatalog = {
  session: null,
  items: [],
  ownHandle: "",
  loading: true,
  error: null,
};

let snapshot: CalendarShareCatalog = { ...EMPTY };
let inFlight: Promise<void> | null = null;
let epoch = 0;
let completed = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCalendarShareCatalogSnapshot(): CalendarShareCatalog {
  return snapshot;
}

export function refreshCalendarShareCatalog(): Promise<void> {
  if (inFlight) return inFlight;
  const myEpoch = ++epoch;
  if (!completed) {
    snapshot = { ...snapshot, loading: true };
    emit();
  }
  const pending = (async () => {
    try {
      const [session, payload] = await Promise.all([
        fetchCalendarShareSession(),
        fetchCalendarShareSubscriptions(),
      ]);
      if (myEpoch !== epoch) return;
      const previousKeys = snapshot.items.map((row) => calendarShareKey(row.handle, row.slug));
      snapshot = {
        session,
        items: payload.items,
        ownHandle: payload.ownHandle ?? "",
        loading: false,
        error: null,
      };
      completed = true;
      if (previousKeys.length > 0) {
        pruneSubscribedDismissals(payload.items.map((row) => calendarShareKey(row.handle, row.slug)));
      }
    } catch (error) {
      if (myEpoch !== epoch) return;
      snapshot = {
        ...snapshot,
        loading: false,
        error: toErrorMessage(error),
      };
      completed = true;
    } finally {
      if (myEpoch === epoch) {
        inFlight = null;
        emit();
      }
    }
  })();
  inFlight = pending;
  return pending;
}

/** Drop in-flight work and refetch so mounted Timeline filters pick up catalog edits. */
export function invalidateCalendarShareCatalog(): void {
  inFlight = null;
  void refreshCalendarShareCatalog();
}

/** Test-only: clear cache, in-flight, and listeners. */
export function resetCalendarShareCatalogForTests(): void {
  snapshot = { ...EMPTY };
  inFlight = null;
  epoch = 0;
  completed = false;
  listeners.clear();
}

export type CalendarShareCatalogHook = CalendarShareCatalog & {
  refresh: () => Promise<void>;
  invalidate: () => void;
};

export function useCalendarShareCatalog(): CalendarShareCatalogHook {
  const catalog = useSyncExternalStore(
    subscribeCatalog,
    getCalendarShareCatalogSnapshot,
    getCalendarShareCatalogSnapshot,
  );

  useEffect(() => {
    if (!completed && !inFlight) {
      void refreshCalendarShareCatalog();
    }
  }, []);

  return {
    ...catalog,
    refresh: refreshCalendarShareCatalog,
    invalidate: invalidateCalendarShareCatalog,
  };
}
