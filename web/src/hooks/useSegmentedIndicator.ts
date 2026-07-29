import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

interface SegmentedIndicatorStyle {
  width: number;
  transform: string;
}

const INDICATOR_HEIGHT: number | undefined = undefined;

/**
 * Measures active tab position within a track and returns indicator bar geometry.
 */
export function useSegmentedIndicator(activeIndex: number) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLElement | null)[]>([]);
  const [indicator, setIndicator] = useState<SegmentedIndicatorStyle>({
    width: 0,
    transform: "translateX(0px)",
  });

  const setTabRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      tabRefs.current[index] = element;
    },
    [],
  );

  const measure = useCallback(() => {
    const track = trackRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!track || !tab) {
      setIndicator({ width: 0, transform: "translateX(0px)" });
      return;
    }

    const trackRect = track.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const offsetX = tabRect.left - trackRect.left;

    setIndicator({
      width: tabRect.width,
      transform: `translateX(${offsetX}px)`,
    });
  }, [activeIndex]);

  useEffect(() => {
    measure();

    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(track);
    for (const tab of tabRefs.current) {
      if (tab) observer.observe(tab);
    }

    return () => observer.disconnect();
  }, [measure, activeIndex]);

  return {
    trackRef,
    setTabRef,
    indicatorStyle: {
      width: indicator.width,
      ...(INDICATOR_HEIGHT != null ? { height: INDICATOR_HEIGHT } : {}),
      transform: indicator.transform,
    } satisfies CSSProperties,
  };
}
