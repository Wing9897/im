/**
 * Shared hold / toggle PTT decisions for mic and Space.
 * UI hooks own input events; this module owns the start/stop policy.
 */

export type PttListenCallbacks = {
  startListening: () => void | Promise<void>;
  stopListening: (options?: { send?: boolean }) => void | Promise<void>;
};

/** Toggle gesture: first press starts, second press stops + sends. */
export function applyPttToggle(
  listening: boolean,
  sending: boolean,
  { startListening, stopListening }: PttListenCallbacks,
): void {
  if (sending) return;
  if (listening) {
    void stopListening({ send: true });
  } else {
    void startListening();
  }
}

/**
 * Begin a hold-to-talk press.
 * @returns true when listening was started (caller should mark the press active).
 */
export function beginPttHold(
  sending: boolean,
  alreadyHeld: boolean,
  { startListening }: Pick<PttListenCallbacks, "startListening">,
): boolean {
  if (sending || alreadyHeld) return false;
  void startListening();
  return true;
}

/**
 * End a hold-to-talk press and request release-to-send.
 * @returns true when stop was invoked (caller should clear the press flag).
 */
export function endPttHold(
  held: boolean,
  { stopListening }: Pick<PttListenCallbacks, "stopListening">,
): boolean {
  if (!held) return false;
  void stopListening({ send: true });
  return true;
}

/** Focus moved into an editable — stop STT without auto-send so typing wins. */
export function stopPttForEditable(
  shouldStop: boolean,
  { stopListening }: Pick<PttListenCallbacks, "stopListening">,
): void {
  if (!shouldStop) return;
  void stopListening();
}
