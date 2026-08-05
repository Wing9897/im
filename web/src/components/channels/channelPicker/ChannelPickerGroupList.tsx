import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PlatformIcon } from "../../common/PlatformIcon";
import type { ChannelWithSource } from "../../../types";
import type {
  PickerSourceGroup,
  PickerPlatformGroup,
} from "../../../utils/groupChannelsForPicker";
import {
  channelDisplayHint,
  channelDisplayLabel,
  countSelectedInChannels,
  PICKER_SOURCE_COLLAPSE_THRESHOLD,
} from "../../../utils/channelPickerModel";

function platformChannelCount(group: PickerPlatformGroup): number {
  return group.sources.reduce((sum, source) => sum + source.channels.length, 0);
}

function sourceKey(platform: string, source: PickerSourceGroup): string {
  return `${platform}:${source.sourceId ?? source.sourceLabel}`;
}

interface ChannelPickerGroupListProps {
  grouped: PickerPlatformGroup[];
  selectedIds: string[];
  selected: Set<string>;
  searching: boolean;
  usePlatformGroups: boolean;
  useFillHeight: boolean;
  listMaxHeight: number;
  expandedPlatforms: Set<string>;
  expandedSources: Set<string>;
  onTogglePlatform: (platform: string) => void;
  onToggleSource: (key: string) => void;
  onToggleChannel: (channelId: string) => void;
  emptyMessage: string;
}

export function ChannelPickerGroupList({
  grouped,
  selectedIds,
  selected,
  searching,
  usePlatformGroups,
  useFillHeight,
  listMaxHeight,
  expandedPlatforms,
  expandedSources,
  onTogglePlatform,
  onToggleSource,
  onToggleChannel,
  emptyMessage,
}: ChannelPickerGroupListProps) {
  const { t } = useTranslation("common");

  if (grouped.length === 0) {
    return (
      <div className="im-picker-empty">
        {searching ? t("channelPicker.noMatch") : emptyMessage}
      </div>
    );
  }

  const renderSourceBlock = (platformGroup: PickerPlatformGroup, sourceGroup: PickerSourceGroup) => {
    const key = sourceKey(platformGroup.platform, sourceGroup);
    const sourceExpanded = expandedSources.has(key) || searching;
    const sourceSelected = countSelectedInChannels(selectedIds, sourceGroup.channels);
    const collapsibleSource =
      platformGroup.pickerLayout === "source-tree" &&
      sourceGroup.channels.length > PICKER_SOURCE_COLLAPSE_THRESHOLD;

    return (
      <div key={key} className="im-picker-source-block">
        {platformGroup.pickerLayout === "source-tree" &&
          (collapsibleSource ? (
            <button
              type="button"
              className="im-picker-source-toggle"
              aria-expanded={sourceExpanded}
              onClick={() => onToggleSource(key)}
            >
              <ChevronRight
                size={14}
                aria-hidden="true"
                className={`im-picker-chevron${sourceExpanded ? " is-open" : ""}`}
              />
              {!usePlatformGroups ? (
                <PlatformIcon platform={platformGroup.platform} size={14} />
              ) : null}
              <span className="im-picker-source-name">{sourceGroup.sourceLabel}</span>
              <span className="im-picker-source-count">{sourceGroup.channels.length}</span>
              {sourceSelected > 0 && (
                <span className="im-picker-selected-badge">
                  {t("channelPicker.selectedBadge", { count: sourceSelected })}
                </span>
              )}
            </button>
          ) : (
            <div className="im-picker-source-label">
              {!usePlatformGroups ? (
                <PlatformIcon platform={platformGroup.platform} size={14} />
              ) : null}
              <span className="im-picker-source-name">{sourceGroup.sourceLabel}</span>
              <span className="im-picker-source-count">{sourceGroup.channels.length}</span>
            </div>
          ))}
        {(!collapsibleSource || sourceExpanded) && (
          <div className="im-picker-rows">
            {sourceGroup.channels.map((channel: ChannelWithSource) => {
              const isSelected = selected.has(channel.id);
              const label = channelDisplayLabel(channel);
              const hint = channelDisplayHint(channel, platformGroup.pickerLayout);
              return (
                <label
                  key={channel.id}
                  className={`im-picker-row${isSelected ? " is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleChannel(channel.id)}
                    aria-label={label}
                  />
                  <span className="im-picker-row-body">
                    <span className="im-picker-row-title" title={label}>
                      {label}
                    </span>
                    {hint ? (
                      <span className="im-picker-row-hint" title={channel.platformId}>
                        {hint}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPlatformBody = (platformGroup: PickerPlatformGroup) => (
    <div className="im-picker-platform-body">
      {platformGroup.sources.map((sourceGroup) => renderSourceBlock(platformGroup, sourceGroup))}
    </div>
  );

  return (
    <div
      className={`im-picker-scroll${useFillHeight ? " im-picker-scroll--fill" : ""}`}
      style={
        !useFillHeight && listMaxHeight > 0 ? { maxHeight: listMaxHeight } : undefined
      }
    >
      {grouped.map((platformGroup) => {
        const channelCount = platformChannelCount(platformGroup);
        const platformSelected = countSelectedInChannels(
          selectedIds,
          platformGroup.sources.flatMap((source) => source.channels),
        );
        const platformExpanded = expandedPlatforms.has(platformGroup.platform) || searching;

        if (!usePlatformGroups) {
          return (
            <section key={platformGroup.platform} className="im-picker-platform-section is-flat">
              {renderPlatformBody(platformGroup)}
            </section>
          );
        }

        return (
          <section
            key={platformGroup.platform}
            className={`im-picker-platform-section${platformExpanded ? " is-expanded" : " is-collapsed"}`}
          >
            <button
              type="button"
              className="im-picker-platform-toggle"
              aria-expanded={platformExpanded}
              onClick={() => onTogglePlatform(platformGroup.platform)}
            >
              <ChevronRight
                size={15}
                aria-hidden="true"
                className={`im-picker-chevron${platformExpanded ? " is-open" : ""}`}
              />
              <PlatformIcon platform={platformGroup.platform} size={15} />
              <span className="im-picker-platform-name">{platformGroup.platformLabel}</span>
              <span className="im-picker-platform-count">{channelCount}</span>
              {platformSelected > 0 && (
                <span className="im-picker-selected-badge">
                  {t("channelPicker.selectedBadge", { count: platformSelected })}
                </span>
              )}
            </button>
            {platformExpanded && renderPlatformBody(platformGroup)}
          </section>
        );
      })}
    </div>
  );
}

export { sourceKey, platformChannelCount };
