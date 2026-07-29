/**
 * Shared multi-select prune: `null` = all, `[]` = none, `[…]` = subset.
 * Drop ids missing from the live catalog; collapse a full cover back to `null`.
 * Empty catalog (still loading) leaves selection untouched.
 */
export function pruneMultiSelectIds(
  selected: string[] | null,
  catalogIds: readonly string[],
): string[] | null {
  if (selected === null) return null;
  if (catalogIds.length === 0) return selected;
  const allowed = new Set(catalogIds);
  const next = selected.filter((id) => allowed.has(id));
  // Explicit empty stays "show none"; vanished ids reset to "all".
  if (next.length === 0) return selected.length === 0 ? selected : null;
  if (next.length === catalogIds.length) return null;
  if (next.length === selected.length) return selected;
  return next;
}
