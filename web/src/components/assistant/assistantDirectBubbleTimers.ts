/**
 * Fade / hide timing helpers for AssistantDirectBubbles.
 * Pure schedule helpers keep timer behavior unit-testable without the portal UI.
 */

export const FADE_MS = 400;
/** User STT transcript — short; just long enough to read what was heard. */
export const USER_HIDE_MS = 6_000;
/** Agent reply — longer read time. */
export const AGENT_HIDE_MS = 15_000;
/** Brief tip when caption mode turns on with no other activity. */
export const READY_HINT_MS = 4_000;

export type TimedFlash = {
  key: string;
  text: string;
  fading: boolean;
};

export type TimerHandle = number | null;

export function clearTimeoutHandle(handle: TimerHandle): null {
  if (handle != null) {
    window.clearTimeout(handle);
  }
  return null;
}

/**
 * Schedule: wait `hideMs`, mark fading, then wait `FADE_MS` and clear.
 * Returns the hide-timer id; fade timer is stored via `onFadeTimer`.
 */
export function scheduleFlashLifecycle(opts: {
  key: string;
  hideMs: number;
  onFadeStart: (key: string) => void;
  onClear: (key: string) => void;
  onFadeTimer: (id: number) => void;
}): number {
  return window.setTimeout(() => {
    opts.onFadeStart(opts.key);
    const fadeId = window.setTimeout(() => {
      opts.onClear(opts.key);
    }, FADE_MS);
    opts.onFadeTimer(fadeId);
  }, opts.hideMs);
}

/** Total wall time from arm → removed (hide + fade). */
export function flashTotalMs(hideMs: number): number {
  return hideMs + FADE_MS;
}
