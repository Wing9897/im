import type { AnalysisEvent } from "../../types";

export interface CoordGroup {
  key: string;
  lat: number;
  lng: number;
  items: AnalysisEvent[];
}

/** Bucket intelligence items by exact lat/lng coordinate. */
export function groupByCoordinate(items: readonly AnalysisEvent[]): CoordGroup[] {
  const map = new Map<string, CoordGroup>();
  for (const item of items) {
    const key = `${item.latitude},${item.longitude}`;
    let g = map.get(key);
    if (!g) {
      g = { key, lat: item.latitude!, lng: item.longitude!, items: [] };
      map.set(key, g);
    }
    g.items.push(item);
  }
  return Array.from(map.values());
}
