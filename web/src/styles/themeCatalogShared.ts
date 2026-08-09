/** Shared motion, shadows, and color helpers for theme catalog groups. */

import type { ThemeMotion } from "./themeTypes.ts";

export const DESK_MOTION: ThemeMotion = {
  durationFast: "140ms",
  durationNormal: "220ms",
  easingOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  staggerStep: "36ms",
  enter: "rise",
};

export const CLASSIC_MOTION: ThemeMotion = {
  durationFast: "160ms",
  durationNormal: "280ms",
  easingOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  staggerStep: "44ms",
  enter: "rise",
};

export const CYBER_MOTION: ThemeMotion = {
  durationFast: "110ms",
  durationNormal: "180ms",
  easingOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  staggerStep: "24ms",
  enter: "glow",
};

export const SAKURA_MOTION: ThemeMotion = {
  durationFast: "180ms",
  durationNormal: "360ms",
  easingOut: "cubic-bezier(0.33, 1, 0.68, 1)",
  staggerStep: "56ms",
  enter: "rise-soft",
};

/** Neutral depth for solid dark desks (no shared muddy black blob). */
export const DESK_SHADOWS = {
  shadowSm: "0 1px 0 color-mix(in srgb, #fff 5%, transparent)",
  shadowMd: "0 8px 24px rgba(0, 0, 0, 0.32)",
  shadowLg: "0 16px 40px rgba(0, 0, 0, 0.4)",
  shadowXl: "0 24px 48px rgba(0, 0, 0, 0.48), 0 8px 16px rgba(0, 0, 0, 0.28)",
} as const;

export const NORD_SHADOWS = {
  shadowSm: "0 1px 2px rgba(46, 52, 64, 0.45), 0 1px 0 rgba(236, 239, 244, 0.04)",
  shadowMd: "0 8px 22px rgba(25, 28, 36, 0.55)",
  shadowLg: "0 16px 36px rgba(20, 22, 30, 0.62)",
  shadowXl: "0 24px 48px rgba(16, 18, 24, 0.7)",
} as const;

export const SUMI_SHADOWS = {
  shadowSm: "0 1px 2px rgba(28, 25, 23, 0.5), 0 1px 0 rgba(250, 248, 244, 0.04)",
  shadowMd: "0 8px 22px rgba(20, 16, 14, 0.55)",
  shadowLg: "0 16px 36px rgba(14, 12, 10, 0.62)",
  shadowXl: "0 24px 48px rgba(10, 8, 6, 0.7)",
} as const;

export const MOSS_SHADOWS = {
  shadowSm: "0 1px 2px rgba(16, 22, 16, 0.5), 0 1px 0 rgba(232, 236, 220, 0.04)",
  shadowMd: "0 8px 22px rgba(12, 18, 12, 0.55)",
  shadowLg: "0 16px 36px rgba(8, 14, 8, 0.62)",
  shadowXl: "0 24px 48px rgba(6, 10, 6, 0.7)",
} as const;

/** Soft paper shadows for light themes (never reuse dark stacks). */
export const LIGHT_SHADOWS = {
  shadowSm: "0 1px 2px rgba(76, 79, 105, 0.06), 0 1px 1px rgba(76, 79, 105, 0.04)",
  shadowMd: "0 6px 16px rgba(76, 79, 105, 0.1), 0 2px 4px rgba(76, 79, 105, 0.06)",
  shadowLg: "0 14px 28px rgba(76, 79, 105, 0.12), 0 4px 8px rgba(76, 79, 105, 0.06)",
  shadowXl: "0 24px 48px rgba(76, 79, 105, 0.14), 0 8px 16px rgba(76, 79, 105, 0.08)",
} as const;

export const WASHI_SHADOWS = {
  shadowSm: "0 1px 2px rgba(60, 48, 36, 0.06), 0 1px 1px rgba(60, 48, 36, 0.04)",
  shadowMd: "0 6px 16px rgba(60, 48, 36, 0.09), 0 2px 4px rgba(60, 48, 36, 0.05)",
  shadowLg: "0 14px 28px rgba(60, 48, 36, 0.11), 0 4px 8px rgba(60, 48, 36, 0.05)",
  shadowXl: "0 24px 48px rgba(60, 48, 36, 0.13), 0 8px 16px rgba(60, 48, 36, 0.07)",
} as const;

export function solidGradient(cardHex: string, rgb: string): string {
  return `linear-gradient(180deg, rgba(${rgb}, 0.55) 0%, ${cardHex} 100%)`;
}

export function accentWash(accentHex: string, amountPct: number): string {
  return `color-mix(in srgb, ${accentHex} ${amountPct}%, transparent)`;
}
