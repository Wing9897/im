/**
 * Soft-template attribute partitioning for items forms.
 * Category `fieldSchema` is a create-time preset (copy-on-create on the server);
 * editing the category later does not rewrite existing items' attributes.
 * Suggested keys come from the category; extras are never silently dropped.
 */

import type { ItemFieldSchemaEntry } from "../../api/items";

/** Reserved for linked-calendar「到期」/ Expires — not free attribute keys. */
export const RESERVED_ATTRIBUTE_KEYS = new Set(["到期", "Expires"]);

export function isReservedAttributeKey(key: string): boolean {
  return RESERVED_ATTRIBUTE_KEYS.has(key.trim());
}

export function findReservedAttributeKeys(keys: Iterable<string>): string[] {
  return [...keys].map((k) => k.trim()).filter((k) => k && isReservedAttributeKey(k));
}

export type AttributePartitions = {
  suggested: Array<{ key: string; label: string; value: string }>;
  other: Array<{ key: string; value: string }>;
};

/**
 * Copy-on-create helper: add missing category preset keys with empty values.
 * Does not overwrite existing keys. Safe to call when switching categories on create.
 */
export function seedAttributesFromFieldSchema(
  attributes: Record<string, string> | null | undefined,
  fieldSchema: readonly ItemFieldSchemaEntry[] | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = { ...(attributes ?? {}) };
  for (const entry of fieldSchema ?? []) {
    const key = String(entry.key ?? "").trim();
    if (!key || key in out || isReservedAttributeKey(key)) continue;
    out[key] = "";
  }
  return out;
}

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
