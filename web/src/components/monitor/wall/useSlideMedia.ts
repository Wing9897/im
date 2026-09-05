import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "../../../hooks/useDebouncedCallback";

import { fetchMessageMediaBlob } from "../../../api/messages";
import type { Message } from "../../../types";
import { isVisualMediaKind } from "../../../domain/monitor/wall/wallModel";

const MEDIA_DEBOUNCE_MS = 800;
const MAX_IN_FLIGHT = 3;

interface UseSlideMediaOptions {
  message: Message | null;
  enabled: boolean;
  getCachedUrl: (messageId: string) => string | undefined;
  putCachedUrl: (messageId: string, objectUrl: string) => string;
}

interface SlideMediaState {
  objectUrl: string | null;
  loading: boolean;
  failed: boolean;
  retry: () => void;
}

let inFlightCount = 0;
const mediaWaiters: Array<() => boolean> = [];

function acquireMediaSlot(signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if (inFlightCount < MAX_IN_FLIGHT) {
    inFlightCount += 1;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const grant = () => {
      signal.removeEventListener("abort", cancel);
      if (signal.aborted) {
        resolve(false);
        return false;
      }
      inFlightCount += 1;
      resolve(true);
      return true;
    };
    const cancel = () => {
      const index = mediaWaiters.indexOf(grant);
      if (index >= 0) mediaWaiters.splice(index, 1);
      resolve(false);
    };
    mediaWaiters.push(grant);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

function releaseMediaSlot() {
  inFlightCount = Math.max(0, inFlightCount - 1);
  while (mediaWaiters.length > 0) {
    const grant = mediaWaiters.shift();
    if (grant?.()) break;
  }
}

/** Debounced, cancellable fetch for the currently visible slide media. */
export function useSlideMedia({
  message,
  enabled,
  getCachedUrl,
  putCachedUrl,
}: UseSlideMediaOptions): SlideMediaState {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const startFetch = useCallback(
    (targetId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      void (async () => {
        const acquired = await acquireMediaSlot(controller.signal);
        if (!acquired) return;
        try {
          const blob = await fetchMessageMediaBlob(targetId, controller.signal);
          if (controller.signal.aborted) return;
          const url = putCachedUrl(targetId, URL.createObjectURL(blob));
          setObjectUrl(url);
          setFailed(false);
        } catch {
          if (controller.signal.aborted) return;
          setFailed(true);
          setObjectUrl(null);
        } finally {
          releaseMediaSlot();
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      })();
    },
    [putCachedUrl],
  );
  const { schedule: scheduleFetch, cancel: cancelFetch } = useDebouncedCallback(
    startFetch,
    MEDIA_DEBOUNCE_MS,
  );

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    cancelFetch();

    if (!enabled || !message?.media || !isVisualMediaKind(message.media.kind)) {
      setObjectUrl(null);
      setLoading(false);
      setFailed(false);
      return undefined;
    }

    const cached = getCachedUrl(message.id);
    if (cached) {
      setObjectUrl(cached);
      setLoading(false);
      setFailed(false);
      return undefined;
    }

    setObjectUrl(null);
    setFailed(false);
    setLoading(true);
    scheduleFetch(message.id);

    return () => {
      cancelFetch();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [attempt, cancelFetch, enabled, getCachedUrl, message, scheduleFetch]);

  return { objectUrl, loading, failed, retry };
}
