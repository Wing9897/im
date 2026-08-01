import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
} from "react";

/** Idle delay before view-mode FAB fades (mousemove / near-corner / focus reveal). */
export const BOARD_CHROME_IDLE_MS = 1600;

/**
 * View mode: briefly show corner FAB on pointer activity, then auto-hide.
 * Edit mode: always revealed (tools stay pinned).
 * Hover / focus within chrome pins reveal so controls stay reachable.
 */
export function useBoardChromeReveal(isEdit: boolean) {
  const [revealed, setRevealed] = useState(true);
  const pinnedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (isEdit || pinnedRef.current) {
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!pinnedRef.current) {
        setRevealed(false);
      }
    }, BOARD_CHROME_IDLE_MS);
  }, [clearHideTimer, isEdit]);

  const setPinned = useCallback(
    (pinned: boolean) => {
      pinnedRef.current = pinned;
      if (pinned) {
        clearHideTimer();
        setRevealed(true);
        return;
      }
      scheduleHide();
    },
    [clearHideTimer, scheduleHide],
  );

  useEffect(() => {
    if (isEdit) {
      clearHideTimer();
      pinnedRef.current = false;
      setRevealed(true);
      return;
    }

    const onActivity = () => {
      setRevealed(true);
      if (pinnedRef.current) {
        return;
      }
      clearHideTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!pinnedRef.current) {
          setRevealed(false);
        }
      }, BOARD_CHROME_IDLE_MS);
    };

    // Pointer activity anywhere on the page re-shows the FAB.
    document.addEventListener("mousemove", onActivity, { passive: true });
    document.addEventListener("pointerdown", onActivity, { passive: true });
    // Keyboard users: any key activity reveals; focus-within also pins via handlers.
    document.addEventListener("keydown", onActivity);

    scheduleHide();

    return () => {
      document.removeEventListener("mousemove", onActivity);
      document.removeEventListener("pointerdown", onActivity);
      document.removeEventListener("keydown", onActivity);
      clearHideTimer();
    };
  }, [clearHideTimer, isEdit, scheduleHide]);

  return {
    revealed,
    onHotspotPointerEnter: () => setPinned(true),
    onHotspotPointerLeave: () => setPinned(false),
    onHotspotFocusCapture: () => setPinned(true),
    onHotspotBlurCapture: (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) {
        return;
      }
      setPinned(false);
    },
  };
}
