import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { appendAppLog, clearAppLogs } from "../../api/logs";
import i18n from "../../i18n";
import { logWarn } from "../../utils/logger";
import type { AppLogCursorPayload } from "../../types";
import { toErrorMessage } from "../../utils/errors";
import {
  type AppLogEntry,
  type AppLogInput,
  MAX_LOG_ENTRIES,
  NON_FATAL_WARN_WINDOW_MS,
  makeLogId,
  mergeLogs,
  toAppLogEntry,
} from "../appRuntimeShared";
import {
  readCachedStoredLogs,
  toLogCursor,
  writeCachedStoredLogs,
} from "./runtimeLogPersistence";
import type { RuntimeLogsState } from "./runtimeLogsTypes";
import { useStoredLogPaging } from "./useStoredLogPaging";

/**
 * Core state management hook for runtime logs.
 * Manages stored/local log state and CRUD; remote paging lives in
 * useStoredLogPaging.
 */
export function useRuntimeLogState(): RuntimeLogsState {
  const [storedLogs, setStoredLogs] = useState<AppLogEntry[]>(() =>
    readCachedStoredLogs(),
  );
  const [localLogs, setLocalLogs] = useState<AppLogEntry[]>([]);
  const [totalStoredLogCount, setTotalStoredLogCount] = useState(
    storedLogs.length,
  );
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  const [logLoadError, setLogLoadError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const hasLoadedOnceRef = useRef(false);
  const hasLoadedAdditionalPagesRef = useRef(false);
  const nonFatalWarnedAtRef = useRef<Record<string, number>>({});
  const clearVersionRef = useRef(0);
  const persistedMutationVersionRef = useRef(0);
  const initialCursorEntry =
    storedLogs.length > 0 ? storedLogs[storedLogs.length - 1] : null;
  const nextCursorRef = useRef<AppLogCursorPayload | null>(
    toLogCursor(initialCursorEntry),
  );
  const loadMoreInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    writeCachedStoredLogs(storedLogs);
  }, [storedLogs]);

  const warnNonFatal = useCallback(
    (key: string, message: string, error: unknown) => {
      const now = Date.now();
      const last = nonFatalWarnedAtRef.current[key] ?? 0;
      if (now - last < NON_FATAL_WARN_WINDOW_MS) {
        return;
      }
      nonFatalWarnedAtRef.current[key] = now;
      logWarn(`[runtime] ${message}`, error);
    },
    [],
  );

  const addLog = useCallback(
    (entry: AppLogInput) => {
      const requestedClearVersion = clearVersionRef.current;
      const persistLog = async () => {
        try {
          const created = await appendAppLog({
            level: entry.level,
            category: entry.category,
            message: entry.message,
            details: entry.details ?? null,
          });
          if (
            !mountedRef.current ||
            requestedClearVersion !== clearVersionRef.current
          ) {
            return;
          }
          persistedMutationVersionRef.current += 1;
          setStoredLogs((prev) => mergeLogs(prev, [toAppLogEntry(created)]));
        } catch (error) {
          warnNonFatal("append_app_log", "failed to persist app log", error);
          if (
            !mountedRef.current ||
            requestedClearVersion !== clearVersionRef.current
          ) {
            return;
          }
          setLocalLogs((prev) =>
            mergeLogs(prev, [
              {
                id: makeLogId(),
                time: new Date().toISOString(),
                ...entry,
              },
            ]),
          );
        }
      };
      void persistLog();
    },
    [warnNonFatal],
  );

  const clearLogs = useCallback(() => {
    clearVersionRef.current += 1;
    hasLoadedAdditionalPagesRef.current = false;
    nextCursorRef.current = null;
    loadMoreInFlightRef.current = false;
    setStoredLogs([]);
    setLocalLogs([]);
    setTotalStoredLogCount(0);
    setHasMoreLogs(false);
    setLogsLoading(false);
    setLogsLoadingMore(false);
    setLogLoadError(null);
    void clearAppLogs().catch((error) => {
      warnNonFatal("clear_app_logs", "failed to clear app logs", error);
      if (!mountedRef.current) {
        return;
      }
      setLogLoadError(
        String(
          i18n.t("logs:page.clearFailed", { error: toErrorMessage(error) }),
        ),
      );
    });
  }, [warnNonFatal]);

  const { refreshStoredLogs, resetStoredLogs, loadMoreStoredLogs } =
    useStoredLogPaging({
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
    });

  useEffect(() => {
    void resetStoredLogs();
  }, [resetStoredLogs]);

  const logs = useMemo(
    () => mergeLogs(storedLogs, localLogs),
    [localLogs, storedLogs],
  );
  const totalLogCount = useMemo(() => {
    const storedIds = new Set(storedLogs.map((entry) => entry.id));
    const localOnlyCount = localLogs.reduce(
      (count, entry) => count + (storedIds.has(entry.id) ? 0 : 1),
      0,
    );
    return Math.min(
      MAX_LOG_ENTRIES,
      Math.max(logs.length, totalStoredLogCount + localOnlyCount),
    );
  }, [localLogs, logs.length, storedLogs, totalStoredLogCount]);

  return {
    logs,
    totalLogCount,
    hasMoreLogs,
    logsLoading,
    logsLoadingMore,
    logLoadError,
    addLog,
    clearLogs,
    refreshStoredLogs,
    resetStoredLogs,
    loadMoreStoredLogs,
    warnNonFatal,
  };
}
