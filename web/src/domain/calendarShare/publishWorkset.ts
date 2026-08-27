/**
 * Publish a local workset: IC write is the success signal.
 * List/catalog refresh is secondary and must not turn a completed upload into a failure.
 */

import {
  fetchCalendarSharePublish,
  fetchCalendarSharePublishList,
  putCalendarSharePublish,
  type CalendarSharePublishBody,
  type CalendarSharePublishListItem,
  type CalendarSharePublishState,
} from "../../api/calendarShare";
import { invalidateCalendarShareCatalog } from "./useCalendarShareCatalog";

export const PUBLISH_LIST_RETRY_ATTEMPTS = 3;

export type CalendarSharePublishResult = {
  published: boolean;
  listSynced: boolean;
  state: CalendarSharePublishState;
  items: CalendarSharePublishListItem[];
};

export type CalendarSharePublishHint = {
  worksetName?: string;
  emoji?: string;
  description?: string;
  worksetMissing?: boolean;
};

export function isListedPublish(row: Pick<CalendarSharePublishListItem, "slug">): boolean {
  return row.slug.trim().length > 0;
}

function slugMatches(row: Pick<CalendarSharePublishListItem, "worksetId" | "slug">, worksetId: string, slug: string): boolean {
  return row.worksetId === worksetId && row.slug === slug;
}

function optimisticItem(
  state: CalendarSharePublishState,
  hint?: CalendarSharePublishHint,
): CalendarSharePublishListItem {
  return {
    ...state,
    worksetName: hint?.worksetName ?? "",
    worksetMissing: hint?.worksetMissing ?? false,
    emoji: hint?.emoji ?? "",
    description: hint?.description ?? "",
  };
}

function mergeListed(
  items: CalendarSharePublishListItem[],
  fallback: CalendarSharePublishListItem,
): CalendarSharePublishListItem[] {
  const listed = items.filter(isListedPublish);
  if (listed.some((row) => slugMatches(row, fallback.worksetId, fallback.slug))) {
    return listed;
  }
  if (!isListedPublish(fallback)) return listed;
  return [...listed, fallback];
}

async function recoverPublishedState(
  worksetId: string,
  slug: string,
): Promise<CalendarSharePublishState | null> {
  try {
    const current = await fetchCalendarSharePublish(worksetId);
    if (current.slug === slug && !current.lastError && current.lastSyncAt) {
      return current;
    }
  } catch {
    return null;
  }
  return null;
}

async function syncPublishedList(
  worksetId: string,
  slug: string,
  fallback: CalendarSharePublishListItem,
): Promise<{ items: CalendarSharePublishListItem[]; listSynced: boolean }> {
  for (let attempt = 0; attempt < PUBLISH_LIST_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const list = await fetchCalendarSharePublishList();
      const listed = (list.items ?? []).filter(isListedPublish);
      if (listed.some((row) => slugMatches(row, worksetId, slug))) {
        return { items: listed, listSynced: true };
      }
    } catch {
      // 404 / 429 / timeout: retry, then fall back to the optimistic row.
    }
  }
  return { items: mergeListed([], fallback), listSynced: false };
}

async function refreshCatalogQuietly(): Promise<void> {
  try {
    await invalidateCalendarShareCatalog();
  } catch {
    // Catalog is not the published list; a stale handle prefix is milder than a false failure.
  }
}

function isPublishedState(state: CalendarSharePublishState): boolean {
  return Boolean(state.slug.trim().length > 0 && !state.lastError);
}

/** PUT publish mapping + snapshot, then refresh 我的發佈 without treating list errors as write failure. */
export async function runCalendarSharePublishPut(
  worksetId: string,
  body: CalendarSharePublishBody,
  hint?: CalendarSharePublishHint,
): Promise<CalendarSharePublishResult> {
  let state: CalendarSharePublishState;
  try {
    state = await putCalendarSharePublish(worksetId, body);
  } catch (error) {
    const recovered = await recoverPublishedState(worksetId, body.slug);
    if (!recovered) throw error;
    state = recovered;
  }

  const published = isPublishedState(state);
  await refreshCatalogQuietly();
  const fallback = optimisticItem(state, hint);
  if (!published) {
    try {
      const list = await fetchCalendarSharePublishList();
      return {
        published: false,
        listSynced: true,
        state,
        items: (list.items ?? []).filter(isListedPublish),
      };
    } catch {
      return { published: false, listSynced: false, state, items: [] };
    }
  }

  const synced = await syncPublishedList(worksetId, state.slug, fallback);
  return { published: true, listSynced: synced.listSynced, state, items: synced.items };
}
