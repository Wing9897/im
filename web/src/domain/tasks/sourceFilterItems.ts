/**
 * Client-side item filtering against hierarchical source selection.
 * Shared by board widgets and match-matrix tests (with timeline filter plan).
 *
 * Recurring / item_remind rules mirror Timeline
 * {@link resolveTimelineFilterPlan} + merge client filter:
 * workset ownership (+ seriesId against expanded task ids for legacy rows).
 */

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  isEmptySourceFilter,
  userEventMatchesSourceSelection,
  type SourceFilterSelection,
} from "./sourceFilterSelection";

/** Items filterable by hierarchical source selection. */
export type SourceFilterItem = {
  taskId?: string | null;
  worksetId?: string | null;
  sourceKind?: string | null;
  /** Timed-event discriminator; `"user"` uses ownership / provenance rules. */
  source?: string | null;
  /** Recurring series id (not analysis taskId). */
  seriesId?: string | null;
};

/**
 * Resolve ownership workset id for filter / label.
 * Only trusts wire ``worksetId`` when ``sourceKind=workset`` (no ``taskId`` fallback).
 */
export function resolveSpanWorksetId(
  item: Pick<SourceFilterItem, "worksetId" | "sourceKind">,
): string | null {
  if (item.sourceKind !== "workset") return null;
  const fromWire = item.worksetId?.trim();
  return fromWire || null;
}

/** Pure filter for board / timeline client rows against a source selection. */
export function filterItemsBySourceSelection<T extends SourceFilterItem>(
  items: T[],
  selection: SourceFilterSelection,
  memberTaskIds: Set<string> | null,
): T[] {
  if (selection === null) {
    return items;
  }
  if (isEmptySourceFilter(selection)) {
    return [];
  }
  const allowTasks = memberTaskIds ?? new Set(selection.taskIds);
  const allowExplicitTasks = new Set(selection.taskIds);
  const allowWorksets = new Set(selection.worksetIds);
  return items.filter((item) => {
    // Activity-span ownership rows: wire worksetId only (sourceKind=workset).
    if (item.sourceKind === "workset") {
      const id = resolveSpanWorksetId(item);
      return Boolean(id && allowWorksets.has(id));
    }
    // user_events: ownership workset only; provenance via explicit taskIds.
    if (item.source === "user") {
      return userEventMatchesSourceSelection(item, allowWorksets, allowExplicitTasks);
    }
    // Item remind DATE projections: workset ownership only (default __general__).
    if (item.source === "item_remind") {
      const wid = item.worksetId?.trim() || SYSTEM_WORKSET_ID;
      return allowWorksets.has(wid);
    }
    // RRULE rows: workset ownership, or seriesId in expanded task allow-set
    // (Timeline merge parity for legacy series keyed like task ids).
    if (item.source === "recurring") {
      const worksetId = item.worksetId?.trim();
      if (worksetId && allowWorksets.has(worksetId)) return true;
      const seriesId = item.seriesId?.trim();
      if (seriesId && allowTasks.has(seriesId)) return true;
      return false;
    }
    const worksetId = item.worksetId?.trim();
    if (worksetId && allowWorksets.has(worksetId)) return true;
    if (item.taskId != null && item.taskId !== "" && allowTasks.has(item.taskId)) {
      return true;
    }
    return false;
  });
}
