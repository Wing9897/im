/**
 * Expiry tone helpers and empty-state helpers for the items UI.
 * Free-form details live in notes (no soft attributes / fieldSchema).
 */

export function daysUntil(expiresAt: string | null | undefined, today = new Date()): number | null {
  if (!expiresAt) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(expiresAt);
  if (!match) return null;
  const expiry = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((expiry.getTime() - start.getTime()) / 86_400_000);
}

export type ExpiryTone = "ok" | "soon" | "overdue" | "none";

/**
 * Color step for remaining days.
 * `remindBeforeDays` drives the "soon" window (must be > 0), matching server
 * calendar/remind projection — null / missing / ≤0 means no soon window.
 */
export function expiryTone(
  days: number | null,
  remindBeforeDays?: number | null,
): ExpiryTone {
  if (days == null) return "none";
  if (days < 0) return "overdue";
  if (
    remindBeforeDays == null ||
    !Number.isFinite(remindBeforeDays) ||
    remindBeforeDays <= 0
  ) {
    return "ok";
  }
  if (days <= remindBeforeDays) return "soon";
  return "ok";
}

/** AccentBar class for item expiry rail (shared by ItemsEntryCard). */
export function expiryToneAccentClass(tone: ExpiryTone): string {
  if (tone === "overdue") return "bg-error";
  if (tone === "soon") return "bg-warning";
  if (tone === "ok") return "bg-success";
  return "bg-text-muted";
}

/** Badge tone for item expiry chips (shared by ItemsEntryCard). */
export function expiryToneBadgeTone(
  tone: ExpiryTone,
): "danger" | "warning" | "success" | "neutral" {
  if (tone === "overdue") return "danger";
  if (tone === "soon") return "warning";
  if (tone === "ok") return "success";
  return "neutral";
}

/** True-empty inventory vs filter/search miss (for empty-state copy). */
export function itemsEmptyKind(opts: {
  totalCount: number;
  filteredCount: number;
}): "none" | "true-empty" | "filtered-empty" {
  if (opts.filteredCount > 0) return "none";
  if (opts.totalCount === 0) return "true-empty";
  return "filtered-empty";
}
