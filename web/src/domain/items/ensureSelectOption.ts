/** Keep a controlled select value visible when its id is missing from list payloads. */
export function ensureOptionInList<T extends { id: string }>(
  items: readonly T[],
  selectedId: string | null | undefined,
  synthesize: (id: string) => T,
): T[] {
  const id = selectedId?.trim();
  if (!id || items.some((item) => item.id === id)) return [...items];
  return [...items, synthesize(id)];
}
