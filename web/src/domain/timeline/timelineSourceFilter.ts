/**
 * Timeline source multi-select: `null` = all, `{ taskIds, worksetIds }` = subset.
 * Hierarchical only (legacy string[] ignored).
 */

import { makePersistedSourceFilter } from "../ui/persistedSourceFilter";
import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";

export const TIMELINE_SELECTED_SOURCES_STORAGE_KEY = "im:timeline:selected-sources";

export type TimelineSelectedSources = SourceFilterSelection;

const persisted = makePersistedSourceFilter(TIMELINE_SELECTED_SOURCES_STORAGE_KEY);

export function loadTimelineSelectedSources(): TimelineSelectedSources {
  return persisted.load();
}

export function saveTimelineSelectedSources(selection: TimelineSelectedSources): void {
  persisted.save(selection);
}

/**
 * Drop ids that are no longer in the catalog.
 * Empty catalog while loading leaves selection untouched.
 */
export function pruneTimelineSelectedSources(
  selected: TimelineSelectedSources,
  catalogTaskIds: readonly string[],
  catalogWorksetIds?: readonly string[],
): TimelineSelectedSources {
  return persisted.prune(selected, catalogTaskIds, catalogWorksetIds);
}

/** Catalog ids for prune: assignable timeline tasks (worksets passed separately). */
export function timelineFilterCatalogIds(timelineTaskIds: readonly string[]): string[] {
  return [...timelineTaskIds];
}
