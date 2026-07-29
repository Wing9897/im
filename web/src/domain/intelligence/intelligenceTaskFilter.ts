/**
 * Intelligence task multi-select: `null` = all, `[]` = none, `[…]` = subset.
 * Reads/writes only {@link INTELLIGENCE_SELECTED_TASK_IDS_STORAGE_KEY}.
 */

import { pruneMultiSelectIds } from "../ui/pruneMultiSelectIds";
import {
  loadPersistedTaskMultiSelect,
  savePersistedTaskMultiSelect,
  type PersistedTaskMultiSelect,
} from "../ui/persistedTaskMultiSelect";
import { INTELLIGENCE_SELECTED_TASK_IDS_STORAGE_KEY } from "./intelligencePersistedKeys";

export type IntelligenceSelectedTaskIds = PersistedTaskMultiSelect;

const PERSISTENCE_OPTIONS = {
  storageKey: INTELLIGENCE_SELECTED_TASK_IDS_STORAGE_KEY,
  emptyArray: "normalize-to-all",
} as const;

/** Parse persisted multi-select. */
export function loadIntelligenceSelectedTaskIds(): IntelligenceSelectedTaskIds {
  return loadPersistedTaskMultiSelect(PERSISTENCE_OPTIONS);
}

export function saveIntelligenceSelectedTaskIds(
  ids: IntelligenceSelectedTaskIds,
): void {
  savePersistedTaskMultiSelect(PERSISTENCE_OPTIONS, ids);
}

/**
 * Drop ids that are no longer in the event-mode catalog.
 * Empty catalog (still loading / no event tasks yet) leaves selection untouched.
 * A selection that still covers every catalog id collapses to `null` (all).
 * If every selected id vanished, reset to `null` (all) — same as timeline.
 */
export function pruneIntelligenceSelectedTaskIds(
  selected: IntelligenceSelectedTaskIds,
  catalogIds: readonly string[],
): IntelligenceSelectedTaskIds {
  return pruneMultiSelectIds(selected, catalogIds);
}
