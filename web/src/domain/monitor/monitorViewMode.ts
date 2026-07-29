export type MonitorViewMode = "card" | "list" | "wall";

export const MONITOR_VIEW_MODE_STORAGE_KEY = "im:view-mode:monitor";

const VALID_MODES = new Set<MonitorViewMode>(["card", "list", "wall"]);

export function isMonitorViewMode(value: unknown): value is MonitorViewMode {
  return typeof value === "string" && VALID_MODES.has(value as MonitorViewMode);
}
