export type PersistedTaskMultiSelect = string[] | null;

type PersistedTaskMultiSelectOptions = {
  storageKey: string;
  /** Domain-specific persisted `[]` normalization. */
  emptyArray: "preserve" | "normalize-to-all";
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
 * Shared persisted task multi-select core.
 *
 * The caller owns domain semantics through `emptyArray`; malformed values
 * always fall back to `null` (all tasks).
 */
export function loadPersistedTaskMultiSelect(
  options: PersistedTaskMultiSelectOptions,
): PersistedTaskMultiSelect {
  const store = localStorageOrNull();
  if (!store) return null;

  const raw = store.getItem(options.storageKey);
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null) return null;
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
      if (parsed.length === 0 && options.emptyArray === "normalize-to-all") {
        return null;
      }
      return parsed;
    }
  } catch {
    // Invalid JSON defaults to all tasks.
  }
  return null;
}

export function savePersistedTaskMultiSelect(
  options: PersistedTaskMultiSelectOptions,
  ids: PersistedTaskMultiSelect,
): void {
  const store = localStorageOrNull();
  if (!store) return;
  try {
    store.setItem(options.storageKey, JSON.stringify(ids));
  } catch {
    // Persistence failure leaves the in-memory selection usable.
  }
}
