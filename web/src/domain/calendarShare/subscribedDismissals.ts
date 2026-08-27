/**
 * Local-only dismiss overlay for subscribed calendar events.
 * Soft-hide stays on this device; it is never published to the public server.
 */

import type { TimelineItem } from "../../types";
import { TIMELINE_SUBSCRIBED_DISMISSALS_STORAGE_KEY } from "../prefs";
import { isSubscribedTimelineSource, SUBSCRIBED_SOURCE_PREFIX } from "./subscribedCalendars";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function eventKey(event: Pick<TimelineItem, "id" | "source">): string {
  return `${event.source ?? ""}:${event.id}`;
}

function loadMap(): Record<string, true> {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(TIMELINE_SUBSCRIBED_DISMISSALS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, true> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value) out[key] = true;
    }
    return out;
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, true>): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(TIMELINE_SUBSCRIBED_DISMISSALS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Persistence failure still leaves the in-memory merge usable on this turn.
  }
}

export function markSubscribedEventDismissed(event: TimelineItem): void {
  if (!isSubscribedTimelineSource(event.source)) return;
  const map = loadMap();
  map[eventKey(event)] = true;
  saveMap(map);
}

export function restoreSubscribedEventDismissed(event: TimelineItem): void {
  if (!isSubscribedTimelineSource(event.source)) return;
  const map = loadMap();
  delete map[eventKey(event)];
  saveMap(map);
}

export function applySubscribedDismissals(events: readonly TimelineItem[]): TimelineItem[] {
  const map = loadMap();
  return events.map((event) => {
    if (!isSubscribedTimelineSource(event.source)) return event;
    const dismissed = Boolean(map[eventKey(event)]);
    return dismissed === event.dismissed ? event : { ...event, dismissed };
  });
}

/** Drop device-local dismiss rows for calendars no longer in the subscription catalog. */
export function pruneSubscribedDismissals(catalogKeys: readonly string[]): void {
  const map = loadMap();
  const prefixes = catalogKeys.map((key) => `${SUBSCRIBED_SOURCE_PREFIX}${key}:`);
  const next: Record<string, true> = {};
  let changed = false;
  for (const [stored, value] of Object.entries(map)) {
    const keep = prefixes.some((prefix) => stored.startsWith(prefix));
    if (keep) next[stored] = value;
    else changed = true;
  }
  if (changed) saveMap(next);
}
