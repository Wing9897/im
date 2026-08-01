import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logWarn } from "../utils/logger";

const READ_IDS_LIMIT = 5000;

function appendReadIds(existingIds: string[], idsToAppend: string[]): string[] {
  const sanitizedIds = idsToAppend.filter((id) => id.trim().length > 0);
  if (sanitizedIds.length === 0) return existingIds;

  const appendSet = new Set(sanitizedIds);
  const merged = [
    ...existingIds.filter((id) => !appendSet.has(id)),
    ...sanitizedIds,
  ];
  return merged.slice(-READ_IDS_LIMIT);
}

function readStoredReadIds(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch (error) {
    logWarn(`[persisted-state] failed to read key "${storageKey}"`, error);
    return [];
  }
}

function readIdsChanged(initialIds: string[], nextIds: string[]): boolean {
  if (initialIds.length !== nextIds.length) return true;
  return nextIds.some((id, index) => id !== initialIds[index]);
}

export interface IdReadTracking {
  /** IDs persisted before this hook mounted. */
  readIdSet: Set<string>;
  /** Includes persisted IDs and IDs marked during this session. */
  isConsumed: (id: string) => boolean;
  /** Marks an ID consumed now and persists it when the hook unmounts. */
  markRead: (id: string) => void;
}

/**
 * Tracks locally read entity IDs under the supplied localStorage key.
 * Session changes are batched and persisted on unmount.
 */
export function useIdReadTracking(storageKey: string): IdReadTracking {
  const [storedReadIds] = useState<string[]>(() => readStoredReadIds(storageKey));
  const [sessionReadIds, setSessionReadIds] = useState<string[]>([]);
  const readIdSet = useMemo(() => new Set(storedReadIds), [storedReadIds]);
  const sessionReadIdSet = useMemo(() => new Set(sessionReadIds), [sessionReadIds]);
  const sessionReadIdsRef = useRef(sessionReadIds);
  const mountedStoredIdsRef = useRef(storedReadIds);

  useEffect(() => {
    sessionReadIdsRef.current = sessionReadIds;
  }, [sessionReadIds]);

  useEffect(() => {
    const mountedIds = mountedStoredIdsRef.current;
    return () => {
      const finalIds = appendReadIds(mountedIds, sessionReadIdsRef.current);
      if (!readIdsChanged(mountedIds, finalIds)) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(finalIds));
      } catch (error) {
        logWarn(`[persisted-state] failed to write key "${storageKey}"`, error);
      }
    };
  }, [storageKey]);

  const isConsumed = useCallback(
    (id: string) => readIdSet.has(id) || sessionReadIdSet.has(id),
    [readIdSet, sessionReadIdSet],
  );

  const markRead = useCallback(
    (id: string) => {
      setSessionReadIds((previousIds) => {
        if (previousIds.includes(id) || storedReadIds.includes(id)) return previousIds;
        return appendReadIds(previousIds, [id]);
      });
    },
    [storedReadIds],
  );

  return { readIdSet, isConsumed, markRead };
}
