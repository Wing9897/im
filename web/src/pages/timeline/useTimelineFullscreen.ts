import { useCallback, useEffect, useRef, useState } from "react";

import { captureError } from "../../utils/errorReporter";

/** Fullscreen API for the timeline page root (same pattern as monitor wall / map). */
export function useTimelineFullscreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error: unknown) {
      captureError(error, { component: "TimelinePage", severity: "warning" });
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      const el = containerRef.current;
      setIsFullscreen(!!el && document.fullscreenElement === el);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  return { containerRef, isFullscreen, toggleFullscreen };
}
