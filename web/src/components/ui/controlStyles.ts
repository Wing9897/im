/** Shared control sizing — single source for buttons, inputs, and selects. */

export type ControlSize = "sm" | "md" | "lg";

/** Button-only sizes: `icon` for icon-only controls, `inline` for text toggles. */
export type ButtonSize = ControlSize | "icon" | "inline";

/** Base chrome shared by text inputs and selects. */
export const controlBaseClass =
  "im-surface-inset box-border w-full rounded-md border border-surface-border px-sm text-body text-text-primary outline-none transition-[border-color,box-shadow,background] duration-200 ease-out focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--surface-border))] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)] disabled:opacity-50";

export const controlSizeClass: Record<ControlSize, string> = {
  sm: "h-8 min-h-8 text-caption",
  md: "h-8 min-h-8 text-body",
  lg: "h-9 min-h-9 text-body",
};

/** Button base — pairs with sizeClass in Button.tsx. */
export const buttonBaseClass =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent font-medium font-[inherit] leading-[1.25] cursor-pointer transition-[background,color,border-color,box-shadow,transform] duration-[var(--im-duration-fast)] ease-[var(--im-easing-out)] disabled:opacity-50 disabled:cursor-not-allowed motion-safe:enabled:active:scale-[0.985]";

export const buttonSizeClass: Record<ButtonSize, string> = {
  sm: "min-h-7 px-sm text-caption font-medium",
  md: "min-h-8 px-3 text-xs font-medium",
  lg: "min-h-9 px-4 min-w-[7.5rem] text-body font-medium",
  icon: "min-h-7 px-xs text-caption font-medium",
  inline: "h-auto min-h-0 px-0 py-0 text-caption font-medium",
};

/** Shared 30px page ops toolbar field height (see `.im-page-ops-ctrl` in CSS). */
export const pageOpsControlClass = "im-page-ops-ctrl";

/** Shared 30px square icon button for page ops bars. */
export const pageOpsIconButtonClass = "im-page-ops-icon-btn";
