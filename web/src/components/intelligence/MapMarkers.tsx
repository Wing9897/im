import type { AnalysisEvent } from "../../types";
import type { CoordGroup } from "../../domain/intelligence/groupByCoordinate";
import { GroupMarker } from "./GroupMarker";

export type { CoordGroup };

interface MapMarkersProps {
  coordGroups: CoordGroup[];
  onSingleClick: (item: AnalysisEvent) => void;
  onClusterClick: (items: AnalysisEvent[]) => void;
  newItemIds: Set<string>;
}

export function MapMarkers({ coordGroups, onSingleClick, onClusterClick, newItemIds }: MapMarkersProps) {
  return (
    <>
      {coordGroups.map((g) => (
        <GroupMarker
          key={g.key}
          group={g}
          onSingleClick={onSingleClick}
          onClusterClick={onClusterClick}
          newItemIds={newItemIds}
        />
      ))}
    </>
  );
}
