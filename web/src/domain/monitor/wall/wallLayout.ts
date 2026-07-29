/** Dynamic layout modes for wall carousel slides. */
export type WallLayoutMode =
  | "text-only"
  | "image-only"
  | "stack"
  | "overlay-bottom"
  | "side-column";

interface WallLayoutInput {
  hasVisualMedia: boolean;
  hasText: boolean;
  textLength: number;
  /** width / height; null before the image finishes loading. */
  aspectRatio: number | null;
}

const LANDSCAPE_RATIO = 1.35;
const PORTRAIT_RATIO = 0.8;

/** Rough vertical share (%) for the media frame; remainder goes to caption text. */
export function computeImageFlexShare(
  textLength: number,
  aspectRatio: number | null,
  mode: WallLayoutMode,
): number {
  if (mode === "image-only") return 100;

  let share =
    textLength > 180 ? 58 : textLength > 120 ? 62 : textLength > 60 ? 66 : textLength > 30 ? 70 : 74;

  if (aspectRatio != null && Number.isFinite(aspectRatio)) {
    if (aspectRatio >= LANDSCAPE_RATIO) {
      // Wide images read better full-width above text.
      share += 8;
    } else if (aspectRatio <= PORTRAIT_RATIO) {
      share += textLength <= 120 ? 2 : -2;
    }
  }

  if (mode === "side-column") {
    return Math.min(68, Math.max(58, share));
  }

  return Math.min(78, Math.max(56, share));
}

/**
 * Pick the best layout for the current slide from image aspect ratio and text volume.
 * Falls back to `stack` while dimensions are unknown or for edge cases.
 */
export function pickWallLayout(input: WallLayoutInput): WallLayoutMode {
  const { hasVisualMedia, hasText, aspectRatio } = input;

  if (!hasVisualMedia) return "text-only";
  if (!hasText) return "image-only";
  if (aspectRatio == null || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return "stack";
  }

  if (aspectRatio >= LANDSCAPE_RATIO) {
    return "stack";
  }

  // Portrait cards are vertical; keep media + text stacked rather than side-by-side.
  if (aspectRatio <= PORTRAIT_RATIO) {
    return "stack";
  }

  return "stack";
}
