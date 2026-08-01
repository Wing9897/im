import type React from "react";
import { platformColor } from "../utils/platform";

export const taskTagBaseClass =
  "im-intelligence-card-tag im-intelligence-card-task-tag inline-flex max-w-[92px] items-center truncate rounded-full border px-[5px] py-px text-[9px] font-medium leading-[1.35] tracking-[0.03em]";

export const platformTagBaseClass =
  "inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border";

export function taskTagColorStyle(accentColor: string): React.CSSProperties {
  return {
    color: `color-mix(in srgb, ${accentColor} 88%, var(--text-muted))`,
    background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
    borderColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
  };
}

export function platformTagColorStyle(platform: string): React.CSSProperties {
  const tint = platformColor(platform);
  return {
    color: tint,
    background: `color-mix(in srgb, ${tint} 16%, transparent)`,
    borderColor: `color-mix(in srgb, ${tint} 22%, transparent)`,
  };
}
