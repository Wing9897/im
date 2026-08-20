import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent } from "../../../types";
import { IntelEventAvatarStack } from "../../../components/task/IntelEventAvatarStack";
import { lookupTaskEmoji } from "../../../domain/tasks/taskEmoji";
import { Badge, Button } from "../../../components/ui";
import { platformBadgeStyle } from "../../../utils/platform";
import { platformDisplayLabel } from "../../../utils/platformRegistry";
import { isMappableCoordinate } from "../../../domain/intelligence/mapFilters";
import {
  DetailPresentationShell,
  DetailTagList,
  type DetailPresentation,
} from "../../../components/detail";
import {
  detailChromeBadgesClass,
  detailChromeBodyGapLgClass,
  detailChromeFooterPlainClass,
  detailChromeHeaderClass,
  detailDialogFlexColClass,
  detailDialogShellClass,
  intelligenceDetailContentHeroClass,
  intelligenceDetailMetaIconClass,
  intelligenceDetailMetaItemClass,
  intelligenceDetailMetaLabelClass,
  intelligenceDetailMetaListClass,
  intelligenceDetailTitleClass,
} from "../../../components/detail/classes";
import { formatAnalysisTimeRangeNullable } from "../../../utils/analysis";
import {
  buildIntelligenceHitSource,
  buildIntelligenceSourceMeta,
} from "../../../domain/intelligence/intelligenceSourceMeta";
import { formatOsDateTime } from "../../../utils/time";
import { IntelligenceSourceQuote } from "./IntelligenceSourceQuote";
import { IntelligenceNotIntelButton } from "./IntelligenceNotIntelButton";

interface IntelligenceDetailViewProps {
  item: AnalysisEvent;
  onClose: () => void;
  presentation?: DetailPresentation;
  notIntelBusy?: boolean;
  onNotIntel?: (item: AnalysisEvent) => void;
}

function isUnspecifiedLocationLabel(location: string | null | undefined): boolean {
  if (location == null) return true;
  const trimmed = location.trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  return (
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "unknown" ||
    normalized === "none" ||
    normalized === "0,0" ||
    normalized === "0.0,0.0"
  );
}

/** Single place line for detail meta: real location and/or mappable coords. */
function formatIntelligencePlaceMeta(
  item: AnalysisEvent,
  locationNone: string,
): string {
  const mappable = isMappableCoordinate(item.latitude, item.longitude);
  const locationText =
    !isUnspecifiedLocationLabel(item.location) && item.location
      ? item.location.trim()
      : null;
  const coordText = mappable
    ? `${item.latitude!.toFixed(4)}, ${item.longitude!.toFixed(4)}`
    : null;

  if (locationText && coordText) return `${locationText}（${coordText}）`;
  if (locationText) return locationText;
  if (coordText) return coordText;
  return locationNone;
}

export function IntelligenceDetailView({
  item,
  onClose,
  presentation = "modal",
  notIntelBusy = false,
  onNotIntel,
}: IntelligenceDetailViewProps) {
  const { t } = useTranslation("intelligence");
  const taskGlyph = lookupTaskEmoji(item.emoji);
  const hitSource = buildIntelligenceHitSource(item);
  const sourceSummary = buildIntelligenceSourceMeta(item);
  const timeRange =
    formatAnalysisTimeRangeNullable(item.analysisTimeRange) ?? t("detail.timeRangeUnset");
  const placeText = formatIntelligencePlaceMeta(item, t("detail.locationNone"));

  const content = (
    <>
      <header className={detailChromeHeaderClass}>
        <h2 className={`${intelligenceDetailTitleClass} flex items-start gap-sm`}>
          <IntelEventAvatarStack
            emoji={taskGlyph}
            size="card"
            label={t("card.eventAvatarAria")}
          />
          <span className="min-w-0 flex-1">{item.title}</span>
        </h2>
        <div className={detailChromeBadgesClass}>
          {item.taskName ? <Badge tone="accent">{item.taskName}</Badge> : null}
          {item.sourcePlatform ? (
            <span style={platformBadgeStyle(item.sourcePlatform)}>
              {platformDisplayLabel(item.sourcePlatform)}
            </span>
          ) : null}
        </div>
      </header>

      <div className={detailChromeBodyGapLgClass}>
        <div className={intelligenceDetailContentHeroClass}>{item.body}</div>

        <div className={intelligenceDetailMetaListClass}>
          <div className={intelligenceDetailMetaItemClass}>
            <span className={intelligenceDetailMetaLabelClass}>{t("detail.hitSource")}</span>
            <span>{hitSource || t("detail.hitSourceFallback")}</span>
          </div>
          <div className={intelligenceDetailMetaItemClass}>
            <span className={intelligenceDetailMetaLabelClass}>{t("detail.sourceSummary")}</span>
            <span>{sourceSummary}</span>
          </div>
          <div className={intelligenceDetailMetaItemClass}>
            <span className={intelligenceDetailMetaLabelClass}>{t("detail.timeRange")}</span>
            <span>{timeRange}</span>
          </div>
          <div className={intelligenceDetailMetaItemClass}>
            <MapPin size={14} className={intelligenceDetailMetaIconClass} aria-hidden="true" />
            <span className={intelligenceDetailMetaLabelClass}>{t("detail.location")}</span>
            <span>{placeText}</span>
          </div>
          {item.sourceMessageTime ? (
            <div className={intelligenceDetailMetaItemClass}>
              <span className={intelligenceDetailMetaLabelClass}>{t("detail.sourceTime")}</span>
              <span>{formatOsDateTime(item.sourceMessageTime)}</span>
            </div>
          ) : null}
          <div className={intelligenceDetailMetaItemClass}>
            <span className={intelligenceDetailMetaLabelClass}>{t("detail.analyzedTime")}</span>
            <span>{formatOsDateTime(item.createdAt)}</span>
          </div>
        </div>

        <DetailTagList
          title={t("detail.batchSources")}
          tags={item.batchSourceChannelNames ?? []}
        />

        <IntelligenceSourceQuote sourceMessageId={item.sourceMessageId} />
      </div>

      <footer className={detailChromeFooterPlainClass}>
        {onNotIntel && !item.dismissed ? (
          <IntelligenceNotIntelButton
            disabled={notIntelBusy}
            onClick={() => onNotIntel(item)}
          />
        ) : null}
        <Button variant="secondary" onClick={onClose}>
          {t("detail.close")}
        </Button>
      </footer>
    </>
  );

  return (
    <DetailPresentationShell
      presentation={presentation}
      onClose={onClose}
      className={
        presentation === "inline" ? detailDialogFlexColClass : detailDialogShellClass
      }
      width="min(560px, calc(100vw - 32px))"
      aria-label={t("detail.ariaLabel", { title: item.title })}
    >
      {content}
    </DetailPresentationShell>
  );
}

export function IntelligenceDetailDialog({
  item,
  onClose,
  presentation = "modal",
  notIntelBusy,
  onNotIntel,
}: {
  item: AnalysisEvent;
  onClose: () => void;
  presentation?: DetailPresentation;
  notIntelBusy?: boolean;
  onNotIntel?: (item: AnalysisEvent) => void;
}) {
  return (
    <IntelligenceDetailView
      item={item}
      onClose={onClose}
      presentation={presentation}
      notIntelBusy={notIntelBusy}
      onNotIntel={onNotIntel}
    />
  );
}
