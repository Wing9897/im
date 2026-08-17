/** Per-row reminder: follow the workset default, or mute this entity. */

export const NOTIFY_PREFS = ["follow", "off"] as const;

export type NotifyPref = (typeof NOTIFY_PREFS)[number];

export const DEFAULT_NOTIFY_PREF: NotifyPref = "follow";

/** Calendar / item-linked event create (unchecked 通知). Tasks stay ``follow``. */
export const DEFAULT_CALENDAR_NOTIFY_PREF: NotifyPref = "off";

export function isNotifyPref(value: unknown): value is NotifyPref {
  return value === "follow" || value === "off";
}

/**
 * Blank / unknown → ``fallback`` (default ``follow``). Never throws.
 * Legacy ``on`` is unknown (not a synonym).
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

/** Checked checkbox = participate / follow workset. */
export function notifyPrefChecked(value: unknown): boolean {
  return normalizeNotifyPref(value) !== "off";
}

export function notifyPrefFromChecked(checked: boolean): NotifyPref {
  return checked ? "follow" : "off";
}
