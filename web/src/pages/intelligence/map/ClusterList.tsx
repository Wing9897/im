import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent } from "../../../types";
import { formatIntelligenceEventTime } from "../../../domain/intelligence/intelligenceSourceMeta";
import {
  mapClusterHeaderClass,
  mapClusterItemClass,
  mapClusterItemMetaClass,
  mapClusterItemTitleClass,
  mapClusterListClass,
  mapDetailCloseClass,
  mapEventPanelBodyFlushClass,
} from "./mapViewClasses";

interface ClusterListProps {
  items: AnalysisEvent[];
  onSelect: (i: AnalysisEvent) => void;
  onClose: () => void;
}

export function ClusterList({ items, onSelect, onClose }: ClusterListProps) {
  const { t } = useTranslation("intelligence");
  return (
    <div className={mapClusterListClass}>
      <button type="button" className={mapDetailCloseClass} onClick={onClose} aria-label={t("map.close")}>
        <X size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      <div className={mapEventPanelBodyFlushClass}>
        <div className={mapClusterHeaderClass}>
          <span>{t("map.sameLocationEvents", { count: items.length })}</span>
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className={mapClusterItemClass}
            onClick={() => onSelect(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(item);
            }}
          >
            <div className={mapClusterItemTitleClass}>{item.title}</div>
            <div className={mapClusterItemMetaClass}>
              {item.location || ""}
              {` · ${formatIntelligenceEventTime(item)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
