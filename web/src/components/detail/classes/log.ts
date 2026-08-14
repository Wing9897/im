/** Log detail dialog class strings (domain-unique only). */

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

export const logDetailEyebrowClass =
  "mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted";

export const logDetailBodyClass =
  `flex flex-col gap-md bg-[color-mix(in_srgb,var(--surface-base)_40%,transparent)] px-md py-[14px] pb-[18px] ${detailDialogScrollBodyClass}`;

export const logDetailPreLabelClass =
  "mb-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-text-muted";

export const logDetailPreBlockClass =
  "im-surface-inset m-0 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-[color-mix(in_srgb,var(--surface-border)_85%,transparent)] p-[12px_14px] font-mono text-[11px] leading-normal text-text-primary";
