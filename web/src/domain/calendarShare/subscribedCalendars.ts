/**
 * Calendar-share subscription identity (`handle/slug` and `subscribed:{handle}/{slug}`).
 * Display-filter keys stay outside SourceFilterSelection.taskIds / worksetIds.
 */

export const SUBSCRIBED_SOURCE_PREFIX = "subscribed:";

export function calendarShareKey(handle: string, slug: string): string {
  return `${handle.trim()}/${slug.trim()}`;
}

export function subscribedTimelineSource(handle: string, slug: string): string {
  return `${SUBSCRIBED_SOURCE_PREFIX}${calendarShareKey(handle, slug)}`;
}

export function isSubscribedTimelineSource(source: string | undefined): boolean {
  return typeof source === "string" && source.startsWith(SUBSCRIBED_SOURCE_PREFIX);
}

/** `handle/slug` after `subscribed:`, or null when the source is not a subscription. */
export function parseSubscribedTimelineSource(source: string | undefined): string | null {
  if (!isSubscribedTimelineSource(source)) return null;
  const path = source.slice(SUBSCRIBED_SOURCE_PREFIX.length).trim();
  return path.length > 0 ? path : null;
}

export function parseCalendarSharePath(raw: string): { handle: string; slug: string } | null {
  const parts = raw
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const handle = parts[0]?.trim() ?? "";
  const slug = parts[1]?.trim() ?? "";
  if (!handle || !slug) return null;
  return { handle, slug };
}

export function isOwnCalendarHandle(handle: string, ownHandle: string): boolean {
  const left = handle.trim();
  const right = ownHandle.trim();
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

/** `null` = all of *mine* (catalog); `[]` = none; otherwise explicit keys ∩ catalog. */
export type SubscribedCalendarSelection = string[] | null;

/** Display keys actually shown: empty catalog → none; `null` selection → all catalog keys. */
export function resolvedSubscribeKeys(
  selection: SubscribedCalendarSelection,
  catalogKeys: readonly string[],
): string[] {
  if (catalogKeys.length === 0) return [];
  if (selection === null) return [...catalogKeys];
  const allowed = new Set(catalogKeys);
  return selection.filter((key) => allowed.has(key));
}

export function parseSubscribedCalendarSelection(raw: unknown): SubscribedCalendarSelection {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) return null;
  return (raw as string[]).map((item) => item.trim()).filter((item) => item.length > 0);
}

export function pruneSubscribedCalendarSelection(
  selection: SubscribedCalendarSelection,
  catalogKeys: readonly string[],
): SubscribedCalendarSelection {
  if (selection === null) return null;
  if (catalogKeys.length === 0) return selection;
  const allowed = new Set(catalogKeys);
  const next = selection.filter((key) => allowed.has(key));
  if (next.length === selection.length && next.every((key, i) => key === selection[i])) {
    return selection;
  }
  return next;
}

export function subscribedEventVisible(
  source: string | undefined,
  selection: SubscribedCalendarSelection,
  catalogKeys: readonly string[] = [],
): boolean {
  const key = parseSubscribedTimelineSource(source);
  if (!key) return false;
  const allowed = resolvedSubscribeKeys(selection, catalogKeys);
  if (allowed.length === 0) return false;
  return allowed.includes(key);
}

export function sameSubscribeSelection(
  a: SubscribedCalendarSelection,
  b: SubscribedCalendarSelection,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.length === b.length && a.every((key) => b.includes(key));
}

export function toggleSubscribeKey(
  current: SubscribedCalendarSelection,
  key: string,
  catalog: readonly string[],
): SubscribedCalendarSelection {
  const selected = current === null ? [...catalog] : [...current];
  const index = selected.indexOf(key);
  if (index >= 0) selected.splice(index, 1);
  else selected.push(key);
  if (selected.length === catalog.length && catalog.every((item) => selected.includes(item))) {
    return null;
  }
  return selected;
}
