import React from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent } from "../../../types";
import { Badge, ListRowMain, ListRowTime } from "../../../components/ui";
import { SelectableSurface } from "../../../components/detail/SelectableSurface";
import { cardTitleClass } from "../../../components/ui/pageTypography";
import { useAutoRead } from "../../../hooks/useAutoRead";
import { getEventTimestamp } from "../../../domain/intelligence/mapFilters";
import {
  buildIntelligenceSourceMeta,
  buildIntelligenceSourceMetaTitle,
  formatIntelligenceEventTime,
} from "../../../domain/intelligence/intelligenceSourceMeta";
import {
  AUTO_READ_VISIBILITY_THRESHOLD,
  AUTO_READ_DELAY_MS,
} from "../intelligenceViewLayout";

interface IntelligenceRowProps {
  item: AnalysisEvent;
  isRead: boolean;
  isConsumed: boolean;
  isSelected?: boolean;
  onAutoRead: (id: string) => void;
  onClick?: (item: AnalysisEvent) => void;
}

export const IntelligenceRow = React.memo(function IntelligenceRow({
  item,
  isRead,
  isConsumed,
  isSelected = false,
  onAutoRead,
  onClick,
}: IntelligenceRowProps) {
  const { t } = useTranslation("intelligence");
  const containerRef = useAutoRead<HTMLDivElement>({
    itemId: item.id,
    isRead: isConsumed,
    visibilityThreshold: AUTO_READ_VISIBILITY_THRESHOLD,
    delayMs: AUTO_READ_DELAY_MS,
    onAutoRead,
  });

  return (
    <div ref={containerRef}>
      <SelectableSurface
        variant="row"
        semanticRole="row"
        onSelect={onClick ? () => onClick(item) : undefined}
        selectAriaLabel={
          onClick ? t("list.viewDetailAria", { title: item.title }) : undefined
        }
        isSelected={isSelected}
        isRead={isRead}
        className="im-intelligence-list-row"
      >
        <ListRowTime dateTime={getEventTimestamp(item)} role="cell">
          {formatIntelligenceEventTime(item)}
        </ListRowTime>
        <span
          className={`h-1.5 w-1.5 shrink-0 ${isRead ? "" : "rounded-full bg-accent"}`}
          aria-label={isRead ? undefined : t("list.unreadAria")}
          title={isRead ? undefined : t("list.unreadAria")}
          aria-hidden={isRead ? "true" : undefined}
        />
        <span
          className={`min-w-[10rem] max-w-[36%] shrink grow basis-[12rem] truncate ${cardTitleClass}`}
          title={item.title}
          role="cell"
        >
          {item.title}
          {item.taskName ? (
            <Badge tone="neutral" className="ml-sm">
              {item.taskName}
            </Badge>
          ) : null}
        </span>
        <span
          className="min-w-[8rem] max-w-[22%] shrink grow basis-[10rem] truncate text-xs text-info"
          title={buildIntelligenceSourceMetaTitle(item)}
          role="cell"
        >
          {buildIntelligenceSourceMeta(item)}
        </span>
        <ListRowMain title={item.body} role="cell" className="min-w-[12rem] flex-[1.4] text-text-secondary">
          {item.body}
        </ListRowMain>
        {item.location ? (
          <span
            className="hidden shrink-0 items-center gap-1 text-xs text-text-muted xl:inline-flex"
            role="cell"
          >
            <MapPin size={14} strokeWidth={2} aria-hidden="true" />
            {item.location}
          </span>
        ) : null}
      </SelectableSurface>
    </div>
  );
});
