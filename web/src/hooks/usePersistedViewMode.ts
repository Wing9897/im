import type { ViewMode } from "../types/common";
import { usePersistedEnum } from "./usePersistedEnum";

function isViewMode(value: string | null): value is ViewMode {
  return value === "card" || value === "list" || value === "map";
}

/** Persists a ViewMode ("card" | "list" | "map") to localStorage, resetting to fallback on invalid stored values. */
export function usePersistedViewMode(storageKey: string, fallback: ViewMode = "card") {
  return usePersistedEnum(storageKey, fallback, isViewMode);
}
