/**
 * Named hierarchical source-filter bindings (localStorage keys + helpers).
 *
 * Three persistence paths stay separate on purpose — do not merge them:
 * 1. Timeline local worksets: `im:timeline:selected-sources` (this file).
 *    Subscribe display keys are a sibling LS key (`im:timeline:subscribe-filter`),
 *    not `SourceFilterSelection`.
 * 2. Intelligence: `im:intelligence:selected-sources` (this file). Same tree
 *    dialog as board widgets, different store.
 * 3. Board widgets: server `ui-prefs` `widgetState.sourceFilters` via
 *    `boardPrefsStore` — not localStorage.
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
