import { useCallback, useEffect, useState } from "react";

import { listRecurringSeries } from "../../../api/recurringSeries";
import { listUserEventsPage, type UserEvent } from "../../../api/userEvents";
import { findActiveLinkedExpiryEvent } from "../../../domain/items/linkedCalendarQuickCreate";
import {
  countActiveLinkedExpiryEvents,
  mergeLinkedCalendarRows,
  type LinkedCalendarRow,
} from "../../../domain/items/linkedCalendarRows";

type Options = {
  itemId: string | null;
  refreshKey?: number;
  onActiveExpiryChange?: (event: UserEvent | null) => void;
};

export type LinkedCalendarRowsState = {
  rows: LinkedCalendarRow[];
  activeExpiry: UserEvent | null;
  /** Active ``kind=expires`` count (for Primary badge when > 1). */
  expiresCount: number;
  loading: boolean;
  loadError: boolean;
  createLocked: boolean;
};

/** Loads + merges one-off / recurring calendars linked to an inventory item. */
export function useLinkedCalendarRows({
  itemId,
  refreshKey = 0,
  onActiveExpiryChange,
}: Options): LinkedCalendarRowsState {
  const createLocked = itemId == null;
  const [rows, setRows] = useState<LinkedCalendarRow[]>([]);
  const [activeExpiry, setActiveExpiry] = useState<UserEvent | null>(null);
  const [expiresCount, setExpiresCount] = useState(0);
  const [loading, setLoading] = useState(!createLocked);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    if (!itemId) {
      setRows([]);
      setActiveExpiry(null);
      setExpiresCount(0);
      setLoading(false);
      setLoadError(false);
      onActiveExpiryChange?.(null);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const [events, recurring] = await Promise.all([
        listUserEventsPage({ itemId }).then((page) => page.items),
        listRecurringSeries({ itemId }),
      ]);
      const expiryEvent = findActiveLinkedExpiryEvent(events);
      setRows(mergeLinkedCalendarRows(events, recurring.items));
      setActiveExpiry(expiryEvent);
      setExpiresCount(countActiveLinkedExpiryEvents(events));
      onActiveExpiryChange?.(expiryEvent);
    } catch {
      setRows([]);
      setActiveExpiry(null);
      setExpiresCount(0);
      setLoadError(true);
      onActiveExpiryChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [itemId, onActiveExpiryChange]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return {
    rows,
    activeExpiry,
    expiresCount,
    loading,
    loadError,
    createLocked,
  };
}
