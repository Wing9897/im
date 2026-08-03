import { PREFS_SCHEMA_VERSION, PREFS_SCHEMA_VERSION_KEY } from "./keys";

function removeImPrefixedKeys(storage: Storage): void {
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith("im:")) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    storage.removeItem(key);
  }
}

/**
 * On first launch of prefs schema v6, clear prior-generation `im:*` keys from
 * localStorage and sessionStorage. Board layout is unaffected (server ui_prefs).
 *
 * Idempotent: subsequent boots see the version marker and skip.
 */
export function clearLegacyPrefsIfNeeded(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(PREFS_SCHEMA_VERSION_KEY) === PREFS_SCHEMA_VERSION) {
      return;
    }
    removeImPrefixedKeys(window.localStorage);
    removeImPrefixedKeys(window.sessionStorage);
    window.localStorage.setItem(PREFS_SCHEMA_VERSION_KEY, PREFS_SCHEMA_VERSION);
  } catch {
    // private mode / disabled storage — skip wipe
  }
}
