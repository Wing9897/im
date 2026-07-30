/**
 * Intelligence source multi-select persistence (`null` = all).
 * Hierarchical `{ taskIds, worksetIds }` only (legacy string[] ignored).
 */

import { makePersistedSourceFilter } from "../ui/persistedSourceFilter";
import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";
import { INTELLIGENCE_SELECTED_SOURCES_STORAGE_KEY } from "./intelligencePersistedKeys";

export type IntelligenceSelectedSources = SourceFilterSelection;

const persisted = makePersistedSourceFilter(INTELLIGENCE_SELECTED_SOURCES_STORAGE_KEY);

export function loadIntelligenceSelectedSources(): IntelligenceSelectedSources {
  return persisted.load();
}

export function saveIntelligenceSelectedSources(selection: IntelligenceSelectedSources): void {
  persisted.save(selection);
}

export function pruneIntelligenceSelectedSources(
  selected: IntelligenceSelectedSources,
  catalogTaskIds: readonly string[],
  catalogWorksetIds?: readonly string[],
): IntelligenceSelectedSources {
  return persisted.prune(selected, catalogTaskIds, catalogWorksetIds);
}
