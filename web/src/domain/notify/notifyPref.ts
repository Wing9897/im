/** Per-row reminder: inherit the workset default, or mute this entity. */

export const NOTIFY_PREFS = ["inherit", "off"] as const;

export type NotifyPref = (typeof NOTIFY_PREFS)[number];

export const DEFAULT_NOTIFY_PREF: NotifyPref = "inherit";

/** Calendar / item-linked event create (unchecked 通知). Tasks stay ``inherit``. */
export const DEFAULT_CALENDAR_NOTIFY_PREF: NotifyPref = "off";

export function isNotifyPref(value: unknown): value is NotifyPref {
  return value === "inherit" || value === "off";
}

/**
 * Blank / unknown → ``fallback`` (default ``inherit``). Never throws.
 * HTTP ``"follow"`` / ``"on"`` are 422 on write; read-side coerce treats them as unknown → default.
 */
export function normalizeNotifyPref(
  value: unknown,
  fallback: NotifyPref = DEFAULT_NOTIFY_PREF,
): NotifyPref {
  if (isNotifyPref(value)) return value;
  if (typeof value === "string") {
    const text = value.trim();
    if (isNotifyPref(text)) return text;
  }
  return fallback;
}

/** Checked checkbox = participate / inherit workset. */
export function notifyPrefChecked(value: unknown): boolean {
  return normalizeNotifyPref(value) !== "off";
}

export function notifyPrefFromChecked(checked: boolean): NotifyPref {
  return checked ? "inherit" : "off";
}
