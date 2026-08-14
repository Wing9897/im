import { dialogShellClass } from "../dialogs/dialogShellClasses";

/** Wider / taller shell so more compact template cards fit on screen. */
export const presetDialogContainerClass =
  `${dialogShellClass} flex max-h-[min(88vh,860px)] w-[min(960px,calc(100vw-32px))] max-w-[min(960px,calc(100vw-32px))] flex-col`;

export const presetDialogFilterGridClass = "mb-md grid gap-sm";

export const presetDialogFilterChipRowClass = "flex flex-wrap gap-sm";

export const presetDialogSearchGridClass = "grid gap-xs";

export const presetDialogSearchInputClass =
  "im-surface-inset w-full rounded-[10px] border border-surface-border px-md py-2 text-[13px] text-text-primary outline-none focus:border-accent focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_20%,transparent)]";

export const presetDialogScrollableClass =
  "min-h-0 flex-1 overflow-y-auto pr-xs";

export const presetDialogGroupGridClass = "grid gap-md";

/** Dense auto-fill grid for template cards. */
export const presetDialogTileGridColumns =
  "repeat(auto-fill, minmax(200px, 1fr))";
