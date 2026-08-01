/** Task detail dialog class strings. */

import { detailDialogScrollBodyClass } from "./shell";

export const taskDetailHeaderClass =
  "border-b border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-md pb-sm pt-md pr-10";

export const taskDetailTitleRowClass =
  "flex flex-wrap items-start justify-between gap-md";

export const taskDetailTitleClass =
  "m-0 break-words text-card-title font-bold leading-snug text-text-primary";

export const taskDetailBadgesClass =
  "mt-[10px] flex flex-wrap items-center gap-sm";

export const taskDetailStatusPillClass =
  "inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_70%,transparent)] px-[10px] py-[3px] text-[10px] font-semibold text-text-secondary";

export const taskDetailBodyClass =
  `flex flex-col gap-md px-md py-md ${detailDialogScrollBodyClass}`;

export const taskDetailDescriptionClass =
  "whitespace-pre-wrap rounded-[10px] border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_65%,transparent)] p-[12px_14px] text-body leading-relaxed text-text-primary";

export const taskDetailMetaLineClass = "text-[11px] text-text-muted";

export const taskDetailChannelsClass =
  "overflow-hidden rounded-[10px] border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)]";

export const taskDetailChannelsToggleClass =
  "flex w-full cursor-pointer items-center justify-between gap-sm border-none bg-[color-mix(in_srgb,var(--surface-card)_65%,transparent)] px-md py-[10px] text-left text-body font-semibold text-text-primary hover:bg-[color-mix(in_srgb,var(--surface-overlay)_40%,transparent)]";

export const taskDetailChannelsListClass =
  "m-0 list-disc py-sm pl-7 pr-md text-[11px] leading-normal text-text-secondary";

export const taskDetailFooterClass =
  "flex justify-end gap-sm border-t border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_55%,transparent)] px-md pb-md pt-md";
