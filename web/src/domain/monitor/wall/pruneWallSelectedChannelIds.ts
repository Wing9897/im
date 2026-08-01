/**
 * Drop wall selections that no longer exist in the channel catalog.
 * Returns ``null`` when ``selected`` is already clean (same order / members).
 */
export function pruneWallSelectedChannelIds(
  selected: readonly string[],
  knownChannelIds: ReadonlySet<string>,
): string[] | null {
  const next = selected.filter((id) => knownChannelIds.has(id));
  if (next.length === selected.length && next.every((id, index) => id === selected[index])) {
    return null;
  }
  return next;
}
