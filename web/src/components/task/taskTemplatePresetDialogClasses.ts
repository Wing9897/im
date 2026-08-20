import { dialogShellClass } from "../dialogs/dialogShellClasses";

/** Frozen shell: same width/height when switching tabs or selecting a card. */
export const presetDialogContainerClass =
  `${dialogShellClass} box-border flex h-[min(88vh,860px)] w-[min(960px,calc(100vw-32px))] max-w-[min(960px,calc(100vw-32px))] flex-col`;

/** Inner body: sticky filters; only the card list scrolls. */
export const presetDialogBodyClass = "im-preset-dialog-body flex min-h-0 flex-1 flex-col overflow-hidden";

export const presetDialogFilterGridClass = "mb-md grid shrink-0 gap-sm";

export const presetDialogFilterChipRowClass =
  "flex flex-nowrap gap-sm overflow-x-auto [scrollbar-gutter:stable]";

export const presetDialogSearchGridClass = "grid gap-xs";

export const presetDialogSearchInputClass =
  "im-surface-inset box-border w-full rounded-[10px] border border-surface-border px-md py-2 text-[13px] text-text-primary outline-none focus:border-accent focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_20%,transparent)]";

/** One-line status; extra filter copy ellipsizes instead of growing the grid. */
export const presetDialogStatusClass =
  "min-h-4 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-text-muted";

export const presetDialogScrollableClass =
  "im-preset-dialog-scroll min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]";

export const presetDialogGroupGridClass = "grid gap-md";

/** Dense auto-fill grid for template cards. */
export const presetDialogTileGridColumns =
  "repeat(auto-fill, minmax(200px, 1fr))";
