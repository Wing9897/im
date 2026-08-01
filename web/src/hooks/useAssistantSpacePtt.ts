import { useEffect, useRef } from "react";
import { isEditableTarget } from "../utils/isEditableTarget";
import type { SpacePttMode } from "../speech/voiceSettings";
import {
  beginPttHold,
  endPttHold,
  stopPttForEditable,
} from "./assistantPtt/pttInteraction";

type UseAssistantSpacePttOptions = {
  /** When false, listeners are not attached (e.g. caption mode closed). Default true. */
  enabled?: boolean;
  sttAvailable: boolean;
  sending: boolean;
  /** Required for toggle mode (Space starts vs stops). */
  listening?: boolean;
  startListening: () => void | Promise<void>;
  /** Called on Space release / blur / toggle-off; pass ``{ send: true }`` from chat to auto-submit. */
  stopListening: (options?: { send?: boolean }) => void | Promise<void>;
  /** From voice settings (``hold`` | ``toggle``). */
  mode: SpacePttMode;
  /** Fired when hold-mode Space press state changes (for immediate UI feedback). */
  onHoldChange?: (held: boolean) => void;
};

function isSpaceKey(event: KeyboardEvent): boolean {
  return event.code === "Space" || event.key === " " || event.key === "Spacebar";
}

function canStartSpacePtt(event: KeyboardEvent, sending: boolean): boolean {
  if (!isSpaceKey(event) || event.metaKey || event.ctrlKey || event.altKey) return false;
  // Prefer activeElement: clicking non-focusable chrome often leaves the draft focused
  // while event.target is the window/body — typing must still win in that case.
  if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return false;
  if (sending) return false;
  return true;
}

/** Blur focused button/link so Space does not activate chrome controls. */
function blurActivatingControl(): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  const tag = active.tagName;
  if (tag === "BUTTON" || tag === "A" || active.getAttribute("role") === "button") {
    active.blur();
  }
}

/**
 * Space talk when focus is outside editable fields (mirrors mic PTT).
 * Used by `/assistant` and the title-bar caption assistant.
 *
 * Listeners use **capture** so Space never activates a focused title-bar button.
 *
 * - ``hold`` — press to start, release to stop + send
 * - ``toggle`` — press to start, press again to stop + send
 *
 * Focusing an editable field stops **Space-owned** STT only (no auto-send) so
 * typing wins over PTT. Mic-owned sessions are left alone — speak-while-typing
 * uses the mic button.
 *
 * Product: Space types while the draft is focused; speak via the mic button.
 */
export function useAssistantSpacePtt({
  enabled = true,
  sttAvailable,
  sending,
  listening = false,
  startListening,
  stopListening,
  mode,
  onHoldChange,
}: UseAssistantSpacePttOptions): void {
  const listeningRef = useRef(listening);
  const sendingRef = useRef(sending);
  const onHoldChangeRef = useRef(onHoldChange);
  const startListeningRef = useRef(startListening);
  const stopListeningRef = useRef(stopListening);
  listeningRef.current = listening;
  sendingRef.current = sending;
  onHoldChangeRef.current = onHoldChange;
  startListeningRef.current = startListening;
  stopListeningRef.current = stopListening;

  useEffect(() => {
    if (!enabled || !sttAvailable) return;

    let spaceHeld = false;
    /** True only while this hook started the current listen session. */
    let spaceOwned = false;
    const opts: AddEventListenerOptions = { capture: true };
    const cbs = {
      startListening: () => startListeningRef.current(),
      stopListening: (options?: { send?: boolean }) =>
        options === undefined
          ? stopListeningRef.current()
          : stopListeningRef.current(options),
    };

    const setHeld = (held: boolean) => {
      spaceHeld = held;
      onHoldChangeRef.current?.(held);
    };

    /** Stop Space-owned capture without sending when the user moves into a text field. */
    const stopForEditable = () => {
      const wasHeld = spaceHeld;
      if (wasHeld) setHeld(false);
      if (!spaceOwned && !wasHeld) return;
      spaceOwned = false;
      stopPttForEditable(true, cbs);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isEditableTarget(event.target)) return;
      stopForEditable();
    };

    if (mode === "toggle") {
      const onKeyDown = (event: KeyboardEvent) => {
        if (!canStartSpacePtt(event, sendingRef.current)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        blurActivatingControl();
        if (listeningRef.current) {
          // Stop any active session (Space- or mic-owned) — release-to-send.
          spaceOwned = false;
          void stopListeningRef.current({ send: true });
        } else {
          spaceOwned = true;
          void startListeningRef.current();
        }
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (!isSpaceKey(event)) return;
        // Stop focused <button> click-on-Space-keyup even if we already started STT.
        event.preventDefault();
        event.stopPropagation();
      };

      const onBlur = () => {
        if (!spaceOwned || !listeningRef.current) return;
        spaceOwned = false;
        void stopListeningRef.current({ send: true });
      };

      window.addEventListener("keydown", onKeyDown, opts);
      window.addEventListener("keyup", onKeyUp, opts);
      window.addEventListener("blur", onBlur);
      window.addEventListener("focusin", onFocusIn);
      return () => {
        window.removeEventListener("keydown", onKeyDown, opts);
        window.removeEventListener("keyup", onKeyUp, opts);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("focusin", onFocusIn);
        // Drop ownership on teardown; caller (caption close) stops without send if needed.
        spaceOwned = false;
      };
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!canStartSpacePtt(event, sendingRef.current)) return;
      // Capture-phase preventDefault stops title-bar button activation.
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (!beginPttHold(sendingRef.current, spaceHeld, cbs)) return;
      blurActivatingControl();
      spaceOwned = true;
      setHeld(true);
    };

    const endSpacePtt = () => {
      if (!endPttHold(spaceHeld, cbs)) return;
      spaceOwned = false;
      setHeld(false);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!isSpaceKey(event)) return;
      event.preventDefault();
      event.stopPropagation();
      endSpacePtt();
    };

    window.addEventListener("keydown", onKeyDown, opts);
    window.addEventListener("keyup", onKeyUp, opts);
    window.addEventListener("blur", endSpacePtt);
    window.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKeyDown, opts);
      window.removeEventListener("keyup", onKeyUp, opts);
      window.removeEventListener("blur", endSpacePtt);
      window.removeEventListener("focusin", onFocusIn);
      // Only stop if Space was actually held — avoid aborting on spurious remount.
      if (spaceHeld) {
        setHeld(false);
        spaceOwned = false;
        void stopListeningRef.current({ send: true });
      }
    };
  }, [enabled, mode, sttAvailable]);
}
