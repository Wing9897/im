import { useEffect, useRef, useState } from "react";

const DEFAULT_TIMEOUT_MS = 30_000;

/** Tracks initial-load timeout while the timeline has no cached events. */
export function useTimelineLoadTimeout(
  initialLoading: boolean,
  hasEvents: boolean,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialLoading && !hasEvents) {
      setTimedOut(false);
      timeoutRef.current = setTimeout(() => setTimedOut(true), timeoutMs);
    } else {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setTimedOut(false);
    }

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [initialLoading, hasEvents, timeoutMs]);

  const resetTimeout = () => setTimedOut(false);

  return { timedOut, resetTimeout };
}
