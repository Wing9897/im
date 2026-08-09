/**
 * Shared dynamic import for emoji-picker-react (~390KB + bundled emoji index).
 * Keeps the Items page chunk light; warm via preload on idle/hover.
 *
 * This loads our own app/vendor chunk only — not Apple/Google CDN images.
 * Pair with `emojiStyle="native"` in EmojiPickerPanel so the picker stays offline-safe.
 */

type EmojiPickerModule = typeof import("emoji-picker-react");

let loadPromise: Promise<EmojiPickerModule> | null = null;

export function loadEmojiPickerModule(): Promise<EmojiPickerModule> {
  if (!loadPromise) {
    loadPromise = import("emoji-picker-react");
  }
  return loadPromise;
}

/** Fire-and-forget warm of the picker chunk (idempotent). */
export function preloadEmojiPickerModule(): void {
  void loadEmojiPickerModule().catch(() => {
    loadPromise = null;
  });
}

/**
 * Schedule a preload after first paint (idle callback with timeout fallback).
 * Returns a cancel function for effect cleanup.
 */
export function scheduleEmojiPickerPreload(timeoutMs = 2000): () => void {
  const warm = () => preloadEmojiPickerModule();
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(warm, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const timer = window.setTimeout(warm, Math.min(400, timeoutMs));
  return () => window.clearTimeout(timer);
}

/** Test-only: clear the cached promise between cases. */
export function __resetEmojiPickerLoaderForTests(): void {
  loadPromise = null;
}
