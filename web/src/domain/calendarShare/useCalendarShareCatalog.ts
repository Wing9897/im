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
import {
  consumeCalendarShareRateLimit,
} from "./calendarShareRateLimit";
import { toError, toErrorMessage } from "../../utils/errors";
import {
  calendarShareKey,
  isCalendarShareNotFound,
  isCalendarShareUnreachable,
} from "./subscribedCalendars";

export {
  subscribeCalendarIdentity,
  subscribeFilterCalendarsFromCatalog,
  type SubscribeCalendarIdentity,
} from "./subscribedCalendars";
import { pruneSubscribedDismissals } from "./subscribedDismissals";

export type CalendarShareCatalog = {
  session: CalendarShareSession | null;
  items: CalendarShareSubscription[];
  ownHandle: string;
  loading: boolean;
  error: string | null;
  unreachable: boolean;
};

const EMPTY: CalendarShareCatalog = {
  session: null,
  items: [],
  ownHandle: "",
  loading: true,
  error: null,
  unreachable: false,
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

function getCalendarShareCatalogSnapshot(): CalendarShareCatalog {
  return snapshot;
}

export function refreshCalendarShareCatalog(): Promise<void> {
  if (inFlight) return inFlight;
  try {
    consumeCalendarShareRateLimit("catalog");
  } catch (error) {
    snapshot = { ...snapshot, loading: false, error: toErrorMessage(error) };
    emit();
    return Promise.reject(toError(error));
  }
  const myEpoch = ++epoch;
  if (!completed) {
    snapshot = { ...snapshot, loading: true };
    emit();
  }
  const pending = (async () => {
    try {
      const session = await fetchCalendarShareSession();
      if (myEpoch !== epoch) return;
      if (!session.connected) {
        snapshot = {
          session,
          items: [],
          ownHandle: session.handle ?? "",
          loading: false,
          error: null,
          unreachable: false,
        };
        completed = true;
        return;
      }
      try {
        const payload = await fetchCalendarShareSubscriptions();
        if (myEpoch !== epoch) return;
        const previousKeys = snapshot.items.map((row) => calendarShareKey(row.handle, row.slug));
        snapshot = {
          session,
          items: payload.items ?? [],
          ownHandle: payload.ownHandle ?? session.handle ?? "",
          loading: false,
          error: null,
          unreachable: false,
        };
        completed = true;
        if (previousKeys.length > 0) {
          pruneSubscribedDismissals((payload.items ?? []).map((row) => calendarShareKey(row.handle, row.slug)));
        }
      } catch (error) {
        if (myEpoch !== epoch) return;
        if (isCalendarShareNotFound(error)) {
          snapshot = {
            session,
            items: [],
            ownHandle: snapshot.ownHandle || session.handle || "",
            loading: false,
            error: null,
            unreachable: false,
          };
          completed = true;
          return;
        }
        snapshot = {
          session,
          items: snapshot.items,
          ownHandle: snapshot.ownHandle || session.handle || "",
          loading: false,
          error: toErrorMessage(error),
          unreachable: isCalendarShareUnreachable(error),
        };
        completed = true;
      }
    } catch (error) {
      if (myEpoch !== epoch) return;
      snapshot = {
        ...snapshot,
        loading: false,
        error: toErrorMessage(error),
        unreachable: isCalendarShareUnreachable(error),
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
export function invalidateCalendarShareCatalog(): Promise<void> {
  inFlight = null;
  return refreshCalendarShareCatalog();
}

/** Apply POST/DELETE subscription mutation body without a follow-up catalog GET. */
export function applyCalendarShareCatalogItems(
  items: CalendarShareSubscription[],
  ownHandle?: string,
): void {
  const previousKeys = snapshot.items.map((row) => calendarShareKey(row.handle, row.slug));
  snapshot = {
    ...snapshot,
    items,
    ownHandle: ownHandle ?? snapshot.ownHandle,
    loading: false,
    error: null,
    unreachable: false,
  };
  completed = true;
  if (previousKeys.length > 0) {
    pruneSubscribedDismissals(items.map((row) => calendarShareKey(row.handle, row.slug)));
  }
  emit();
}

/** Test-only: clear cache, in-flight, and listeners. Production builds drop the body. */
export function resetCalendarShareCatalogForTests(): void {
  snapshot = { ...EMPTY };
  inFlight = null;
  epoch = 0;
  completed = false;
  listeners.clear();
}

export type CalendarShareCatalogHook = CalendarShareCatalog & {
  refresh: () => Promise<void>;
  invalidate: () => Promise<void>;
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
