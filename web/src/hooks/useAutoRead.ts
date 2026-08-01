import { useEffect, useMemo, useRef } from "react";

const DEFAULT_VISIBILITY_THRESHOLD = 0.6;
const DEFAULT_AUTO_READ_DELAY_MS = 2500;

interface UseAutoReadOptions {
  itemId: string;
  isRead: boolean;
  visibilityThreshold?: number;
  delayMs?: number;
  onAutoRead: (id: string) => void;
}

/**
 * Marks an item as read after it has been visible in the viewport for a
 * configurable delay. Returns a ref to attach to the observed element.
 */
export function useAutoRead<T extends HTMLElement>({
  itemId,
  isRead,
  visibilityThreshold = DEFAULT_VISIBILITY_THRESHOLD,
  delayMs = DEFAULT_AUTO_READ_DELAY_MS,
  onAutoRead,
}: UseAutoReadOptions) {
  const containerRef = useRef<T | null>(null);

  // Include intermediate thresholds so the observer fires callbacks more
  // frequently as the element scrolls into view, giving smoother detection.
  const observerThresholds = useMemo(
    () =>
      Array.from(new Set([0, visibilityThreshold / 2, visibilityThreshold, 1]))
        .sort((left, right) => left - right),
    [visibilityThreshold],
  );

  useEffect(() => {
    if (isRead) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    let readTimer: number | null = null;
    const scheduleRead = () => {
      if (readTimer !== null) {
        return;
      }
      readTimer = window.setTimeout(() => {
        readTimer = null;
        onAutoRead(itemId);
      }, delayMs);
    };
    const clearReadTimer = () => {
      if (readTimer !== null) {
        window.clearTimeout(readTimer);
        readTimer = null;
      }
    };

    if (typeof IntersectionObserver === "undefined") {
      scheduleRead();
      return () => {
        clearReadTimer();
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisibleEnough = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= visibilityThreshold,
        );
        if (isVisibleEnough) {
          scheduleRead();
        } else {
          clearReadTimer();
        }
      },
      {
        threshold: observerThresholds,
      },
    );
    observer.observe(node);

    return () => {
      clearReadTimer();
      observer.disconnect();
    };
  }, [delayMs, isRead, itemId, observerThresholds, onAutoRead, visibilityThreshold]);

  return containerRef;
}
