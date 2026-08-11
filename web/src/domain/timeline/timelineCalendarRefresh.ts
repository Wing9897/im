/**
 * Shared calendar/timeline invalidation helpers.
 *
 * Timeline and board widgets subscribe to the same SSE `resource_modified`
 * types; agent calendar writes and REST CRUD both publish through that bridge.
 */

export const TIMELINE_CALENDAR_RESOURCE_TYPES = [
  "task",
  "recurring",
  "user_event",
  "item",
  "item_category",
] as const;

export type TimelineCalendarResourceType =
  (typeof TIMELINE_CALENDAR_RESOURCE_TYPES)[number];

const TIMELINE_CALENDAR_RESOURCE_TYPE_SET = new Set<string>(
  TIMELINE_CALENDAR_RESOURCE_TYPES,
);

/** True when a `resource_modified` payload should refetch merged timeline events. */
export function shouldTimelineRefreshForResource(resourceType: string): boolean {
  return TIMELINE_CALENDAR_RESOURCE_TYPE_SET.has(resourceType);
}
