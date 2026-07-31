/**
 * Named hierarchical source-filter bindings (localStorage keys + helpers).
 * Board / voice keep their own persistence strategies.
 */

import { INTELLIGENCE_SELECTED_SOURCES_STORAGE_KEY } from "../intelligence/intelligencePersistedKeys";
import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";
import { makePersistedSourceFilter } from "./persistedSourceFilter";

/** Timeline browse source multi-select. */
export const TIMELINE_SELECTED_SOURCES_STORAGE_KEY = "im:timeline:selected-sources";

export type TimelineSelectedSources = SourceFilterSelection;
export type IntelligenceSelectedSources = SourceFilterSelection;

export const timelineSelectedSourcesFilter = makePersistedSourceFilter(
  TIMELINE_SELECTED_SOURCES_STORAGE_KEY,
);

export const intelligenceSelectedSourcesFilter = makePersistedSourceFilter(
  INTELLIGENCE_SELECTED_SOURCES_STORAGE_KEY,
);
