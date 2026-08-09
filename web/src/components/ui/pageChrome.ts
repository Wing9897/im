import { pageTitleClass } from "./pageTypography";

/**
 * Shared sticky page chrome tokens (Items + Chat editor toolbar).
 * Full-bleed outer strip; inner row capped at max-w-[1280px].
 * Never use max-w-3xl. Not OpsControlBar — Settings/Ops chrome stay separate.
 */

/** Shared form/list body width used by sticky chrome inner rows. */
export const pageChromeMaxWidthClass = "max-w-[1280px]";

/** Outer sticky band (border / blur / z-index). */
export const pageChromeOuterClass =
  "sticky top-0 z-[100] shrink-0 border-b border-surface-border bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)] shadow-[var(--shadow-sm)] backdrop-blur-[8px]";

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
