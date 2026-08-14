/** Task detail dialog class strings (domain-unique only). */

import { badgePillBaseClass } from "../../../styles/badgeClasses";

export const taskDetailDescriptionClass =
  "im-surface-inset whitespace-pre-wrap rounded-[10px] border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] p-[12px_14px] text-body leading-relaxed text-text-primary";

export const taskDetailChannelsClass =
  "overflow-hidden rounded-[10px] border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)]";

export const taskDetailChannelsToggleClass =
  "im-surface-inset flex w-full cursor-pointer items-center justify-between gap-sm border-none px-md py-[10px] text-left text-body font-semibold text-text-primary hover:bg-[color-mix(in_srgb,var(--surface-overlay)_40%,transparent)]";

export const taskDetailChannelsListClass =
  "m-0 list-disc py-sm pl-7 pr-md text-[11px] leading-normal text-text-secondary";

export const taskDetailStatusPillClass =
  `im-surface-inset ${badgePillBaseClass} gap-1.5 border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] px-[10px] py-[3px] text-[10px] font-semibold text-text-secondary`;
