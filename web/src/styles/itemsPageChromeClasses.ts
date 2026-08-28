import {
  pageChromeActionsClass,
  pageChromeBackButtonClass,
  pageChromeInnerClass,
  pageChromeMaxWidthClass,
  pageChromeOuterClass,
  pageChromeTitleClass,
  pageChromeTitleClusterClass,
  pageShellGridClass,
} from "../components/ui/pageChrome";

/**
 * Items page chrome — shared sticky tokens + ``pageShellGridClass`` live in
 * ``components/ui/pageChrome``; Items-only layout/search/filter classes stay here.
 */

/** Items form body width — matches Items list (`max-w-[1280px]`). Do not change global `formPageMaxWidthClass` (768). */
export const itemsFormPageMaxWidthClass = pageChromeMaxWidthClass;

/** Outer sticky band (border / blur / z-index). */
export const itemsPageChromeOuterClass = pageChromeOuterClass;

/**
 * Inner row — shared ``pageChromeInnerClass``; `flex-wrap` keeps entry filters
 * in one band when the strip is narrow (category / form simply do not wrap).
 * Cap matches Items list / form body (`itemsFormPageMaxWidthClass`).
 */
export const itemsPageChromeInnerClass = pageChromeInnerClass;

/**
 * Entry-list inner row — 3-column grid at sm+ (title · controls · actions).
 * Below sm: title + actions on row 1, full-width controls on row 2 (no orphan sort).
 */
export const itemsPageChromeEntryInnerClass =
  `mx-auto grid w-full min-w-0 ${itemsFormPageMaxWidthClass} items-center gap-x-sm gap-y-sm px-md py-sm grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:grid-rows-[auto_auto]`;

/** Entry-list outer — same sticky band as category/form (clip lives on controls, not actions). */
export const itemsPageChromeEntryOuterClass = itemsPageChromeOuterClass;

/** Back + title when filters/search share the band (do not steal flex grow). */
export const itemsPageChromeTitleClusterWithControlsClass =
  "col-start-1 row-start-1 flex min-w-0 shrink-0 items-center gap-sm max-w-[7.5rem] sm:max-w-[9rem]";

/** Back + title cluster when the strip has no mid-row controls. */
export const itemsPageChromeTitleClusterClass = pageChromeTitleClusterClass;

export const itemsPageChromeBackButtonClass = pageChromeBackButtonClass;

export const itemsPageChromeTitleClass = pageChromeTitleClass;

/** Mid-band filters / search — same gap token as the chrome row. */
export const itemsPageChromeControlsClass =
  "flex min-w-0 flex-1 flex-wrap items-center gap-sm";

/** Entry-list filter chips — may shrink slightly before tools/actions wrap. */
export const itemsPageChromeEntryFiltersClass =
  "flex min-w-0 shrink items-center gap-sm";

/** Entry-list search · layout · sort — stay grouped on one line. */
export const itemsPageChromeEntryToolsClass =
  "inline-flex shrink-0 flex-nowrap items-center gap-sm";

/** Entry-list controls — single row at sm+; wrap only on very narrow viewports. */
export const itemsPageChromeEntryControlsClass =
  "col-start-2 row-start-1 flex min-w-0 max-w-full flex-nowrap items-center justify-end gap-sm overflow-x-hidden max-sm:col-span-2 max-sm:col-start-1 max-sm:row-start-2 max-sm:flex-wrap max-sm:justify-start max-sm:overflow-x-visible";

/**
 * Search in chrome: system TextField height (h-8), caption text — not the
 * 30px `.im-page-ops-ctrl` ops-bar pattern. Width lives on the search wrap.
 */
export const itemsPageChromeSearchClass =
  "!h-8 !min-h-8 !max-h-8 !w-full !py-0 !text-caption [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden";

/** Category hub search wrap — sole control; may grow up to a cap. */
export const itemsPageChromeCategorySearchWrapClass =
  "relative min-w-[10rem] max-w-[18rem] flex-1 basis-[10rem]";

/** Entry-list search wrap — compact fixed width beside layout / sort. */
export const itemsPageChromeEntrySearchWrapClass =
  "relative w-[8rem] shrink-0 sm:w-[8.5rem]";

/** Compact sort select beside search in the sticky strip. */
export const itemsPageChromeSelectClass =
  "!h-8 !min-h-8 !max-h-8 !w-auto !py-0 !text-caption shrink-0 min-w-[6.5rem]";

/**
 * Filter chips in chrome: same height as sm buttons; square radius so they
 * read as toolbar controls rather than a bolted-on pill bar.
 */
export const itemsPageChromeFilterChipClass = "!rounded-md !px-2";

/** Entry-list actions — grid column 3; icon-only manage below lg when tight. */
export const itemsPageChromeEntryActionsClass =
  "relative z-[1] col-start-3 row-start-1 flex shrink-0 flex-nowrap items-center justify-end gap-sm max-sm:col-start-2";

/** Hide action label on sub-lg entry chrome to preserve single-row density. */
export const itemsPageChromeEntryActionLabelClass = "hidden lg:inline";

/** Compact icon toggle (layout mode) — h-8 to match chrome controls. */
export const itemsPageChromeIconToggleClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_55%,transparent)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)] data-[active=true]:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] data-[active=true]:text-accent";

export const itemsPageChromeIconToggleGroupClass =
  "inline-flex shrink-0 items-center gap-0.5 rounded-md border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-raised)_40%,transparent)] p-0.5";

/** Right-side actions (primary / secondary sm buttons). */
export const itemsPageChromeActionsClass = pageChromeActionsClass;

/** Keep primary save from collapsing while the busy spinner shows. */
export const itemsPageChromePrimaryActionClass = "min-w-[4.5rem]";

/**
 * Layout shell only — atmosphere comes from `.im-page-canvas` (no opaque page island).
 * Composes shared ``pageShellGridClass`` (no overflow-hidden — see pageChrome).
 * Canvas/main already clip via ``:has(.items-page-fill)``; body scrolls in the inner pane.
 */
const itemsChromePageFillBase = `${pageShellGridClass} h-full`;

/** Browse page fill marker — paired with shared-layout.css `:has(.items-page-fill)`. */
export const itemsPageFillClass = `items-page-fill ${itemsChromePageFillBase}`;

/** Form page fill marker — paired with shared-layout.css `:has(.item-form-page-fill)`. */
export const itemFormPageFillClass = `item-form-page-fill ${itemsChromePageFillBase}`;
