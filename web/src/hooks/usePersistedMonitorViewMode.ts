import type { MonitorViewMode } from "../domain/monitor/monitorViewMode";
import { isMonitorViewMode } from "../domain/monitor/monitorViewMode";
import { usePersistedEnum } from "./usePersistedEnum";

/** Persists monitor view mode (card | list | wall) to localStorage. */
export function usePersistedMonitorViewMode(
  storageKey: string,
  fallback: MonitorViewMode = "card",
) {
  return usePersistedEnum(
    storageKey,
    fallback,
    (value): value is MonitorViewMode => isMonitorViewMode(value),
  );
}
