/** Action detail dialog class strings. */

import {
  sourceDetailCardTitleClass,
  sourceDetailFooterClass,
} from "./source";
import {
  taskDetailHeaderClass,
  taskDetailMetaLineClass,
  taskDetailTitleClass,
  taskDetailTitleRowClass,
} from "./task";

export const actionDetailHeaderClass = taskDetailHeaderClass;

export const actionDetailTitleRowClass = taskDetailTitleRowClass;

export const actionDetailTitleClass = taskDetailTitleClass;

export const actionDetailTypeBadgeClass =
  "inline-block rounded-md bg-[color-mix(in_srgb,var(--info)_85%,transparent)] px-[10px] py-[3px] text-[10px] font-semibold text-surface-base";

export const actionDetailEnabledClass = "mt-[10px] text-[11px] text-text-muted";

export const actionDetailCardClass =
  "rounded-[10px] border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_68%,transparent)] p-[12px_14px]";

export const actionDetailCardTitleClass = sourceDetailCardTitleClass;

export const actionDetailCardValueClass =
  "text-body leading-relaxed text-text-primary";

export const actionDetailConfigGridClass = "flex flex-col gap-sm";

export const actionDetailConfigRowClass =
  "grid grid-cols-[120px_1fr] gap-sm text-[11px]";

export const actionDetailConfigLabelClass = "font-semibold text-text-muted";

export const actionDetailConfigValueClass =
  "whitespace-pre-wrap break-all font-mono text-text-primary";

export const actionDetailMetaLineClass = taskDetailMetaLineClass;

export const actionDetailFooterClass = sourceDetailFooterClass;
