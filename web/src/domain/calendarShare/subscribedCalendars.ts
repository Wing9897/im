/**
 * Calendar-share subscription identity (`handle/slug` and `subscribed:{handle}/{slug}`).
 * Display-filter keys stay outside SourceFilterSelection.taskIds / worksetIds.
 */

export const SUBSCRIBED_SOURCE_PREFIX = "subscribed:";

export function calendarShareKey(handle: string, slug: string): string {
  return `${handle.trim()}/${slug.trim()}`;
}

/** Card title + Timeline filter row: same `handle/slug` key, emoji, and path parts. */
export type SubscribeCalendarIdentity = {
  key: string;
  label: string;
  emoji: string;
  handle: string;
  slug: string;
};

export function subscribeCalendarIdentity(row: {
  handle: string;
  slug: string;
  emoji?: string | null;
}): SubscribeCalendarIdentity {
  const handle = row.handle.trim();
  const slug = row.slug.trim();
  const key = calendarShareKey(handle, slug);
  return { key, label: key, emoji: row.emoji ?? "", handle, slug };
}

/** Map `useCalendarShareCatalog().items` onto Timeline subscribe-column rows. */
export function subscribeFilterCalendarsFromCatalog(
  items: readonly { handle: string; slug: string; emoji?: string | null }[],
): SubscribeCalendarIdentity[] {
  return items.map(subscribeCalendarIdentity);
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

/** Unified search: a `/` means path-subscribe, not `GET /search?q=`. */
export function looksLikeCalendarSharePath(raw: string): boolean {
  return raw.trim().includes("/");
}

/** Client-side Mine/Published card filter (handle, slug, workset name). */
export function matchesCalendarShareFilter(needle: string, ...fields: readonly string[]): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => field.trim().toLowerCase().includes(q));
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
  // Empty catalog (logged out / still loading): keep the persisted subset so it can
  // restore when keys return. Visibility already treats empty catalog as no events.
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

/** Timeline subscribe-column gate: logged out vs IC unreachable. */
export type SubscribeAvailability = "ok" | "loggedOut" | "offline";

/** First catalog paint before session is known — do not flash a login banner. */
export type SubscribePageStatus = "loading" | SubscribeAvailability;

/** Same grey+inert gate as the Timeline subscribe column (logged out / 502). */
export const SUBSCRIBE_UNAVAILABLE_CLASS = "pointer-events-none opacity-50";

export function isCalendarShareUnreachable(error: unknown): boolean {
  if (error == null || error === false) return false;
  if (typeof error === "object" && error !== null) {
    const status = "status" in error ? Number((error as { status?: unknown }).status) : NaN;
    if (status === 502 || status === 503 || status === 504) return true;
    const name = "name" in error ? String((error as { name?: unknown }).name) : "";
    if (name === "NetworkError") return true;
  }
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
  return /\b502\b|\b503\b|\b504\b|unreachable|failed to fetch|network error/i.test(message);
}

/** GET subscriptions/publish 404 means empty, not a chrome-worthy failure. */
export function isCalendarShareNotFound(error: unknown): boolean {
  if (error == null || error === false) return false;
  if (typeof error === "object" && error !== null) {
    const status = "status" in error ? Number((error as { status?: unknown }).status) : NaN;
    if (status === 404) return true;
    const code =
      "errorCode" in error
        ? String((error as { errorCode?: unknown }).errorCode)
        : "error_code" in error
          ? String((error as { error_code?: unknown }).error_code)
          : "";
    if (/^(not_found|NOT_FOUND|http_404)$/i.test(code)) return true;
  }
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
  return /^not found\.?$/i.test(message.trim());
}

export function resolveSubscribeAvailability(input: {
  connected?: boolean | null;
  catalogUnreachable?: boolean;
  eventsError?: unknown;
}): SubscribeAvailability {
  if (input.connected === false) return "loggedOut";
  if (input.catalogUnreachable || isCalendarShareUnreachable(input.eventsError)) return "offline";
  return "ok";
}

export function subscribePageStatus(input: {
  loading: boolean;
  connected?: boolean | null;
  unreachable?: boolean;
}): SubscribePageStatus {
  if (input.loading && input.connected == null && !input.unreachable) return "loading";
  return resolveSubscribeAvailability({
    connected: input.connected,
    catalogUnreachable: input.unreachable,
  });
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
