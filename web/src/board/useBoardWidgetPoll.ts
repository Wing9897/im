import { useCallback, useEffect, useRef, useState } from "react";
import { useMonitorMode } from "../context/MonitorModeContext";
import { subscribeBoardPoll } from "./boardPollBus";

/**
 * Board widget poll intervals.
 * Queue widget does not use this — it reads shared AppRuntime `queueStatus`
 * (`QUEUE_STATUS_REFRESH_INTERVAL_MS`). `queue` remains for tests / legacy.
 */
export const BOARD_POLL_MS = {
  queue: 15_000,
  standard: 45_000,
} as const;

interface UseBoardWidgetPollResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Re-run the fetcher immediately (also used by error retry). */
  refresh: () => void;
}

interface UseBoardWidgetPollOptions {
  /**
   * Extra gate (default true). BoardCanvas sets `active=false` when the
   * widget is obscured by maximize so heavy widgets pause fetching too.
   */
  active?: boolean;
}

/**
 * Shared board-widget fetch + interval poll.
 *
 * INVARIANTS:
 * - Poll only while `monitorMode === "canvas"` (+ optional `active`). BoardRoot
 *   is keep-mounted under pages — unconditional polling hammers APIs.
 * - Interval ticks share a per-`intervalMs` poll bus (one timer, N subscribers).
 * - Do not import `pages/` hooks into board widgets (architecture boundary).
 * Regression fences: `useBoardWidgetPoll.test.tsx`.
 */
export function useBoardWidgetPoll<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  options: UseBoardWidgetPollOptions = {},
): UseBoardWidgetPollResult<T> {
  const { monitorMode } = useMonitorMode();
  const active = options.active !== false;
  const enabled = monitorMode === "canvas" && active;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const load = () => {
      void fetcherRef
        .current()
        .then((next) => {
          if (cancelled) {
            return;
          }
          setData(next);
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) {
            return;
          }
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        });
    };

    load();
    const unsubscribe = subscribeBoardPoll(intervalMs, load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled, intervalMs, tick]);

  // When leaving canvas, keep last data but mark idle (no in-flight UI flash).
  useEffect(() => {
    if (!enabled && data === null) {
      setLoading(false);
    }
  }, [data, enabled]);

  return { data, error, loading: enabled && loading && data === null, refresh };
}
