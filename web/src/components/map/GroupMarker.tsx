import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent } from "../../types";
import type { CoordGroup } from "../../domain/intelligence/groupByCoordinate";
const mapPopupBodyClass = "text-body text-text-primary";
const mapPopupSubtextClass = "mt-1 text-xs text-text-subtle";

export type { CoordGroup };

interface GroupMarkerProps {
  group: CoordGroup;
  onSingleClick: (i: AnalysisEvent) => void;
  onClusterClick: (items: AnalysisEvent[]) => void;
  newItemIds: Set<string>;
}

function clusterSizeClass(count: number): { sizeClass: string; size: number } {
  if (count >= 100) return { sizeClass: "im-map-cluster--lg", size: 38 };
  if (count >= 10) return { sizeClass: "im-map-cluster--md", size: 32 };
  return { sizeClass: "im-map-cluster--sm", size: 26 };
}

function createClusterIcon(count: number): L.DivIcon {
  const { sizeClass, size } = clusterSizeClass(count);
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div class="im-map-cluster ${sizeClass}">${count}</div>`,
  });
}

function createMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
    html: `<div class="im-map-marker-dot"></div>`,
  });
}

function createPulseMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
    html: `<div class="im-map-marker-pulse"><div class="im-map-marker-dot"></div><div class="im-map-marker-ring"></div></div>`,
  });
}

const markerIcon = createMarkerIcon();
const pulseMarkerIcon = createPulseMarkerIcon();

function areGroupMarkerPropsEqual(previous: GroupMarkerProps, next: GroupMarkerProps): boolean {
  if (
    previous.group.key !== next.group.key ||
    previous.group.items.length !== next.group.items.length ||
    previous.onSingleClick !== next.onSingleClick ||
    previous.onClusterClick !== next.onClusterClick ||
    previous.newItemIds !== next.newItemIds
  ) {
    return false;
  }
  return previous.group.items.every((item, index) => item === next.group.items[index]);
}

function GroupMarkerComponent({ group, onSingleClick, onClusterClick, newItemIds }: GroupMarkerProps) {
  const { t } = useTranslation("intelligence");
  const markerRef = useRef<L.Marker>(null);
  const isSingle = group.items.length === 1;
  const item = group.items[0];
  const hasNew = group.items.some((i) => newItemIds.has(i.id));
  const [showPulse, setShowPulse] = useState(hasNew);
  useEffect(() => {
    if (!showPulse) return;
    const timer = setTimeout(() => setShowPulse(false), 3000);
    return () => clearTimeout(timer);
  }, [showPulse]);
  const icon = useMemo(
    () =>
      isSingle
        ? showPulse
          ? pulseMarkerIcon
          : markerIcon
        : createClusterIcon(group.items.length),
    [isSingle, showPulse, group.items.length],
  );
  useEffect(() => {
    markerRef.current?.setIcon(icon);
  }, [icon]);
  const handleClick = useCallback(() => {
    if (isSingle) onSingleClick(item);
    else onClusterClick(group.items);
  }, [isSingle, item, group.items, onSingleClick, onClusterClick]);
  const handlers = useMemo(
    () => ({
      click: handleClick,
      mouseover: () => {
        if (isSingle) markerRef.current?.openPopup();
      },
      mouseout: () => {
        if (isSingle) markerRef.current?.closePopup();
      },
    }),
    [handleClick, isSingle],
  );
  return (
    <Marker ref={markerRef} position={[group.lat, group.lng]} icon={icon} eventHandlers={handlers}>
      {isSingle ? (
        <Popup>
          <div className={mapPopupBodyClass}>
            <strong>{item.title}</strong>
            {item.location && <div className={mapPopupSubtextClass}>{item.location}</div>}
          </div>
        </Popup>
      ) : (
        <Popup>
          <div className={mapPopupBodyClass}>
            <strong>{t("map.eventCount", { count: group.items.length })}</strong>
            <div className={mapPopupSubtextClass}>{t("map.clickToViewList")}</div>
          </div>
        </Popup>
      )}
    </Marker>
  );
}

export const GroupMarker = memo(GroupMarkerComponent, areGroupMarkerPropsEqual);
