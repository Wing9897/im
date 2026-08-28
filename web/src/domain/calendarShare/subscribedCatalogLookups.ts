/**
 * Subscribed timeline rows: catalog lookups for publisher avatars and descriptions.
 */

import { useMemo } from "react";

import {
  calendarShareKey,
  isSubscribedTimelineSource,
  parseSubscribedTimelineSource,
} from "./subscribedCalendars";
import { useCalendarShareCatalog } from "./useCalendarShareCatalog";

export type SubscribedCatalogEventRef = {
  source?: string | null;
};

export type SubscribeDescriptionByKey = ReadonlyMap<string, string>;
export type SubscribeOwnerAvatarByHandle = ReadonlyMap<string, string>;

function lookupCatalogValueByPath(
  path: string,
  catalogByKey?: ReadonlyMap<string, string>,
): string {
  if (!catalogByKey) return "";
  const direct = catalogByKey.get(path);
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const lower = path.toLowerCase();
  for (const [key, value] of catalogByKey) {
    if (key.toLowerCase() === lower && value.trim()) return value.trim();
  }
  return "";
}

export function subscribeDescriptionByKeyFromCatalog(
  items: readonly { handle: string; slug: string; description?: string | null }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of items) {
    const description = (row.description ?? "").trim();
    if (description) {
      map.set(calendarShareKey(row.handle, row.slug), description);
    }
  }
  return map;
}

export function subscribeOwnerAvatarByHandleFromCatalog(
  items: readonly { handle: string; ownerAvatar?: string | null }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of items) {
    const handle = row.handle.trim();
    const avatar = (row.ownerAvatar ?? "").trim();
    if (!handle || !avatar) continue;
    const key = handle.toLowerCase();
    if (!map.has(key)) map.set(key, avatar);
  }
  return map;
}

export function useSubscribeCatalogLookups(): {
  subscribeOwnerAvatarByHandle: SubscribeOwnerAvatarByHandle;
  subscribeDescriptionByKey: SubscribeDescriptionByKey;
} {
  const { items } = useCalendarShareCatalog();
  const subscribeOwnerAvatarByHandle = useMemo(
    () => subscribeOwnerAvatarByHandleFromCatalog(items),
    [items],
  );
  const subscribeDescriptionByKey = useMemo(
    () => subscribeDescriptionByKeyFromCatalog(items),
    [items],
  );
  return { subscribeOwnerAvatarByHandle, subscribeDescriptionByKey };
}

function subscribedPublisherHandle(path: string): string {
  const slash = path.indexOf("/");
  if (slash <= 0) return path.trim();
  return path.slice(0, slash).trim();
}

function lookupOwnerAvatarByHandle(
  path: string,
  catalogByHandle?: SubscribeOwnerAvatarByHandle,
): string {
  if (!catalogByHandle) return "";
  const handle = subscribedPublisherHandle(path);
  if (!handle) return "";
  const direct = catalogByHandle.get(handle);
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const lower = handle.toLowerCase();
  for (const [key, value] of catalogByHandle) {
    if (key.toLowerCase() === lower && value.trim()) return value.trim();
  }
  return "";
}

/** Publisher avatar for subscribed timeline rows; empty when not a subscription row. */
export function lookupSubscribedOwnerAvatar(
  event: SubscribedCatalogEventRef,
  catalogOwnerAvatarByHandle?: SubscribeOwnerAvatarByHandle,
): string {
  if (!isSubscribedTimelineSource(event.source)) return "";
  const path = parseSubscribedTimelineSource(event.source);
  if (!path) return "";
  return lookupOwnerAvatarByHandle(path, catalogOwnerAvatarByHandle);
}

/** Publisher handle for subscribed rows (for initials fallback). */
export function lookupSubscribedPublisherHandle(event: SubscribedCatalogEventRef): string {
  if (!isSubscribedTimelineSource(event.source)) return "";
  const path = parseSubscribedTimelineSource(event.source);
  if (!path) return "";
  return subscribedPublisherHandle(path);
}

/** Catalog description for subscribed cards; empty when not a subscription row. */
export function lookupSubscribedCalendarDescription(
  event: SubscribedCatalogEventRef,
  catalogDescriptionByKey?: SubscribeDescriptionByKey,
): string {
  if (!isSubscribedTimelineSource(event.source)) return "";
  const path = parseSubscribedTimelineSource(event.source);
  if (!path) return "";
  return lookupCatalogValueByPath(path, catalogDescriptionByKey);
}
