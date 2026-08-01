import { useCallback, useEffect, useRef, useState } from "react";

import { loadGanttActivitySpans } from "../../domain/gantt/activitySpans";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import i18n from "../../i18n";
import type { TaskActivitySpan } from "../../types";

const EMPTY_SPANS: TaskActivitySpan[] = [];

/** Timeout duration for fetching task activity spans (ms). */
const SPANS_FETCH_TIMEOUT_MS = 10_000;

interface UseGanttDataOptions {
  /** Span fetching only triggers in "gantt" mode. */
  viewMode: "calendar" | "gantt";
}

/**
 * Gantt-view data: task activity spans (with a fetch timeout).
 * Timed schedule events reuse the primary timeline fetch in useTimelineData.
 * Shares `loadGanttActivitySpans` with Board Gantt widgets.
 */
export function useGanttData({ viewMode }: UseGanttDataOptions) {
  const spansFetcher = useCallback(() => loadGanttActivitySpans(), []);
  const {
    data: taskSpansData,
    initialLoading: spansInitialLoadingRaw,
    isRefreshing: spansIsRefreshingRaw,
    error: spansRawError,
    execute: executeSpansFetch,
  } = useAsyncResource(spansFetcher, { toastOnError: false });

  const [spansTimedOut, setSpansTimedOut] = useState(false);
  const spansTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSpans = useCallback(async () => {
    setSpansTimedOut(false);

    if (spansTimeoutRef.current !== null) {
      clearTimeout(spansTimeoutRef.current);
      spansTimeoutRef.current = null;
    }

    spansTimeoutRef.current = setTimeout(() => {
      setSpansTimedOut(true);
    }, SPANS_FETCH_TIMEOUT_MS);

    const result = await executeSpansFetch(undefined);

    if (spansTimeoutRef.current !== null) {
      clearTimeout(spansTimeoutRef.current);
      spansTimeoutRef.current = null;
    }

    return result;
  }, [executeSpansFetch]);

  useEffect(() => {
    return () => {
      if (spansTimeoutRef.current !== null) {
        clearTimeout(spansTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (viewMode === "gantt") {
      void fetchSpans();
    }
  }, [viewMode, fetchSpans]);

  const spansInitialLoading = spansInitialLoadingRaw && !spansTimedOut;
  const spansIsRefreshing = spansIsRefreshingRaw && !spansTimedOut;
  const spansError = spansTimedOut
    ? String(i18n.t("timeline:messages.ganttLoadTimeout"))
    : spansRawError;

  const taskSpans = taskSpansData ?? EMPTY_SPANS;

  return {
    taskSpans,
    spansInitialLoading,
    spansIsRefreshing,
    spansError,
    fetchSpans,
  };
}
