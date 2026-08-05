import type { AnalysisEvent, TimeWindow } from "../../types";
import { groupByCoordinate, type CoordGroup } from "./groupByCoordinate";
import { getEventTimestamp } from "./mapFilters";

export const INTELLIGENCE_MAP_DEFAULT_CENTER: [number, number] = [20, 0];
export const INTELLIGENCE_MAP_DEFAULT_ZOOM = 2;
export const BOARD_MAP_DEFAULT_CENTER: [number, number] = [20, 0];
export const BOARD_MAP_DEFAULT_ZOOM = 1;

export const SHARED_MAP_CONTAINER_OPTIONS = {
  minZoom: 1,
  scrollWheelZoom: true,
  zoomControl: false,
} as const;

export interface TimedMapEvent {
  item: AnalysisEvent;
  timestamp: number;
}

export function sortTimedMapEvents(items: readonly AnalysisEvent[]): TimedMapEvent[] {
  return items
    .map((item) => ({ item, timestamp: new Date(getEventTimestamp(item)).getTime() }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function filterTimedMapEvents(
  items: readonly TimedMapEvent[],
  window: TimeWindow,
): AnalysisEvent[] {
  const start = window.start.getTime();
  const end = window.end.getTime();
  return items.flatMap(({ item, timestamp }) =>
    timestamp >= start && timestamp <= end ? [item] : [],
  );
}

export function buildMapMarkerGroups(items: readonly AnalysisEvent[]): CoordGroup[] {
  return groupByCoordinate(items);
}
