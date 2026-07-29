/**
 * Timeline task multi-select: `null` = all, `[]` = none, `[…]` = subset.
 * Reads/writes only {@link TIMELINE_SELECTED_TASK_IDS_STORAGE_KEY}.
 * Virtual id {@link USER_EVENTS_FILTER_ID} may appear in the selection.
 */

import { pruneMultiSelectIds } from "../ui/pruneMultiSelectIds";
import {
  loadPersistedTaskMultiSelect,
  savePersistedTaskMultiSelect,
  type PersistedTaskMultiSelect,
} from "../ui/persistedTaskMultiSelect";
import { USER_EVENTS_FILTER_ID } from "./userEvents";

export const TIMELINE_SELECTED_TASK_IDS_STORAGE_KEY = "im:timeline:selected-task-ids";

export type TimelineSelectedTaskIds = PersistedTaskMultiSelect;

const PERSISTENCE_OPTIONS = {
  storageKey: TIMELINE_SELECTED_TASK_IDS_STORAGE_KEY,
  emptyArray: "preserve",
} as const;

/** Parse persisted multi-select. */
export function loadTimelineSelectedTaskIds(): TimelineSelectedTaskIds {
  return loadPersistedTaskMultiSelect(PERSISTENCE_OPTIONS);
}

export function saveTimelineSelectedTaskIds(ids: TimelineSelectedTaskIds): void {
  savePersistedTaskMultiSelect(PERSISTENCE_OPTIONS, ids);
}

/**
 * Drop ids that are no longer in the catalog (tasks + optional `__user__`).
 * Empty catalog while loading leaves selection untouched.
 */
export function pruneTimelineSelectedTaskIds(
  selected: TimelineSelectedTaskIds,
  catalogIds: readonly string[],
): TimelineSelectedTaskIds {
  return pruneMultiSelectIds(selected, catalogIds);
}

/** Catalog ids for prune: assignable timeline tasks + user/assistant sentinel. */
export function timelineFilterCatalogIds(timelineTaskIds: readonly string[]): string[] {
  return [...timelineTaskIds, USER_EVENTS_FILTER_ID];
}
