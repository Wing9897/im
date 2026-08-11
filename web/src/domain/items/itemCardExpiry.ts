/**
 * List / card expiry display for trackable items.
 *
 * Write-path SoT: linked ``user_events`` with ``kind=expires`` (Items form
 * 「關聯日曆」). Title presets 到期／Expires are UX only. The server
 * derives ``item.expiresAt`` / ``remindBeforeDays`` on read from the primary
 * active linked expiry (no denormalized item columns).
 *
 * Card badges are **derived day-count status** (剩 N 天 / 過期 N 天) — not the
 * linked calendar event title. Category chips are separate. When
 * ``expiresAt`` is null (no active ``kind=expires``), show 無到期日 and no day badge.
 */

import type { TrackableItem } from "../../api/items";
import { daysUntil, expiryTone, type ExpiryTone } from "./itemExpiryTone";

export type ItemCardExpiry = {
  /** YYYY-MM-DD from derived item.expiresAt (primary linked kind=expires). */
  expiresAt: string | null;
  days: number | null;
  tone: ExpiryTone;
};

/** Derive card subtitle + badge tone from the item wire row. */
export function resolveItemCardExpiry(
  item: Pick<TrackableItem, "expiresAt" | "remindBeforeDays">,
  today = new Date(),
): ItemCardExpiry {
  const expiresAt =
    typeof item.expiresAt === "string" && item.expiresAt.trim()
      ? item.expiresAt.trim()
      : null;
  const days = daysUntil(expiresAt, today);
  return {
    expiresAt,
    days,
    tone: expiryTone(days, item.remindBeforeDays),
  };
}

/** Card body line — never bare YYYY-MM-DD; prefix linked expiry when present. */
export function itemCardExpirySubtitle(
  expiry: ItemCardExpiry,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!expiry.expiresAt) return t("noExpiry");
  return t("linkedExpiryOn", { date: expiry.expiresAt });
}

/** Unified expiry badge label for item cards (剩 N 天 / 過期 N 天 / 即將到期). */
export function itemExpiryBadgeLabel(
  expiry: ItemCardExpiry,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  const { days, tone } = expiry;
  if (days == null) return null;
  if (tone === "overdue") return t("daysOverdue", { count: Math.abs(days) });
  if (tone === "soon") return t("expiringSoon");
  return t("daysLeft", { count: days });
}
