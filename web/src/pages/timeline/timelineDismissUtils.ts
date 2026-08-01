import type { TimelineItem } from "../../types";

/**
 * Soft-dismiss display helpers (strikethrough + day-cell prefer-active).
 *
 * INVARIANTS:
 * - Soft-dismiss (`dismissed`) is server dismissals API — not client
 *   `eventStatuses` (SQLite ui-prefs annotations).
 * - `preferActiveEvents`: default prefer active; keep dismissed only when a day
 *   has no active. With `showDismissed`, include both (active first).
 * - Callers may pre-filter out dismissed when `showDismissed` is off; with the
 *   product default on, day cells see dismissed via `preferActiveEvents`.
 */
/** Shared strikethrough chrome for soft-dismissed timeline titles. */
export const dismissedTitleClass = "text-error line-through decoration-error";

/** Shared muted card/row chrome when an event is dismissed. */
export const dismissedSurfaceClass = "opacity-60";

export function partitionDismissed(events: TimelineItem[]): {
  activeEvents: TimelineItem[];
  dismissedEvents: TimelineItem[];
} {
  const activeEvents: TimelineItem[] = [];
  const dismissedEvents: TimelineItem[] = [];
  for (const event of events) {
    if (event.dismissed) dismissedEvents.push(event);
    else activeEvents.push(event);
  }
  return { activeEvents, dismissedEvents };
}

/** Sort: active first, then dismissed; stable by startTime within each bucket. */
export function sortActiveThenDismissed(events: TimelineItem[]): TimelineItem[] {
  return [...events].sort((left, right) => {
    const leftDismissed = left.dismissed ? 1 : 0;
    const rightDismissed = right.dismissed ? 1 : 0;
    if (leftDismissed !== rightDismissed) return leftDismissed - rightDismissed;
    return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
  });
}

/**
 * Day-cell event set.
 * - Default: prefer active; keep dismissed only when a day has no active ones.
 * - `showDismissed`: include dismissed alongside active (active first).
 */
export function preferActiveEvents(
  events: TimelineItem[],
  options?: { showDismissed?: boolean },
): TimelineItem[] {
  if (options?.showDismissed) {
    return sortActiveThenDismissed(events);
  }
  const active = events.filter((event) => !event.dismissed);
  if (active.length > 0) return active;
  return events.filter((event) => Boolean(event.dismissed));
}
