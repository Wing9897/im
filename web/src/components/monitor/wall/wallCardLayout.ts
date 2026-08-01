import type React from "react";

import { type WallLayoutMode } from "../../../domain/monitor/wall/wallLayout";

export {
  wallContentProps,
  wallMediaFrameProps,
  wallMediaImageClass,
  wallMediaRetryClass,
  wallLightboxPanelClass,
  wallLightboxImageClass,
  wallLightboxCaptionClass,
  wallLightboxTitleClass,
  wallLightboxCloseClass,
} from "./wallCardClasses";

const bannerGradients = [
  "var(--wall-banner-1)",
  "var(--wall-banner-2)",
  "var(--wall-banner-3)",
  "var(--wall-banner-4)",
  "var(--wall-banner-5)",
  "var(--wall-banner-6)",
  "var(--wall-banner-7)",
  "var(--wall-banner-8)",
] as const;

const bannerPatterns = [
  "radial-gradient(circle at 2px 2px, rgba(255,255,255,.17) 1.2px, transparent 1.3px) 0 0 / 18px 18px",
  "repeating-linear-gradient(135deg, rgba(255,255,255,.11) 0 1px, transparent 1px 15px)",
  "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px) 0 0 / 22px 22px",
  "radial-gradient(circle at 80% 20%, transparent 0 34px, rgba(255,255,255,.12) 35px 36px, transparent 37px 56px, rgba(255,255,255,.08) 57px 58px, transparent 59px)",
  "repeating-radial-gradient(circle at 10% 90%, rgba(255,255,255,.10) 0 1px, transparent 2px 14px)",
  "repeating-linear-gradient(60deg, transparent 0 18px, rgba(255,255,255,.09) 18px 19px), repeating-linear-gradient(-60deg, transparent 0 18px, rgba(255,255,255,.06) 18px 19px)",
  "radial-gradient(ellipse at 20% 30%, transparent 0 28px, rgba(255,255,255,.10) 29px 30px, transparent 31px), radial-gradient(ellipse at 78% 76%, transparent 0 42px, rgba(255,255,255,.10) 43px 44px, transparent 45px)",
  "repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 1px, transparent 1px 8px), repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 32px)",
] as const;

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/** Stable pseudo-random background per channel. */
export function wallBannerBackground(channelKey: string): string {
  const hash = stableHash(channelKey);
  const pattern = bannerPatterns[hash % bannerPatterns.length];
  const gradient = bannerGradients[(hash >>> 3) % bannerGradients.length];
  return `${pattern}, ${gradient}`;
}

/** Portrait wall card footprint (matches `.im-wall-card`). */
export function wallCardInlineStyle(channelKey: string): React.CSSProperties {
  return {
    background: wallBannerBackground(channelKey),
  };
}

export function wallMainClass(mode: WallLayoutMode): string {
  const base = "im-wall-main";
  switch (mode) {
    case "text-only":
      return `${base} im-wall-main--text-only`;
    case "image-only":
      return `${base} im-wall-main--image-only`;
    case "overlay-bottom":
      return `${base} im-wall-main--overlay-bottom`;
    case "side-column":
      return `${base} im-wall-main--side-column`;
    default:
      return `${base} im-wall-main--stack`;
  }
}

export function wallDotClass(active: boolean): string {
  return active ? "im-wall-dot im-wall-dot--active" : "im-wall-dot";
}

export const wallEmptyBodyClass = "im-wall-empty-body";
export const wallMediaErrorClass = "im-wall-media-error";
