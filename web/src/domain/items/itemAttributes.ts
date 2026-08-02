/**
 * Soft-template attribute partitioning for items forms.
 * Suggested keys come from the category; extras are never silently dropped.
 */

import type { ItemFieldSchemaEntry } from "../../api/items";

export type AttributePartitions = {
  suggested: Array<{ key: string; label: string; value: string }>;
  other: Array<{ key: string; value: string }>;
};

/** Split attributes into category-suggested vs other filled keys. */
export function partitionItemAttributes(
  attributes: Record<string, string> | null | undefined,
  fieldSchema: readonly ItemFieldSchemaEntry[] | null | undefined,
): AttributePartitions {
  const attrs = attributes ?? {};
  const schema = fieldSchema ?? [];
  const suggestedKeys = new Set(schema.map((entry) => entry.key));
  const suggested = schema.map((entry) => ({
    key: entry.key,
    label: entry.label || entry.key,
    value: attrs[entry.key] ?? "",
  }));
  const other = Object.entries(attrs)
    .filter(([key, value]) => !suggestedKeys.has(key) && String(value ?? "").length > 0)
    .map(([key, value]) => ({ key, value: String(value) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return { suggested, other };
}

/**
 * When switching categories: keep all attributes; only fill default remind
 * when the current remind value is empty/null.
 */
export function resolveRemindOnCategoryChange(opts: {
  currentRemind: number | null | undefined;
  categoryDefault: number | null | undefined;
}): number | null {
  if (opts.currentRemind != null && Number.isFinite(opts.currentRemind)) {
    return opts.currentRemind;
  }
  if (opts.categoryDefault != null && Number.isFinite(opts.categoryDefault)) {
    return opts.categoryDefault;
  }
  return null;
}

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
 * `remindBeforeDays` drives the "soon" window (fallback 7), matching list filters.
 */
export function expiryTone(
  days: number | null,
  remindBeforeDays?: number | null,
): ExpiryTone {
  if (days == null) return "none";
  if (days < 0) return "overdue";
  const window =
    remindBeforeDays != null && Number.isFinite(remindBeforeDays) ? remindBeforeDays : 7;
  if (days <= window) return "soon";
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
