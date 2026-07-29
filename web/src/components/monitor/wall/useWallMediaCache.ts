import { useCallback, useEffect, useRef } from "react";

/** Page-level LRU object URL cache for Telegram media blobs. */
export function useWallMediaCache(maxEntries = 30) {
  const cacheRef = useRef(new Map<string, string>());

  const get = useCallback((messageId: string) => {
    const cache = cacheRef.current;
    const objectUrl = cache.get(messageId);
    if (objectUrl) {
      cache.delete(messageId);
      cache.set(messageId, objectUrl);
    }
    return objectUrl;
  }, []);

  const put = useCallback(
    (messageId: string, objectUrl: string) => {
      const cache = cacheRef.current;
      const existing = cache.get(messageId);
      if (existing) {
        URL.revokeObjectURL(objectUrl);
        return existing;
      }
      cache.set(messageId, objectUrl);
      while (cache.size > maxEntries) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey) break;
        const staleUrl = cache.get(oldestKey);
        if (staleUrl) URL.revokeObjectURL(staleUrl);
        cache.delete(oldestKey);
      }
      return objectUrl;
    },
    [maxEntries],
  );

  const revokeExcept = useCallback((retainedIds: ReadonlySet<string>) => {
    const cache = cacheRef.current;
    for (const [messageId, objectUrl] of cache.entries()) {
      if (!retainedIds.has(messageId)) {
        URL.revokeObjectURL(objectUrl);
        cache.delete(messageId);
      }
    }
  }, []);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const objectUrl of cache.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      cache.clear();
    };
  }, []);

  return { get, put, revokeExcept };
}
