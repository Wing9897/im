import { useEffect, useMemo } from "react";

import {
  pruneSubscribedCalendarSelection,
  resolveSubscribeAvailability,
  type SubscribeAvailability,
  type SubscribedCalendarSelection,
} from "./subscribedCalendars";
import {
  subscribeFilterCalendarsFromCatalog,
  useCalendarShareCatalog,
  type CalendarShareCatalog,
} from "./useCalendarShareCatalog";
import { usePersistedSubscribeFilter } from "./usePersistedSubscribeFilter";

/** Timeline + board subscribe column: same catalog, keys, and availability. */
export function useSubscribeFilterState(eventsError?: unknown): {
  catalog: CalendarShareCatalog;
  subscribeCalendars: ReturnType<typeof subscribeFilterCalendarsFromCatalog>;
  subscribeCatalogKeys: string[];
  selectedSubscribeKeys: SubscribedCalendarSelection;
  setSelectedSubscribeKeys: ReturnType<typeof usePersistedSubscribeFilter>[1];
  subscribeAvailability: SubscribeAvailability;
} {
  const catalog = useCalendarShareCatalog();
  const subscribeCalendars = useMemo(
    () => subscribeFilterCalendarsFromCatalog(catalog.items),
    [catalog.items],
  );
  const subscribeCatalogKeys = useMemo(
    () => subscribeCalendars.map((row) => row.key),
    [subscribeCalendars],
  );
  const [selectedSubscribeKeys, setSelectedSubscribeKeys] = usePersistedSubscribeFilter();

  useEffect(() => {
    setSelectedSubscribeKeys((prev) => pruneSubscribedCalendarSelection(prev, subscribeCatalogKeys));
  }, [subscribeCatalogKeys, setSelectedSubscribeKeys]);

  const subscribeAvailability = resolveSubscribeAvailability({
    connected: catalog.session?.connected,
    catalogUnreachable: catalog.unreachable,
    eventsError: eventsError ?? catalog.error,
  });

  return {
    catalog,
    subscribeCalendars,
    subscribeCatalogKeys,
    selectedSubscribeKeys,
    setSelectedSubscribeKeys,
    subscribeAvailability,
  };
}
