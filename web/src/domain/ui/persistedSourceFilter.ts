/**
 * Persisted hierarchical source filter: `{ taskIds, worksetIds } | null`.
 * Legacy flat `string[]` is ignored (treated as all sources).
 */

import {
  parseSourceFilterValue,
  pruneSourceFilter,
  type SourceFilterSelection,
} from "../tasks/sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

type PersistedSourceFilterOptions = {
  storageKey: string;
};

function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Load filter selection. Accepts `{taskIds,worksetIds}` or `null`.
 * Legacy / unknown shapes → `null` (all sources).
 */
function loadPersistedSourceFilter(
  options: PersistedSourceFilterOptions,
): SourceFilterSelection {
  const store = localStorageOrNull();
  if (!store) return null;

  const raw = store.getItem(options.storageKey);
  if (raw === null) return null;

  try {
    return parseSourceFilterValue(JSON.parse(raw) as unknown);
  } catch {
    // Invalid JSON defaults to all.
    return null;
  }
}

function savePersistedSourceFilter(
  options: PersistedSourceFilterOptions,
  selection: SourceFilterSelection,
): void {
  const store = localStorageOrNull();
  if (!store) return;
  try {
    store.setItem(options.storageKey, JSON.stringify(selection));
  } catch {
    // Persistence failure leaves in-memory selection usable.
  }
}

/** Bound load / save / prune helpers for one localStorage key. */
export function makePersistedSourceFilter(storageKey: string) {
  const options = { storageKey } as const;
  return {
    load(): SourceFilterSelection {
      return loadPersistedSourceFilter(options);
    },
    save(selection: SourceFilterSelection): void {
      savePersistedSourceFilter(options, selection);
    },
    prune(
      selected: SourceFilterSelection,
      catalogTaskIds: readonly string[],
      catalogWorksetIds: readonly string[] = [SYSTEM_WORKSET_ID],
    ): SourceFilterSelection {
      return pruneSourceFilter(selected, catalogTaskIds, catalogWorksetIds);
    },
  };
}
