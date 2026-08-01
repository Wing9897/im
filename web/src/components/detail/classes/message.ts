/** Message detail dialog class strings. */

import { sourceDetailFooterClass } from "./source";
import { taskDetailHeaderClass } from "./task";

export const messageDetailHeaderClass = taskDetailHeaderClass;

export const messageDetailSenderClass =
  "m-0 text-card-title font-bold text-text-primary";

export const messageDetailMetaClass =
  "mt-sm flex flex-wrap items-center gap-[10px] text-[11px] text-text-muted";

export const messageDetailBubbleClass =
  "min-h-12 whitespace-pre-wrap break-words rounded-[14px_14px_14px_4px] border border-[color-mix(in_srgb,var(--accent)_20%,var(--surface-border))] bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface-card))] p-[14px_16px] text-body leading-relaxed text-text-primary [&_pre]:m-0 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:font-[inherit]";

export const messageDetailCompactMetaClass =
  "flex flex-wrap gap-x-[14px] gap-y-sm text-[11px] text-text-secondary [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1";

export const messageDetailTechToggleClass =
  "cursor-pointer self-start border-none bg-transparent p-0 text-[10px] font-semibold uppercase tracking-wide text-text-muted hover:text-text-primary";

export const messageDetailTechPanelClass =
  "rounded-md border border-dashed border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_50%,transparent)] p-[10px_12px] font-mono text-[10px] leading-normal text-text-muted [&_div+div]:mt-1.5";

export const messageDetailFooterClass = sourceDetailFooterClass;
