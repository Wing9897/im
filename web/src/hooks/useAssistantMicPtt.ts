import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { SpacePttMode } from "../speech/voiceSettings";
import { applyPttToggle, beginPttHold, endPttHold } from "./assistantPtt/pttInteraction";

type UseAssistantMicPttOptions = {
  spacePttMode: SpacePttMode;
  listening: boolean;
  sending: boolean;
  startListening: () => void | Promise<void>;
  stopListening: (options?: { send?: boolean }) => void | Promise<void>;
};

/**
 * Mic button handlers that follow voice ``spacePttMode`` (hold vs toggle).
 *
 * Hold model:
 * - ``pointerdown`` → start + mark held + window ``pointerup`` safety net
 * - ``pointerup`` / window ``pointerup`` → stop+send
 * - ``pointercancel`` / ``lostpointercapture`` → **no-op** while held
 *   (React re-render mid-hold can fire cancel; must not abort STT)
 */
export function useAssistantMicPtt({
  spacePttMode,
  listening,
  sending,
  startListening,
  stopListening,
}: UseAssistantMicPttOptions) {
  const holdActiveRef = useRef(false);
  const holdPointerIdRef = useRef<number | null>(null);
  const removeWindowHoldListenersRef = useRef<(() => void) | null>(null);
  /** Local press chrome from pointerdown until release. */
  const [holding, setHolding] = useState(false);

  const startListeningRef = useRef(startListening);
  const stopListeningRef = useRef(stopListening);
  startListeningRef.current = startListening;
  stopListeningRef.current = stopListening;

  const clearWindowHoldListeners = useCallback(() => {
    removeWindowHoldListenersRef.current?.();
    removeWindowHoldListenersRef.current = null;
  }, []);

  const endHoldSend = useCallback(() => {
    if (
      !endPttHold(holdActiveRef.current, {
        stopListening: (options) =>
          options === undefined
            ? stopListeningRef.current()
            : stopListeningRef.current(options),
      })
    ) {
      return;
    }
    holdActiveRef.current = false;
    holdPointerIdRef.current = null;
    setHolding(false);
    clearWindowHoldListeners();
  }, [clearWindowHoldListeners]);

  useEffect(() => () => clearWindowHoldListeners(), [clearWindowHoldListeners]);

  const armWindowHoldEnd = useCallback(
    (pointerId: number) => {
      clearWindowHoldListeners();
      const onWindowPointerUp = (event: globalThis.PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        endHoldSend();
      };
      // pointerup only — pointercancel after re-render must not end hold.
      window.addEventListener("pointerup", onWindowPointerUp);
      removeWindowHoldListenersRef.current = () => {
        window.removeEventListener("pointerup", onWindowPointerUp);
      };
    },
    [clearWindowHoldListeners, endHoldSend],
  );

  const onMicPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (spacePttMode === "toggle") return;
      if (typeof event.button === "number" && event.button !== 0) return;
      event.preventDefault();

      // Recover if a prior hold stayed active without pointerup (ignored cancel).
      if (holdActiveRef.current) {
        endHoldSend();
      }

      if (
        !beginPttHold(sending, holdActiveRef.current, {
          startListening: () => startListeningRef.current(),
        })
      ) {
        return;
      }

      holdActiveRef.current = true;
      holdPointerIdRef.current = event.pointerId;
      setHolding(true);
      armWindowHoldEnd(event.pointerId);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture optional — window pointerup still ends hold */
      }
    },
    [armWindowHoldEnd, endHoldSend, sending, spacePttMode],
  );

  const onMicPointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (spacePttMode === "toggle") return;
      event.preventDefault();
      if (
        holdPointerIdRef.current !== null &&
        typeof event.pointerId === "number" &&
        event.pointerId !== holdPointerIdRef.current
      ) {
        return;
      }
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* ignore */
      }
      endHoldSend();
    },
    [endHoldSend, spacePttMode],
  );

  const onMicClick = useCallback(() => {
    if (spacePttMode !== "toggle") return;
    applyPttToggle(listening, sending, {
      startListening: () => startListeningRef.current(),
      stopListening: (options) =>
        options === undefined
          ? stopListeningRef.current()
          : stopListeningRef.current(options),
    });
  }, [listening, sending, spacePttMode]);

  return {
    onMicPointerDown,
    onMicPointerUp,
    onMicClick,
    micToggleMode: spacePttMode === "toggle",
    holding,
  };
}
