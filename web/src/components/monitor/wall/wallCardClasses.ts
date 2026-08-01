import type React from "react";

import {
  computeImageFlexShare,
  type WallLayoutMode,
} from "../../../domain/monitor/wall/wallLayout";

function wallContentFontSize(textLength: number, hasMedia: boolean): string {
  if (hasMedia) {
    if (textLength <= 22) return "clamp(13px, 1.05vw, 16px)";
    if (textLength <= 70) return "clamp(12px, 0.95vw, 15px)";
    if (textLength <= 150) return "clamp(11px, 0.88vw, 14px)";
    return "clamp(10px, 0.8vw, 13px)";
  }
  if (textLength <= 22) return "clamp(18px, 1.7vw, 25px)";
  if (textLength <= 70) return "clamp(16px, 1.35vw, 21px)";
  if (textLength <= 150) return "clamp(14px, 1.12vw, 18px)";
  return "clamp(12px, .98vw, 16px)";
}

function wallContentLineClamp(textLength: number, mode: WallLayoutMode): number {
  const hasMedia = mode !== "text-only";
  const isSide = mode === "side-column";

  if (hasMedia) {
    if (textLength > 200) return isSide ? 10 : 6;
    if (textLength > 100) return isSide ? 12 : 7;
    return isSide ? 14 : 8;
  }
  return textLength > 150 ? 10 : 8;
}

export function wallContentProps(
  textLength: number,
  mode: WallLayoutMode,
): { className: string; style: React.CSSProperties } {
  const hasMedia = mode !== "text-only";
  const isSide = mode === "side-column";
  const lineHeight = hasMedia ? 1.38 : textLength > 150 ? 1.42 : 1.48;
  const lineClamp = wallContentLineClamp(textLength, mode);

  const className = [
    "im-wall-content",
    hasMedia ? "im-wall-content--clamp" : "",
    isSide ? "im-wall-content--side" : hasMedia ? "im-wall-content--stacked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    className,
    style: {
      ["--wall-content-font-size" as string]: wallContentFontSize(textLength, hasMedia),
      ["--wall-content-line-height" as string]: String(lineHeight),
      ["--wall-content-max-width" as string]: isSide ? "100%" : hasMedia ? "96%" : "88%",
      ["--wall-content-text-align" as string]: isSide ? "left" : "center",
      ["--wall-content-max-height" as string]: `${lineClamp * lineHeight}em`,
      ...(hasMedia
        ? { ["--wall-content-line-clamp" as string]: String(lineClamp) }
        : {}),
    },
  };
}

export function wallMediaFrameProps(
  mode: WallLayoutMode,
  textLength = 0,
  aspectRatio: number | null = null,
): { className: string; style: React.CSSProperties } {
  const imageShare = computeImageFlexShare(textLength, aspectRatio, mode);

  if (mode === "side-column") {
    return {
      className: "im-wall-media-frame",
      style: {
        ["--wall-media-flex" as string]: `1 1 ${imageShare}%`,
        ["--wall-media-min-height" as string]: "54%",
      },
    };
  }

  if (mode === "image-only") {
    return {
      className: "im-wall-media-frame im-wall-media-frame--full",
      style: {
        ["--wall-media-flex" as string]: "1 1 auto",
        ["--wall-media-min-height" as string]: "78%",
      },
    };
  }

  return {
    className: "im-wall-media-frame im-wall-media-frame--full",
    style: {
      ["--wall-media-flex" as string]: `1 1 ${imageShare}%`,
      ["--wall-media-min-height" as string]: `${Math.max(52, imageShare - 6)}%`,
    },
  };
}

export const wallMediaImageClass =
  "block h-full w-full max-h-full max-w-full rounded-md object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,.22)]";

export const wallMediaRetryClass =
  "cursor-pointer rounded-full border border-[var(--wall-border)] bg-[var(--wall-overlay)] px-[9px] py-1 font-[inherit] text-[var(--wall-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary";

export const wallLightboxPanelClass =
  "relative flex w-full max-h-[min(92vh,900px)] max-w-[min(96vw,1200px)] flex-col items-center gap-md";

export const wallLightboxImageClass =
  "block h-auto max-h-[min(78vh,820px)] w-auto max-w-full rounded-lg object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)]";

export const wallLightboxCaptionClass =
  "m-0 max-w-[min(92vw,720px)] whitespace-pre-wrap break-words text-center text-[clamp(13px,1.1vw,16px)] leading-snug text-white/90 [text-shadow:0_2px_12px_rgba(0,0,0,0.55)]";

export const wallLightboxTitleClass =
  "m-0 text-center text-xs font-medium tracking-wide text-white/55";

export const wallLightboxCloseClass =
  "absolute -top-2 right-0 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white";
