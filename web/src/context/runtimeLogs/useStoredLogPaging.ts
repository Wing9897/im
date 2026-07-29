import { useCallback, useMemo } from "react";

import type { AppLogCursorPayload } from "../../types";
import { toError } from "../../utils/errors";
import { createSerializedAsyncRunner } from "../../utils/serializedAsyncRunner";
import { type AppLogEntry, mergeLogs, toAppLogEntry } from "../appRuntimeShared";
import { loadStoredLogPageWithRetry } from "./runtimeLogPersistence";

/**
 * Stable refs and setters shared with useRuntimeLogState. Every field except
 * `logsLoading` / `hasMoreLogs` has a stable identity across renders, so the
 * serialized refresh runner survives re-renders.
 */
interface StoredLogPagingContext {
  mountedRef: React.MutableRefObject<boolean>;
  clearVersionRef: React.MutableRefObject<number>;
  persistedMutationVersionRef: React.MutableRefObject<number>;
  hasLoadedOnceRef: React.MutableRefObject<boolean>;
  hasLoadedAdditionalPagesRef: React.MutableRefObject<boolean>;
  nextCursorRef: React.MutableRefObject<AppLogCursorPayload | null>;
  loadMoreInFlightRef: React.MutableRefObject<boolean>;
  setStoredLogs: React.Dispatch<React.SetStateAction<AppLogEntry[]>>;
  setTotalStoredLogCount: React.Dispatch<React.SetStateAction<number>>;
  setHasMoreLogs: React.Dispatch<React.SetStateAction<boolean>>;
  setLogsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLogsLoadingMore: React.Dispatch<React.SetStateAction<boolean>>;
  setLogLoadError: React.Dispatch<React.SetStateAction<string | null>>;
  warnNonFatal: (key: string, message: string, error: unknown) => void;
  logsLoading: boolean;
  hasMoreLogs: boolean;
}

/**
 * Remote paging for stored logs: serialized refresh/reset of the first page
 * plus cursor-based load-more. Extracted from useRuntimeLogState so the state
 * hook focuses on log CRUD and derived counts.
 */
export function useStoredLogPaging(ctx: StoredLogPagingContext) {
  const {
    mountedRef,
    clearVersionRef,
    persistedMutationVersionRef,
    hasLoadedOnceRef,
    hasLoadedAdditionalPagesRef,
    nextCursorRef,
    loadMoreInFlightRef,
    setStoredLogs,
    setTotalStoredLogCount,
    setHasMoreLogs,
    setLogsLoading,
    setLogsLoadingMore,
    setLogLoadError,
    warnNonFatal,
    logsLoading,
    hasMoreLogs,
  } = ctx;

  const { run: refreshRunner } = useMemo(
    () =>
      createSerializedAsyncRunner<[boolean]>(
        async (resetPagination = false) => {
          const requestedClearVersion = clearVersionRef.current;
          const requestedPersistedMutationVersion =
            persistedMutationVersionRef.current;
          if (
            mountedRef.current &&
            (!hasLoadedOnceRef.current || resetPagination)
          ) {
            setLogsLoading(true);
          }
          if (mountedRef.current) {
            setLogLoadError(null);
          }
          try {
            const page = await loadStoredLogPageWithRetry(null);
            if (
              !mountedRef.current ||
              requestedClearVersion !== clearVersionRef.current
            ) {
              return;
            }

            const incomingStoredLogs = (page.logs ?? []).map(toAppLogEntry);
            const hasNewerPersistedLogs =
              requestedPersistedMutationVersion !==
              persistedMutationVersionRef.current;
            setTotalStoredLogCount(page.totalCount);
            setLogLoadError(null);

            if (resetPagination && !hasNewerPersistedLogs) {
              hasLoadedAdditionalPagesRef.current = false;
              nextCursorRef.current = page.nextCursor;
              setHasMoreLogs(page.hasMore);
              setStoredLogs(incomingStoredLogs);
            } else {
              if (!hasLoadedAdditionalPagesRef.current) {
                nextCursorRef.current = page.nextCursor;
                setHasMoreLogs(page.hasMore);
              }
              setStoredLogs((prev) => mergeLogs(prev, incomingStoredLogs));
            }
          } catch (error) {
            if (mountedRef.current) {
              setLogLoadError(toError(error).message);
            }
            warnNonFatal(
              "refresh_stored_logs",
              "failed to refresh stored logs",
              error,
            );
          } finally {
            if (
              mountedRef.current &&
              requestedClearVersion === clearVersionRef.current
            ) {
              hasLoadedOnceRef.current = true;
              setLogsLoading(false);
            }
          }
        },
        (current, next) => [Boolean(current?.[0] || next[0])],
      ),
    [
      clearVersionRef,
      hasLoadedAdditionalPagesRef,
      hasLoadedOnceRef,
      mountedRef,
      nextCursorRef,
      persistedMutationVersionRef,
      setHasMoreLogs,
      setLogLoadError,
      setLogsLoading,
      setStoredLogs,
      setTotalStoredLogCount,
      warnNonFatal,
    ],
  );

  const refreshStoredLogs = useCallback(
    () => refreshRunner(false),
    [refreshRunner],
  );

  const resetStoredLogs = useCallback(
    () => refreshRunner(true),
    [refreshRunner],
  );

  const loadMoreStoredLogs = useCallback(async () => {
    const requestedClearVersion = clearVersionRef.current;
    const cursor = nextCursorRef.current;
    if (
      loadMoreInFlightRef.current ||
      logsLoading ||
      !hasMoreLogs ||
      cursor === null
    ) {
      return;
    }

    loadMoreInFlightRef.current = true;
    if (mountedRef.current) {
      setLogsLoadingMore(true);
      setLogLoadError(null);
    }

    try {
      const page = await loadStoredLogPageWithRetry(cursor);
      if (
        !mountedRef.current ||
        requestedClearVersion !== clearVersionRef.current
      ) {
        return;
      }

      hasLoadedAdditionalPagesRef.current = true;
      nextCursorRef.current = page.nextCursor;
      setHasMoreLogs(page.hasMore);
      setTotalStoredLogCount(page.totalCount);
      setStoredLogs((prev) => mergeLogs(prev, (page.logs ?? []).map(toAppLogEntry)));
      setLogLoadError(null);
    } catch (error) {
      if (mountedRef.current) {
        setLogLoadError(toError(error).message);
      }
      warnNonFatal(
        "load_more_stored_logs",
        "failed to load more stored logs",
        error,
      );
    } finally {
      loadMoreInFlightRef.current = false;
      if (
        mountedRef.current &&
        requestedClearVersion === clearVersionRef.current
      ) {
        setLogsLoadingMore(false);
      }
    }
  }, [
    clearVersionRef,
    hasLoadedAdditionalPagesRef,
    hasMoreLogs,
    loadMoreInFlightRef,
    logsLoading,
    mountedRef,
    nextCursorRef,
    setHasMoreLogs,
    setLogLoadError,
    setLogsLoadingMore,
    setStoredLogs,
    setTotalStoredLogCount,
    warnNonFatal,
  ]);

  return { refreshStoredLogs, resetStoredLogs, loadMoreStoredLogs };
}
