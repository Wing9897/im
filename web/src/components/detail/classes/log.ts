/** Log detail dialog class strings. */

import { detailDialogScrollBodyClass } from "./shell";

export const logDetailShellClass = "flex min-w-0 flex-col";

export function logLevelBarClass(level: "info" | "success" | "warning" | "error"): string {
  const tone =
    level === "success"
      ? "bg-success"
      : level === "warning"
        ? "bg-warning"
        : level === "error"
          ? "bg-error"
          : "bg-info";
  return `h-1 shrink-0 ${tone}`;
}

export const logDetailHeaderClass =
  "border-b border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-md pb-md pt-md pr-12 font-mono";

export const logDetailEyebrowClass =
  "mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted";

export const logDetailTitleClass =
  "m-0 break-words text-card-title font-bold leading-snug text-text-primary";

export const logDetailBodyClass =
  `flex flex-col gap-md bg-[color-mix(in_srgb,var(--surface-base)_40%,transparent)] px-md py-[14px] pb-[18px] ${detailDialogScrollBodyClass}`;

export const logDetailPreLabelClass =
  "mb-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-text-muted";

export const logDetailPreBlockClass =
  "m-0 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-[color-mix(in_srgb,var(--surface-border)_85%,transparent)] bg-[color-mix(in_srgb,var(--surface-base)_82%,var(--surface-card))] p-[12px_14px] font-mono text-[11px] leading-normal text-text-primary";

export const logDetailFooterClass =
  "flex justify-end border-t border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-md pb-md pt-md";
