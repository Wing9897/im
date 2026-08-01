/** Source detail dialog class strings (shared + platform-specific). */

import { detailDialogScrollBodyClass } from "./shell";
import { taskDetailHeaderClass } from "./task";

export const sourceDetailHeaderClass = taskDetailHeaderClass;

export const sourceDetailTitleClass =
  "m-0 flex items-center gap-sm break-words text-card-title font-bold text-text-primary";

export const sourceDetailSubtitleClass = "mt-1.5 text-[11px] text-text-muted";

export const sourceDetailBodyClass =
  `flex flex-col gap-field-gap px-md py-md ${detailDialogScrollBodyClass}`;

export const sourceDetailErrorBannerClass =
  "whitespace-pre-wrap rounded-[10px] border border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-[10px_12px] text-body leading-normal text-error";

export const sourceDetailFooterClass =
  "flex justify-end gap-sm border-t border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-md pb-md pt-md";

export const sourceDetailCardTitleClass =
  "mb-sm text-[10px] font-bold uppercase tracking-wide text-text-muted";

export const rssDetailHeroClass =
  "rounded-md border border-[color-mix(in_srgb,var(--accent)_25%,var(--surface-border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-card))] p-[14px_16px]";

export const rssDetailHeroLabelClass = sourceDetailCardTitleClass;

export const rssDetailHeroUrlClass =
  "break-all text-body leading-relaxed text-text-primary";

export const rssDetailPollStatusClass =
  "flex flex-wrap gap-x-md gap-y-[10px] text-[11px] text-text-secondary";

export const discordDetailGuildClass =
  "overflow-hidden rounded-[10px] border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] [&+&]:mt-[10px]";

export const discordDetailGuildNameClass =
  "border-b border-[color-mix(in_srgb,var(--surface-border)_85%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_70%,transparent)] px-md py-sm text-[11px] font-bold text-text-primary";

export const discordDetailChannelListClass =
  "m-0 list-disc py-sm pl-6 pr-md text-[11px] leading-normal text-text-secondary";

export const emailDetailHeroClass =
  "rounded-[10px] border border-[color-mix(in_srgb,var(--accent)_22%,var(--surface-border))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface-card))] p-[12px_14px]";

export const emailDetailHeroLabelClass = rssDetailHeroLabelClass;

export const emailDetailHeroValueClass =
  "break-all text-body font-semibold text-text-primary";

export const emailDetailFolderListClass =
  "m-0 flex list-none flex-col gap-1.5 p-0";

export const emailDetailFolderItemClass =
  "flex justify-between gap-sm rounded-md border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_65%,transparent)] p-[8px_10px] text-[11px]";

export const emailDetailFolderCursorClass = "font-mono text-text-muted";

export const sourceDetailMonoHeroClass =
  "break-all rounded-[10px] border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_70%,transparent)] p-[12px_14px] font-mono text-body";
