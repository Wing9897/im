/**
 * Special kinds on ``user_events.kind`` (wire) for **item-linked** calendars
 * (`source=user` + ``itemId``). Distinct from dialog one_off/recurring
 * ``UserEventKind``, and from timeline ``source=item`` remind projections
 * (those are not ``user_events`` and have no ``kind``).
 *
 * Hierarchy: analysis|recurring = AI/task intel; user without itemId = general
 * calendar; user+itemId = item-linked (this vocabulary); source=item = remind
 * projection only. ``kind`` drives expiry cache / finance — not UI-only labels.
 */

export const USER_EVENT_CALENDAR_KINDS = [
  "normal",
  "expires",
  "purchase_effective",
] as const;

export type UserEventCalendarKind = (typeof USER_EVENT_CALENDAR_KINDS)[number];

/** Title presets historically used by Items quick-create「到期」. */
export const LINKED_EXPIRY_TITLES = new Set(["到期", "Expires"]);

/** Title presets historically used by purchase/effective quick-create. */
export const LINKED_PURCHASE_EFFECTIVE_TITLES = new Set([
  "Purchased",
  "购入",
  "購入",
  "Effective",
  "生效",
]);

export function isLinkedExpiryTitle(title: string | null | undefined): boolean {
  return LINKED_EXPIRY_TITLES.has(String(title ?? "").trim());
}

export function isLinkedPurchaseEffectiveTitle(title: string | null | undefined): boolean {
  return LINKED_PURCHASE_EFFECTIVE_TITLES.has(String(title ?? "").trim());
}

export function normalizeUserEventCalendarKind(
  value: string | null | undefined,
): UserEventCalendarKind {
  const cleaned = String(value ?? "").trim();
  if (cleaned === "expires" || cleaned === "purchase_effective" || cleaned === "normal") {
    return cleaned;
  }
  return "normal";
}

/**
 * Authority = kind. Title fallback only when kind is missing (legacy fixtures).
 */
export function isExpiresCalendarEvent(event: {
  kind?: string | null;
  title?: string | null;
}): boolean {
  if (event.kind === "expires") return true;
  if (event.kind != null && String(event.kind).trim() !== "") return false;
  return isLinkedExpiryTitle(event.title);
}

/**
 * Authority = kind. Title fallback only when kind is missing (legacy fixtures).
 */
export function isPurchaseEffectiveCalendarEvent(event: {
  kind?: string | null;
  title?: string | null;
}): boolean {
  if (event.kind === "purchase_effective") return true;
  if (event.kind != null && String(event.kind).trim() !== "") return false;
  return isLinkedPurchaseEffectiveTitle(event.title);
}

export function quickKindToCalendarKind(
  kind: "expires" | "other" | "purchaseEffective",
): UserEventCalendarKind {
  switch (kind) {
    case "expires":
      return "expires";
    case "purchaseEffective":
      return "purchase_effective";
    case "other":
    default:
      return "normal";
  }
}
