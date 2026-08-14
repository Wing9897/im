/**
 * Shared detail-dialog chrome — header / title / footer / meta / body atoms.
 * Call sites import these directly; domain files keep only unique overrides.
 */

import { detailDialogScrollBodyClass } from "./shell";

/** Standard header (most detail dialogs). */
export const detailChromeHeaderClass =
  "border-b border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-md pb-sm pt-md pr-10";

/** Log header — mono + slightly taller padding. */
export const detailChromeHeaderMonoClass =
  "border-b border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-md pb-md pt-md pr-12 font-mono";

export const detailChromeTitleRowClass =
  "flex flex-wrap items-start justify-between gap-md";

export const detailChromeTitleClass =
  "m-0 break-words text-card-title font-bold leading-snug text-text-primary";

export const detailChromeBadgesClass =
  "mt-[10px] flex flex-wrap items-center gap-sm";

export const detailChromeMetaLineClass = "text-[11px] text-text-muted";

export const detailChromeCardTitleClass =
  "mb-sm text-[10px] font-bold uppercase tracking-wide text-text-muted";

/** Scroll body column used by task / source / intelligence. */
export function detailChromeBodyClass(gapClass: "gap-md" | "gap-lg" | "gap-field-gap"): string {
  return `flex flex-col ${gapClass} px-md py-md ${detailDialogScrollBodyClass}`;
}

export const detailChromeBodyGapMdClass = detailChromeBodyClass("gap-md");
export const detailChromeBodyGapLgClass = detailChromeBodyClass("gap-lg");
export const detailChromeBodyGapFieldClass = detailChromeBodyClass("gap-field-gap");

/** Plain footer (intelligence / log) — close-only, no action gap. */
export const detailChromeFooterPlainClass =
  "flex justify-end border-t border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-md pb-md pt-md";

/** Action footer with button gap (source / message / action). */
export const detailChromeFooterClass =
  "flex justify-end gap-sm border-t border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-md pb-md pt-md";

/** Raised chrome footer (task) — frosted bar over photo BG. */
export const detailChromeFooterRaisedClass =
  `im-surface-chrome ${detailChromeFooterClass}`;
