import { useTranslation } from "react-i18next";
import type { AnalysisEvent } from "../../../types";
import {
  mapDetailBackBtnClass,
  mapDetailCloseClass,
  mapDetailPanelClass,
  mapEventDetailContentClass,
  mapEventDetailMetaClass,
  mapEventDetailMetaRowClass,
  mapEventDetailTitleClass,
  mapEventPanelBodyClass,
} from "./mapViewClasses";
import { formatIntelligenceEventTime } from "../../../domain/intelligence/intelligenceSourceMeta";
import { MapPin, Globe, ClipboardList, Clock, X, ChevronLeft } from "lucide-react";

interface DetailCardProps {
  item: AnalysisEvent;
  onBack?: () => void;
  onClose: () => void;
}

const metaIconSize = 14;

export function DetailCard({ item, onBack, onClose }: DetailCardProps) {
  const { t } = useTranslation("intelligence");
  return (
    <div className={mapDetailPanelClass}>
      <button type="button" className={mapDetailCloseClass} onClick={onClose} aria-label={t("map.close")}>
        <X size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      <div className={mapEventPanelBodyClass}>
        {onBack && (
          <button
            type="button"
            className={mapDetailBackBtnClass}
            onClick={onBack}
            aria-label={t("map.backToList")}
            title={t("map.backToList")}
          >
            <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        <div className={mapEventDetailTitleClass}>{item.title}</div>
        <div className={mapEventDetailContentClass}>{item.body}</div>
        <div className={mapEventDetailMetaClass}>
          {item.location && (
            <span className={mapEventDetailMetaRowClass}>
              <MapPin size={metaIconSize} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              {item.location}
            </span>
          )}
          {item.latitude != null && item.longitude != null && (
            <span className="flex items-center gap-1">
              <Globe size={metaIconSize} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
            </span>
          )}
          {item.taskName && (
            <span className="flex items-center gap-1">
              <ClipboardList size={metaIconSize} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              {item.taskName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={metaIconSize} strokeWidth={2} aria-hidden="true" className="shrink-0" />
            {formatIntelligenceEventTime(item)}
          </span>
        </div>
      </div>
    </div>
  );
}
