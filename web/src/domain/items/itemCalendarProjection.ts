/**
 * Project trackable items into timeline rows (purchased / expires DATE → all-day).
 * remind_before_days never creates a calendar point.
 */

import type { TrackableItem } from "../../api/items";
import type { TimelineItem } from "../../types";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

export type ItemDateKind = "purchased" | "expires";

function floatingAllDayIso(dateStr: string): { startTime: string; endTime: string } {
  // Keep YYYY-MM-DD prefix so parseAllDayWallDate stays on the calendar day.
  const day = dateStr.slice(0, 10);
  return {
    startTime: `${day}T00:00:00`,
    endTime: `${day}T23:59:59`,
  };
}

export function itemOccurrenceId(itemId: string, kind: ItemDateKind): string {
  return `item:${itemId}:${kind}`;
}

export function projectItemToTimelineItems(
  item: TrackableItem,
  opts?: { purchasedPrefix?: string; expiresPrefix?: string },
): TimelineItem[] {
  if (item.status !== "active") return [];
  const purchasedPrefix = opts?.purchasedPrefix ?? "購入";
  const expiresPrefix = opts?.expiresPrefix ?? "到期";
  const worksetId = item.worksetId?.trim() || SYSTEM_WORKSET_ID;
  const out: TimelineItem[] = [];
  const specs: Array<{ kind: ItemDateKind; date: string | null | undefined; prefix: string }> = [
    { kind: "purchased", date: item.purchasedAt, prefix: purchasedPrefix },
    { kind: "expires", date: item.expiresAt, prefix: expiresPrefix },
  ];
  for (const spec of specs) {
    if (!spec.date || !/^\d{4}-\d{2}-\d{2}/.test(spec.date)) continue;
    const { startTime, endTime } = floatingAllDayIso(spec.date);
    out.push({
      id: itemOccurrenceId(item.id, spec.kind),
      taskId: null,
      version: 1,
      batchId: "",
      title: `${spec.prefix} · ${item.title}`,
      body: item.notes ?? "",
      startTime,
      endTime,
      location: null,
      latitude: null,
      longitude: null,
      participants: [],
      sourceMessageId: null,
      sourcePlatform: null,
      sourceChannelName: null,
      sourceMessageTime: null,
      analysisTimeRange: null,
      batchSourceChannelNames: [],
      taskName: null,
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? null,
      source: "item",
      isAllDay: true,
      timezone: "floating",
      worksetId,
      dismissed: false,
    });
  }
  return out;
}
