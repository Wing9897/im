import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PlatformIcon } from "../../common/PlatformIcon";
import type { ChannelWithAccount } from "../../../types";
import type {
  PickerAccountGroup,
  PickerPlatformGroup,
} from "../../../utils/groupChannelsForPicker";
import {
  channelDisplayHint,
  channelDisplayLabel,
  countSelectedInChannels,
  PICKER_ACCOUNT_COLLAPSE_THRESHOLD,
} from "../../../utils/channelPickerModel";

function platformChannelCount(group: PickerPlatformGroup): number {
  return group.accounts.reduce((sum, account) => sum + account.channels.length, 0);
}

function accountKey(platform: string, account: PickerAccountGroup): string {
  return `${platform}:${account.accountId ?? account.accountLabel}`;
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
  expandedAccounts: Set<string>;
  onTogglePlatform: (platform: string) => void;
  onToggleAccount: (key: string) => void;
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
  expandedAccounts,
  onTogglePlatform,
  onToggleAccount,
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

  const renderAccountBlock = (platformGroup: PickerPlatformGroup, accountGroup: PickerAccountGroup) => {
    const key = accountKey(platformGroup.platform, accountGroup);
    const accountExpanded = expandedAccounts.has(key) || searching;
    const accountSelected = countSelectedInChannels(selectedIds, accountGroup.channels);
    const collapsibleAccount =
      platformGroup.pickerLayout === "account-tree" &&
      accountGroup.channels.length > PICKER_ACCOUNT_COLLAPSE_THRESHOLD;

    return (
      <div key={key} className="im-picker-account-block">
        {platformGroup.pickerLayout === "account-tree" &&
          (collapsibleAccount ? (
            <button
              type="button"
              className="im-picker-account-toggle"
              aria-expanded={accountExpanded}
              onClick={() => onToggleAccount(key)}
            >
              <ChevronRight
                size={14}
                aria-hidden="true"
                className={`im-picker-chevron${accountExpanded ? " is-open" : ""}`}
              />
              {!usePlatformGroups ? (
                <PlatformIcon platform={platformGroup.platform} size={14} />
              ) : null}
              <span className="im-picker-account-name">{accountGroup.accountLabel}</span>
              <span className="im-picker-account-count">{accountGroup.channels.length}</span>
              {accountSelected > 0 && (
                <span className="im-picker-selected-badge">
                  {t("channelPicker.selectedBadge", { count: accountSelected })}
                </span>
              )}
            </button>
          ) : (
            <div className="im-picker-account-label">
              {!usePlatformGroups ? (
                <PlatformIcon platform={platformGroup.platform} size={14} />
              ) : null}
              <span className="im-picker-account-name">{accountGroup.accountLabel}</span>
              <span className="im-picker-account-count">{accountGroup.channels.length}</span>
            </div>
          ))}
        {(!collapsibleAccount || accountExpanded) && (
          <div className="im-picker-rows">
            {accountGroup.channels.map((channel: ChannelWithAccount) => {
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
      {platformGroup.accounts.map((accountGroup) => renderAccountBlock(platformGroup, accountGroup))}
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
          platformGroup.accounts.flatMap((account) => account.channels),
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

export { accountKey, platformChannelCount };
