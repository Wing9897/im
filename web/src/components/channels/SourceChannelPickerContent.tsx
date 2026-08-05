import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LinkButton } from "../ui/LinkButton";
import type { ChannelWithSource } from "../../types";
import {
  countSelectedInChannels,
  PICKER_SOURCE_COLLAPSE_THRESHOLD,
  PICKER_PLATFORM_AUTO_EXPAND_MAX,
} from "../../utils/channelPickerModel";
import { useChannelPickerGroups } from "./channelPicker/useChannelPickerGroups";
import {
  ChannelPickerGroupList,
  platformChannelCount,
  sourceKey,
} from "./channelPicker/ChannelPickerGroupList";

interface SourceChannelPickerContentProps {
  channels: ChannelWithSource[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  searchable?: boolean;
  summaryLabel?: string;
  emptyMessage?: string;
  testId?: string;
  hidePlatformHeaders?: boolean;
  listMaxHeight?: number;
  /** When true, list fills modal body height instead of a fixed max-height cap. */
  fillAvailableHeight?: boolean;
}

export function SourceChannelPickerContent({
  channels,
  selectedIds,
  onChange,
  searchable = true,
  summaryLabel,
  emptyMessage,
  testId,
  hidePlatformHeaders = false,
  listMaxHeight = 320,
  fillAvailableHeight = false,
}: SourceChannelPickerContentProps) {
  const { t } = useTranslation("common");
  const resolvedSummary = summaryLabel ?? t("channelPicker.summaryMonitorScope");
  const resolvedEmpty = emptyMessage ?? t("channelPicker.emptyDefault");
  const [query, setQuery] = useState("");
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(() => new Set());
  const [expandedSources, setExpandedSources] = useState<Set<string>>(() => new Set());

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const {
    filteredChannels,
    grouped,
    allGrouped,
    usePlatformGroups,
    expansionUsesPlatformGroups,
  } = useChannelPickerGroups(channels, query, hidePlatformHeaders);
  const searching = query.trim().length > 0;

  useEffect(() => {
    // Expansion state is maintained from the unfiltered tree. Search only
    // derives a temporary expanded presentation and never mutates user state.
    setExpandedPlatforms((prev) => {
      const next = new Set(prev);
      for (const group of allGrouped) {
        if (next.has(group.platform)) continue;
        const count = platformChannelCount(group);
        const selectedCount = countSelectedInChannels(
          selectedIds,
          group.sources.flatMap((source) => source.channels),
        );
        if (!expansionUsesPlatformGroups || selectedCount > 0 || count <= PICKER_PLATFORM_AUTO_EXPAND_MAX) {
          next.add(group.platform);
        }
      }
      for (const platform of next) {
        if (!allGrouped.some((group) => group.platform === platform)) next.delete(platform);
      }
      return next;
    });

    setExpandedSources((prev) => {
      const next = new Set(prev);
      for (const group of allGrouped) {
        for (const source of group.sources) {
          const key = sourceKey(group.platform, source);
          if (next.has(key)) continue;
          const selectedCount = countSelectedInChannels(selectedIds, source.channels);
          if (
            selectedCount > 0 ||
            source.channels.length <= PICKER_SOURCE_COLLAPSE_THRESHOLD
          ) {
            next.add(key);
          }
        }
      }
      for (const key of next) {
        const stillExists = allGrouped.some((group) =>
          group.sources.some((source) => sourceKey(group.platform, source) === key),
        );
        if (!stillExists) next.delete(key);
      }
      return next;
    });
  }, [allGrouped, expansionUsesPlatformGroups, selectedIds]);

  const togglePlatform = (platform: string) => {
    if (searching) return;
    setExpandedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  };

  const toggleSource = (key: string) => {
    if (searching) return;
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleChannel = (channelId: string) => {
    onChange(
      selected.has(channelId)
        ? selectedIds.filter((id) => id !== channelId)
        : [...selectedIds, channelId],
    );
  };

  const useFillHeight = fillAvailableHeight || listMaxHeight <= 0;

  return (
    <div className="im-channel-picker" data-testid={testId}>
      {searchable && channels.length > 0 && (
        <div className="im-picker-search-wrap">
          <Search size={14} strokeWidth={2} aria-hidden="true" className="im-picker-search-icon" />
          <input
            className="im-picker-search-input"
            type="search"
            placeholder={t("channelPicker.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("channelPicker.searchAria")}
          />
        </div>
      )}

      <div className="im-picker-toolbar">
        <span className="im-picker-summary">
          {resolvedSummary}
          {selectedIds.length > 0 ? (
            <span className="im-picker-summary-badge">
              {t("channelPicker.selectedBadge", { count: selectedIds.length })}
            </span>
          ) : null}
        </span>
        <span className="im-picker-toolbar-actions">
          <LinkButton onClick={() =>
              onChange(Array.from(new Set([...selectedIds, ...filteredChannels.map((ch) => ch.id)])))
            }
          >
            {t("channelPicker.selectAll")}
          </LinkButton>
          <LinkButton tone="muted" onClick={() => onChange([])}>
            {t("channelPicker.clear")}
          </LinkButton>
        </span>
      </div>

      <ChannelPickerGroupList
        grouped={grouped}
        selectedIds={selectedIds}
        selected={selected}
        searching={searching}
        usePlatformGroups={usePlatformGroups}
        useFillHeight={useFillHeight}
        listMaxHeight={listMaxHeight}
        expandedPlatforms={expandedPlatforms}
        expandedSources={expandedSources}
        onTogglePlatform={togglePlatform}
        onToggleSource={toggleSource}
        onToggleChannel={toggleChannel}
        emptyMessage={resolvedEmpty}
      />
    </div>
  );
}
