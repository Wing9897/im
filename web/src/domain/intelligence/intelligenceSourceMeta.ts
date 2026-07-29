import type { AnalysisEvent } from "../../types";
import i18n from "../../i18n";
import { formatAnalysisTimeRangeNullable } from "../../utils/analysis";
import { getEventTimestamp } from "./mapFilters";
import { safeArray } from "../../utils/nullGuards";
import { platformDisplayLabel } from "../../utils/platformRegistry";
import { formatOsDateTime } from "../../utils/time";

function formatPlatform(value: string | null): string | null {
  if (!value) return null;
  return platformDisplayLabel(value);
}

export function formatIntelligenceEventTime(item: AnalysisEvent): string {
  return formatOsDateTime(getEventTimestamp(item));
}

export function buildIntelligenceSourceMeta(item: AnalysisEvent): string {
  const channelNames = safeArray(item.batchSourceChannelNames);
  const batchSourceLabel =
    channelNames.length > 0
      ? String(
          i18n.t("intelligence:sourceMeta.batchGroups", {
            count: channelNames.length,
          }),
        )
      : null;
  const parts = [
    formatPlatform(item.sourcePlatform),
    item.sourceChannelName,
    batchSourceLabel,
    formatAnalysisTimeRangeNullable(item.analysisTimeRange),
    formatIntelligenceEventTime(item),
  ].filter(Boolean);
  return parts.length > 0
    ? parts.join(" · ")
    : String(i18n.t("intelligence:sourceMeta.incomplete"));
}

export function buildIntelligenceSourceMetaTitle(item: AnalysisEvent): string {
  const hitSource = buildIntelligenceHitSource(item);
  const lines = [
    String(
      i18n.t("intelligence:sourceMeta.hitSourceLine", {
        source: hitSource || String(i18n.t("intelligence:detail.hitSourceFallback")),
      }),
    ),
    String(
      i18n.t("intelligence:sourceMeta.timeRangeLine", {
        range:
          formatAnalysisTimeRangeNullable(item.analysisTimeRange) ??
          String(i18n.t("intelligence:detail.timeRangeUnset")),
      }),
    ),
    safeArray(item.batchSourceChannelNames).length > 0
      ? String(
          i18n.t("intelligence:sourceMeta.batchFull", {
            list: safeArray(item.batchSourceChannelNames)
              .map((name) => `- ${name}`)
              .join("\n"),
          }),
        )
      : String(i18n.t("intelligence:sourceMeta.batchIncomplete")),
  ];
  return lines.join("\n");
}

export function buildIntelligenceHitSource(item: AnalysisEvent): string {
  return [
    formatPlatform(item.sourcePlatform),
    item.sourceChannelName,
    formatIntelligenceEventTime(item),
  ]
    .filter(Boolean)
    .join(" · ");
}
