import { pageTitleClass } from "./pageTypography";

/**
 * Shared sticky page chrome tokens (Items + Chat editor toolbar).
 * Full-bleed outer strip; inner row capped at max-w-[1280px].
 * Never use max-w-3xl. Not OpsControlBar — Settings/Ops chrome stay separate.
 *
 * Page fills: use ``pageShellGridClass`` / ``stickyChromePageFillClass`` here;
 * Items markers (``items-page-fill`` / ``item-form-page-fill``) live in
 * ``itemsPageChromeClasses`` and compose the same grid base — do not fork a
 * third ``im-page-shell`` fill string.
 */

/** Shared form/list body width used by sticky chrome inner rows. */
export const pageChromeMaxWidthClass = "max-w-[1280px]";

/** Outer sticky band (border / blur / z-index) — uses --surface-chrome layer. */
export const pageChromeOuterClass =
  "im-surface-chrome sticky top-0 z-[100] shrink-0 border-b border-surface-border shadow-[var(--shadow-sm)]";

/**
 * Inner row — `flex-wrap` keeps entry filters in one band when the strip is narrow.
 * Cap matches Items list / form body (`pageChromeMaxWidthClass`).
 */
export const pageChromeInnerClass =
  `mx-auto flex w-full min-w-0 ${pageChromeMaxWidthClass} flex-wrap items-center gap-sm px-page-x py-sm`;

/** Back + title cluster when the strip has no mid-row controls. */
export const pageChromeTitleClusterClass =
  "flex min-w-0 flex-1 items-center gap-sm";

export const pageChromeBackButtonClass = "shrink-0";

export const pageChromeTitleClass = `min-w-0 truncate ${pageTitleClass}`;

/** Right-side actions (primary / secondary sm buttons). */
export const pageChromeActionsClass =
  "relative z-[1] ml-auto flex shrink-0 flex-wrap items-center justify-end gap-sm";

/**
 * Shared ``im-page-shell`` grid for sticky-chrome / Items page fills.
 * Do not put overflow-hidden here — it creates a backdrop root that blocks child
 * ``backdrop-filter`` from sampling the photo. Inner pane owns ``overflow-y-auto``
 * + ``min-h-0``.
 */
export const pageShellGridClass =
  "im-page-shell grid min-h-0 w-full min-w-0 grid-rows-[auto_1fr]";

/**
 * Sticky chrome + scroll-body editors (Chat editor / recurring series).
 * Height accounts for the app top bar; Items browse/form use ``pageShellGridClass``
 * + ``h-full`` via ``itemsPageChromeClasses``.
 */
export const stickyChromePageFillClass =
  `${pageShellGridClass} h-[calc(100vh-var(--app-top-bar-height,48px))]`;
