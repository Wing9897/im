/**
 * Shared dialog shell class strings (ModalDialog / Confirm / source auth dialogs).
 * Frost via ``im-material-panel`` — do not pair with ``bg-surface-card``.
 */

/** Base frosted dialog chrome — pair with size / padding / enter utilities. */
export const dialogShellClass = "im-dialog-shell im-material-panel";

/**
 * Compact source-tab dialogs (AddSource / Telegram verify / QR) — 380px shell.
 * Callers add ``im-animate-in-scale`` when enter motion is desired.
 */
export const compactSourceDialogShellClass =
  `${dialogShellClass} w-[380px] max-w-[90vw] rounded-xl border border-surface-border p-lg shadow-[0_24px_80px_rgba(0,0,0,0.45)]`;
