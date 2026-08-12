/** Intelligence item detail dialog class strings. */

import { detailDialogScrollBodyClass } from "./shell";
import { taskDetailBadgesClass, taskDetailHeaderClass } from "./task";

export const intelligenceDetailHeaderClass = taskDetailHeaderClass;

export const intelligenceDetailTitleClass =
  "m-0 break-words text-card-title font-extrabold leading-snug text-text-primary";

export const intelligenceDetailBadgesClass = taskDetailBadgesClass;

export const intelligenceDetailBodyClass =
  `flex flex-col gap-lg px-md py-md ${detailDialogScrollBodyClass}`;

export const intelligenceDetailContentHeroClass =
  "im-surface-inset whitespace-pre-wrap break-words rounded-md border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] px-md py-[14px] text-body leading-relaxed text-text-primary";

export const intelligenceDetailMetaListClass = "flex flex-col gap-sm";

export const intelligenceDetailMetaItemClass =
  "flex items-start gap-sm text-body leading-normal text-text-secondary";

export const intelligenceDetailMetaLabelClass =
  "min-w-[72px] shrink-0 text-[10px] font-bold uppercase tracking-wide text-text-muted";

export const intelligenceDetailMetaIconClass = "mt-0.5 shrink-0 text-accent";

export const intelligenceDetailFooterClass =
  "flex justify-end border-t border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-md pb-md pt-md";
