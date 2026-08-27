import type { TimelineItem } from "../../types";
import { isSubscribedTimelineSource } from "../calendarShare/subscribedCalendars";

/**
 * One Gantt lane: a non-recurring event, or all RRULE occurrences of one series.
 * Calendar / day / week views keep the flat occurrence list; only Gantt groups.
 */
export type GanttEventRowModel = {
  rowId: string;
  label: string;
  occurrences: TimelineItem[];
  /** True only when every occurrence in the row is dismissed. */
  dismissed: boolean;
};

function isRecurringSeries(event: TimelineItem): event is TimelineItem & { seriesId: string } {
  if (typeof event.seriesId !== "string" || event.seriesId.length === 0) return false;
  return event.source === "recurring" || isSubscribedTimelineSource(event.source);
}

/**
 * Local series keep `recurring:{seriesId}`. Subscribed series namespace by
 * `subscribed:{handle}/{slug}` so remote uids never merge with local series
 * (or with another calendar that reused the same uid).
 */
function seriesBucketKey(event: TimelineItem & { seriesId: string }): string {
  const source = event.source ?? "";
  if (isSubscribedTimelineSource(source)) return `${source}:${event.seriesId}`;
  return event.seriesId;
}

function seriesRowId(bucketKey: string): string {
  return `recurring:${bucketKey}`;
}

function rowLabel(occurrences: TimelineItem[]): string {
  const first = occurrences[0];
  return (first.title || first.taskName || "").trim();
}

function sortOccurrences(occurrences: TimelineItem[]): TimelineItem[] {
  return [...occurrences].sort(
    (left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  );
}

/**
 * Group flat timeline events into Gantt rows.
 * - `source === "recurring"` with `seriesId` → one row per local series (many bars)
 * - `subscribed:{handle}/{slug}` with `seriesId` → one row per remote series
 * - everything else (including subscribed one-offs) → one row per event
 *
 * Input order is preserved for first-seen series / singleton placement.
 * Rows then follow active-then-dismissed ordering (row dismissed iff all bars are).
 */
export function groupRecurringGanttRows(events: TimelineItem[]): GanttEventRowModel[] {
  const seriesBuckets = new Map<string, TimelineItem[]>();
  const order: Array<{ kind: "series"; bucketKey: string } | { kind: "single"; event: TimelineItem }> =
    [];

  for (const event of events) {
    if (isRecurringSeries(event)) {
      const bucketKey = seriesBucketKey(event);
      const existing = seriesBuckets.get(bucketKey);
      if (existing) {
        existing.push(event);
      } else {
        seriesBuckets.set(bucketKey, [event]);
        order.push({ kind: "series", bucketKey });
      }
      continue;
    }
    order.push({ kind: "single", event });
  }

  const rows: GanttEventRowModel[] = order.map((entry) => {
    if (entry.kind === "series") {
      const occurrences = sortOccurrences(seriesBuckets.get(entry.bucketKey)!);
      return {
        rowId: seriesRowId(entry.bucketKey),
        label: rowLabel(occurrences),
        occurrences,
        dismissed: occurrences.every((item) => Boolean(item.dismissed)),
      };
    }
    return {
      rowId: entry.event.id,
      label: rowLabel([entry.event]),
      occurrences: [entry.event],
      dismissed: Boolean(entry.event.dismissed),
    };
  });

  return rows.sort((left, right) => {
    const leftDismissed = left.dismissed ? 1 : 0;
    const rightDismissed = right.dismissed ? 1 : 0;
    if (leftDismissed !== rightDismissed) return leftDismissed - rightDismissed;
    const leftStart = new Date(left.occurrences[0].startTime).getTime();
    const rightStart = new Date(right.occurrences[0].startTime).getTime();
    return leftStart - rightStart;
  });
}
