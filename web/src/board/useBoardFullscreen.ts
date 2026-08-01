import { useCallback, useEffect, useRef, useState } from "react";

import { captureError } from "../utils/errorReporter";

/**
 * Board immersive + system fullscreen (same Fullscreen API pattern as wall/map).
 * Immersive hides App shell title bars; system fullscreen targets the board root.
 */
export function useBoardFullscreen(onImmersiveChange?: (immersive: boolean) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const immersiveRef = useRef(false);

  const setImmersive = useCallback(
    (next: boolean) => {
      if (immersiveRef.current === next) {
        return;
      }
      immersiveRef.current = next;
      const el = containerRef.current;
      if (el) {
        if (next) {
          el.setAttribute("data-board-immersive", "true");
        } else {
          el.removeAttribute("data-board-immersive");
        }
      }
      onImmersiveChange?.(next);
    },
    [onImmersiveChange],
  );

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        // Hide shell chrome first so the board can expand before FS lock.
        setImmersive(true);
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        setImmersive(false);
      }
    } catch (error: unknown) {
      setImmersive(false);
      setIsFullscreen(false);
      captureError(error, { component: "BoardRoot", severity: "warning" });
    }
  }, [setImmersive]);

  useEffect(() => {
    const handleFsChange = () => {
      const el = containerRef.current;
      const active = !!el && document.fullscreenElement === el;
      setIsFullscreen(active);
      if (!active) {
        setImmersive(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, [setImmersive]);

  return { containerRef, isFullscreen, toggleFullscreen };
}
