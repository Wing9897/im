import { describe, expect, it } from "vitest";
import type { AnalysisEvent } from "../../types";
import {
  BOARD_MAP_DEFAULT_ZOOM,
  INTELLIGENCE_MAP_DEFAULT_ZOOM,
  SHARED_MAP_CONTAINER_OPTIONS,
  buildMapMarkerGroups,
  filterTimedMapEvents,
  sortTimedMapEvents,
} from "./mapPresentation";

function event(
  id: string,
  createdAt: string,
  latitude: number,
  longitude: number,
): AnalysisEvent {
  return { id, createdAt, latitude, longitude } as AnalysisEvent;
}

describe("shared map presentation", () => {
  it("keeps host camera defaults distinct while sharing map interaction options", () => {
    expect(INTELLIGENCE_MAP_DEFAULT_ZOOM).toBe(2);
    expect(BOARD_MAP_DEFAULT_ZOOM).toBe(1);
    expect(SHARED_MAP_CONTAINER_OPTIONS).toEqual({
      minZoom: 1,
      scrollWheelZoom: true,
      zoomControl: false,
    });
  });

  it("sorts, filters, and groups marker input for both hosts", () => {
    const older = event("older", "2025-01-01T10:00:00Z", 25, 121);
    const newer = event("newer", "2025-01-01T12:00:00Z", 25, 121);
    const timed = sortTimedMapEvents([older, newer]);
    const filtered = filterTimedMapEvents(timed, {
      start: new Date("2025-01-01T11:00:00Z"),
      end: new Date("2025-01-01T13:00:00Z"),
    });

    expect(filtered.map((item) => item.id)).toEqual(["newer"]);
    expect(buildMapMarkerGroups([older, newer])).toHaveLength(1);
  });
});
