/**
 * Official time-window calendar read (display + notify scan): one GET merges
 * analysis, user, recurring, and item_remind. Intelligence pages and the board
 * map keep ``GET /results/events``. User-events / recurring CRUD stay on their
 * own routes for 我的日程 editors.
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";

export type CalendarWindowItem = components["schemas"]["CalendarWindowItemResponse"];
export type CalendarWindowResponse = components["schemas"]["CalendarWindowResponse"];

export type FetchCalendarWindowParams = {
  startTime: string;
  endTime: string;
  includeAnalysis?: boolean;
  includeUser?: boolean;
  includeRecurring?: boolean;
  includeItems?: boolean;
  limit?: number;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("Aborted", "AbortError");
}

function flag(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "true" : "false";
}

/** Fetches every tagged occurrence in a bounded date window (follows ``nextCursor``). */
export async function fetchCalendarWindow(
  params: FetchCalendarWindowParams,
  signal?: AbortSignal,
): Promise<CalendarWindowItem[]> {
  const items: CalendarWindowItem[] = [];
  let cursor: string | undefined;

  while (true) {
    throwIfAborted(signal);
    const query: Record<string, string> = {
      startTime: params.startTime,
      endTime: params.endTime,
    };
    const includeAnalysis = flag(params.includeAnalysis);
    const includeUser = flag(params.includeUser);
    const includeRecurring = flag(params.includeRecurring);
    const includeItems = flag(params.includeItems);
    if (includeAnalysis) query.includeAnalysis = includeAnalysis;
    if (includeUser) query.includeUser = includeUser;
    if (includeRecurring) query.includeRecurring = includeRecurring;
    if (includeItems) query.includeItems = includeItems;
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (cursor) query.cursor = cursor;

    const page = await apiClient.get<CalendarWindowResponse>(
      "/api/v1/calendar/window",
      query,
      signal ? { signal } : undefined,
    );
    items.push(...page.items);
    if (!page.nextCursor || page.items.length === 0) {
      break;
    }
    cursor = page.nextCursor;
  }

  return items;
}
