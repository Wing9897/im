import type { TimelineItem } from "../../types";

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
  return (
    event.source === "recurring" &&
    typeof event.seriesId === "string" &&
    event.seriesId.length > 0
  );
}

function seriesRowId(seriesId: string): string {
  return `recurring:${seriesId}`;
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
 * - `source === "recurring"` with `seriesId` → one row per series (many bars)
 * - everything else → one row per event
 *
 * Input order is preserved for first-seen series / singleton placement.
 * Rows then follow active-then-dismissed ordering (row dismissed iff all bars are).
 */
export function groupRecurringGanttRows(events: TimelineItem[]): GanttEventRowModel[] {
  const seriesBuckets = new Map<string, TimelineItem[]>();
  const order: Array<{ kind: "series"; seriesId: string } | { kind: "single"; event: TimelineItem }> =
    [];

  for (const event of events) {
    if (isRecurringSeries(event)) {
      const existing = seriesBuckets.get(event.seriesId);
      if (existing) {
        existing.push(event);
      } else {
        seriesBuckets.set(event.seriesId, [event]);
        order.push({ kind: "series", seriesId: event.seriesId });
      }
      continue;
    }
    order.push({ kind: "single", event });
  }

  const rows: GanttEventRowModel[] = order.map((entry) => {
    if (entry.kind === "series") {
      const occurrences = sortOccurrences(seriesBuckets.get(entry.seriesId)!);
      return {
        rowId: seriesRowId(entry.seriesId),
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
