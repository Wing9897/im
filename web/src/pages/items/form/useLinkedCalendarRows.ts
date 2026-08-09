import { useCallback, useEffect, useMemo, useState } from "react";

import { listTasks } from "../../../api/tasks";
import { listUserEvents, type UserEvent } from "../../../api/userEvents";
import {
  deriveLinkedExpiryPreview,
  mergeLinkedCalendarRows,
  resolveActiveLinkedExpiry,
  type LinkedCalendarRow,
} from "../../../domain/items/linkedCalendarRows";
import type { ItemCardExpiry } from "../../../domain/items/itemCardExpiry";

type Options = {
  itemId: string | null;
  itemExpiresAt?: string | null;
  remindBeforeDays?: number | null;
  refreshKey?: number;
  onActiveExpiryChange?: (event: UserEvent | null) => void;
};

export type LinkedCalendarRowsState = {
  rows: LinkedCalendarRow[];
  activeExpiry: UserEvent | null;
  expiryPreview: ItemCardExpiry;
  loading: boolean;
  loadError: boolean;
  createLocked: boolean;
  hasLinkedExpiry: boolean;
};

/** Loads + merges one-off / recurring calendars linked to an inventory item. */
export function useLinkedCalendarRows({
  itemId,
  itemExpiresAt = null,
  remindBeforeDays = null,
  refreshKey = 0,
  onActiveExpiryChange,
}: Options): LinkedCalendarRowsState {
  const createLocked = itemId == null;
  const [rows, setRows] = useState<LinkedCalendarRow[]>([]);
  const [activeExpiry, setActiveExpiry] = useState<UserEvent | null>(null);
  const [loading, setLoading] = useState(!createLocked);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    if (!itemId) {
      setRows([]);
      setActiveExpiry(null);
      setLoading(false);
      setLoadError(false);
      onActiveExpiryChange?.(null);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const [events, recurring] = await Promise.all([
        listUserEvents({ itemId }),
        listTasks({ itemId, analysisMode: "recurring" }),
      ]);
      const expiryEvent = resolveActiveLinkedExpiry(events);
      setRows(mergeLinkedCalendarRows(events, recurring, expiryEvent));
      setActiveExpiry(expiryEvent);
      onActiveExpiryChange?.(expiryEvent);
    } catch {
      setRows([]);
      setActiveExpiry(null);
      setLoadError(true);
      onActiveExpiryChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [itemId, onActiveExpiryChange]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const expiryPreview = useMemo(
    () => deriveLinkedExpiryPreview(activeExpiry, itemExpiresAt, remindBeforeDays),
    [activeExpiry, itemExpiresAt, remindBeforeDays],
  );

  return {
    rows,
    activeExpiry,
    expiryPreview,
    loading,
    loadError,
    createLocked,
    hasLinkedExpiry: activeExpiry != null,
  };
}
