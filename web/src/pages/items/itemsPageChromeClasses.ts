import { pageTitleClass } from "../../components/ui/pageTypography";

/**
 * Shared Items top chrome — same sticky band language as ChatEditorToolbar
 * (full-bleed strip; inner row capped at max-w-5xl). Never use max-w-3xl.
 */

/** Outer sticky band (border / blur / z-index). */
export const itemsPageChromeOuterClass =
  "sticky top-0 z-[100] shrink-0 border-b border-surface-border bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)] shadow-[var(--shadow-sm)] backdrop-blur-[8px]";

/**
 * Inner row — matches ChatEditorToolbar; `flex-wrap` keeps entry filters in one
 * band when the strip is narrow (category / form simply do not wrap).
 */
export const itemsPageChromeInnerClass =
  "mx-auto flex w-full min-w-0 max-w-5xl flex-wrap items-center gap-sm px-page-x py-sm";

/** Back + title cluster when the strip has no mid-row controls. */
export const itemsPageChromeTitleClusterClass =
  "flex min-w-0 flex-1 items-center gap-sm";

/** Back + title when filters/search share the band (do not steal flex grow). */
export const itemsPageChromeTitleClusterWithControlsClass =
  "flex min-w-0 shrink-0 items-center gap-sm";

export const itemsPageChromeBackButtonClass = "shrink-0";

export const itemsPageChromeTitleClass = `min-w-0 truncate ${pageTitleClass}`;

/** Mid-band filters / search — same gap token as the chrome row. */
export const itemsPageChromeControlsClass =
  "flex min-w-0 flex-1 flex-wrap items-center gap-sm";

/**
 * Search in chrome: system TextField height (h-8), caption text — not the
 * 30px `.im-page-ops-ctrl` ops-bar pattern. Width lives on the search wrap.
 */
export const itemsPageChromeSearchClass =
  "!h-8 !min-h-8 !max-h-8 !w-full !py-0 !text-caption [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden";

/** Compact sort select beside search in the sticky strip. */
export const itemsPageChromeSelectClass =
  "!h-8 !min-h-8 !max-h-8 !w-auto !py-0 !text-caption shrink-0 min-w-[7.5rem]";

/**
 * Filter chips in chrome: same height as sm buttons; square radius so they
 * read as toolbar controls rather than a bolted-on pill bar.
 */
export const itemsPageChromeFilterChipClass = "!rounded-md";

/** Compact icon toggle (layout mode) — h-8 to match chrome controls. */
export const itemsPageChromeIconToggleClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_55%,transparent)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)] data-[active=true]:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] data-[active=true]:text-accent";

export const itemsPageChromeIconToggleGroupClass =
  "inline-flex shrink-0 items-center gap-0.5 rounded-md border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-raised)_40%,transparent)] p-0.5";

/** Right-side actions (primary / secondary sm buttons). */
export const itemsPageChromeActionsClass =
  "ml-auto flex shrink-0 flex-wrap items-center justify-end gap-sm";

/** Keep primary save from collapsing while the busy spinner shows. */
export const itemsPageChromePrimaryActionClass = "min-w-[4.5rem]";

const itemsChromePageFillBase =
  "grid h-full min-h-0 w-full min-w-0 grid-rows-[auto_1fr] overflow-hidden bg-[var(--surface-page,var(--surface-base))]";

/** Browse page fill marker — paired with shared-layout.css `:has(.items-page-fill)`. */
export const itemsPageFillClass = `items-page-fill ${itemsChromePageFillBase}`;

/** Form page fill marker — paired with shared-layout.css `:has(.item-form-page-fill)`. */
export const itemFormPageFillClass = `item-form-page-fill ${itemsChromePageFillBase}`;
