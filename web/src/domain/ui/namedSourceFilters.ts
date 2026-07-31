/**
 * Named hierarchical source-filter bindings (localStorage keys + helpers).
 * Board / voice keep their own persistence strategies.
 */

import {
  INTELLIGENCE_SELECTED_SOURCES_STORAGE_KEY,
  TIMELINE_SELECTED_SOURCES_STORAGE_KEY,
} from "../prefs";
import { makePersistedSourceFilter } from "./persistedSourceFilter";

/** Timeline browse source multi-select. */
export { TIMELINE_SELECTED_SOURCES_STORAGE_KEY };

export const timelineSelectedSourcesFilter = makePersistedSourceFilter(
  TIMELINE_SELECTED_SOURCES_STORAGE_KEY,
);

export const intelligenceSelectedSourcesFilter = makePersistedSourceFilter(
  INTELLIGENCE_SELECTED_SOURCES_STORAGE_KEY,
);
