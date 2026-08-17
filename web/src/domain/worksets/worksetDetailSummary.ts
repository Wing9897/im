/**
 * Pure selectors for workset contents glance summary.
 * Reuses item remind/overdue semantics — no parallel calendar projection.
 */

import type { TrackableItem } from "../../api/items";
import type { UserEvent } from "../../api/userEvents";
import { daysUntil } from "../items/itemExpiryTone";
import { isItemExpiringSoon, isItemOverdue } from "../items/categoryAggregates";
import { getOsTimeMs } from "../../utils/time";

/** Max rows per summary list on the workset contents tab. */
export const WORKSET_SUMMARY_LIMIT = 5;

/** Recent past window for user-event summary (days before local today). */
export const WORKSET_EVENTS_LOOKBACK_DAYS = 7;

/** Upcoming window for user-event summary (days after local today). */
export const WORKSET_EVENTS_AHEAD_DAYS = 30;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

/** ISO window for `listUserEventsPage({ start, end, worksetId })`. */
export function worksetEventsQueryWindow(now = new Date()): { start: string; end: string } {
  const today = startOfLocalDay(now);
  const start = addLocalDays(today, -WORKSET_EVENTS_LOOKBACK_DAYS);
  const end = addLocalDays(today, WORKSET_EVENTS_AHEAD_DAYS + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Active items that are overdue or inside their remind window.
 * Sort: overdue first (most overdue), then soon (soonest expiry). Cap at `limit`.
 */
export function selectSummaryExpiringItems(
  items: readonly TrackableItem[],
  limit = WORKSET_SUMMARY_LIMIT,
  today = new Date(),
): TrackableItem[] {
  const flagged = items.filter(
    (row) => row.status !== "archived" && (isItemOverdue(row) || isItemExpiringSoon(row)),
  );
  flagged.sort((a, b) => {
    const da = daysUntil(a.expiresAt, today) ?? Number.POSITIVE_INFINITY;
    const db = daysUntil(b.expiresAt, today) ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
  return flagged.slice(0, Math.max(0, limit));
}

/**
 * Non-dismissed user events in the lookback/ahead window, chronological, capped.
 */
export function selectSummaryUserEvents(
  events: readonly UserEvent[],
  opts?: { limit?: number; now?: Date },
): UserEvent[] {
  const limit = opts?.limit ?? WORKSET_SUMMARY_LIMIT;
  const now = opts?.now ?? new Date();
  const { start, end } = worksetEventsQueryWindow(now);
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  const inWindow = events.filter((row) => {
    if (row.dismissed) return false;
    const ms = getOsTimeMs(row.startTime);
    if (!Number.isFinite(ms)) return false;
    return ms >= startMs && ms < endMs;
  });

  inWindow.sort((a, b) => getOsTimeMs(a.startTime) - getOsTimeMs(b.startTime));
  return inWindow.slice(0, Math.max(0, limit));
}
