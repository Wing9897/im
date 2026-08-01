export const mapSliderPanelClass = "flex flex-col gap-0.5 px-lg pb-1 pt-1.5";

export const mapSliderCanvasWrapClass = "relative w-full";

export const mapSliderCanvasClass = "block h-[44px] w-full";

export const mapSliderKeyboardHandleClass =
  "pointer-events-none absolute top-0 h-[44px] w-[18px] -translate-x-1/2 bg-transparent";

export const mapSliderTickRowClass = "relative h-4 overflow-hidden";

export const mapSliderTickLabelClass =
  "absolute top-0 -translate-x-1/2 whitespace-nowrap text-card-meta text-text-muted";

export const mapSliderControlRowClass = "flex flex-wrap items-center gap-2.5 text-xs";

export const mapSliderRangeLabelClass =
  "whitespace-nowrap text-caption font-semibold text-accent-pink";

export const mapSliderEventCountClass = "ml-1 text-card-meta text-text-muted";

export const mapSliderLiveBtnBaseClass =
  "cursor-pointer rounded-md border-none px-3 py-1 text-xs font-semibold tracking-wide transition-[background,color,box-shadow] duration-200";

export const mapSliderLiveBtnDisabledClass =
  "cursor-not-allowed border border-surface-border bg-transparent text-text-muted opacity-50";

export const mapSliderLiveBtnActiveClass =
  "bg-error text-[var(--text-on-accent)] shadow-[0_0_8px_var(--error)]";

export const mapSliderLiveBtnIdleClass =
  "border border-surface-border bg-transparent text-text-secondary hover:border-surface-overlay hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary";

export const mapSliderCalInputClass =
  "cursor-pointer rounded-md border border-surface-border bg-surface-base px-sm py-1 text-xs text-text-primary outline-none";
