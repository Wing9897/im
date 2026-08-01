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

/** Color step for remaining days (CSS custom property / class hint). */
export function expiryTone(days: number | null): "ok" | "soon" | "overdue" | "none" {
  if (days == null) return "none";
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  return "ok";
}
