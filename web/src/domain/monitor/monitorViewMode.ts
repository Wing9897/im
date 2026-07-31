export type MonitorViewMode = "card" | "list" | "wall";

export { MONITOR_VIEW_MODE_STORAGE_KEY } from "../prefs";

const VALID_MODES = new Set<MonitorViewMode>(["card", "list", "wall"]);

export function isMonitorViewMode(value: unknown): value is MonitorViewMode {
  return typeof value === "string" && VALID_MODES.has(value as MonitorViewMode);
}
