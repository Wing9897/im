/** Shared Tailwind class strings for detail dialog shell / preview chrome. */

/** Modal / drawer shell — no flex-1 (would stretch inside overlay flex center). */
export const detailDialogShellClass = "flex min-h-0 shrink-0 flex-col";

/** Inline preview panel inner column — may grow within split pane. */
export const detailDialogFlexColClass = "flex min-h-0 flex-1 flex-col";

export const detailDialogModalShellClass =
  "im-dialog-shell im-material-glass relative flex min-w-0 max-h-[min(78vh,640px)] shrink-0 grow-0 flex-col overflow-hidden";

export const detailDialogDrawerShellClass =
  "im-dialog-shell im-dialog-drawer im-material-solid relative flex h-full min-h-0 max-h-[min(92vh,800px)] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden";

export const detailDialogDrawerOverlayClass =
  "items-stretch justify-end bg-[color-mix(in_srgb,var(--surface-base)_45%,transparent)] backdrop-blur-[8px]";

export const detailDialogCloseClass =
  "absolute right-sm top-sm z-[2] inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary";

export const detailDialogScrollBodyClass = "im-auto-scrollbar min-h-0 overflow-y-auto";
