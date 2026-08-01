/** Detail atom class strings (metrics / meta / content / tags). */

export const detailMetricsRowClass =
  "grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-[10px]";

export const detailMetricsTileClass =
  "rounded-[10px] border border-[color-mix(in_srgb,var(--accent)_18%,var(--surface-border))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface-card))] px-md py-[10px] text-center";

export const detailMetricsLabelClass =
  "mb-1 text-[11px] font-semibold text-text-muted";

export const detailMetricsValueClass =
  "text-[20px] font-bold leading-tight tabular-nums text-text-primary";

export const detailContentSectionClass = "mb-[14px] last:mb-0";

export const detailContentSectionTitleClass =
  "mb-sm text-[11px] font-bold uppercase tracking-wide text-text-muted";

export const detailMetaGridClass =
  "grid grid-cols-2 gap-[10px] max-[560px]:grid-cols-1";

export const detailMetaGridItemClass =
  "min-w-0 rounded-[10px] border border-[color-mix(in_srgb,var(--surface-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_65%,transparent)] p-[10px_12px]";

export const detailMetaGridItemWideClass = "col-span-full";

export const detailMetaGridLabelClass =
  "mb-1 text-[11px] font-semibold text-text-muted";

export const detailMetaGridValueClass =
  "whitespace-pre-wrap break-words text-[13px] leading-normal text-text-primary";

export const detailTagListClass = "flex flex-wrap gap-1.5";

export const detailTagListTagClass =
  "rounded-md bg-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-sm py-0.5 text-xs text-text-secondary";
