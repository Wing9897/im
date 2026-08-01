import type { ChannelWithAccount } from "../types";
import { formatChannelAccountLabel } from "./accountDisplay";
import { sortChannelsByName } from "./channelPickerModel";
import { groupChannelsByPlatform } from "./platform";
import { getPlatformSpec, platformDisplayLabel, type PickerLayout } from "./platformRegistry";
import i18n from "../i18n";

export interface PickerAccountGroup {
  accountId: string | null;
  accountLabel: string;
  channels: ChannelWithAccount[];
}

export interface PickerPlatformGroup {
  platform: string;
  platformLabel: string;
  pickerLayout: PickerLayout;
  accounts: PickerAccountGroup[];
}

function groupByAccount(channels: ChannelWithAccount[]): PickerAccountGroup[] {
  const map = new Map<string, ChannelWithAccount[]>();
  for (const channel of channels) {
    const key = channel.accountId ?? "__orphan__";
    const bucket = map.get(key);
    if (bucket) bucket.push(channel);
    else map.set(key, [channel]);
  }

  return Array.from(map.entries())
    .map(([key, bucket]) => ({
      accountId: key === "__orphan__" ? null : key,
      accountLabel: formatChannelAccountLabel(bucket[0]) || String(i18n.t("ui.unnamedAccount")),
      channels: sortChannelsByName(bucket),
    }))
    .sort((a, b) => a.accountLabel.localeCompare(b.accountLabel));
}

export function groupChannelsForPicker(channels: ChannelWithAccount[]): PickerPlatformGroup[] {
  return groupChannelsByPlatform(channels).map(([platform, platformChannels]) => {
    const { pickerLayout } = getPlatformSpec(platform);
    const accounts =
      pickerLayout === "account-tree"
        ? groupByAccount(platformChannels)
        : sortChannelsByName(platformChannels).map((channel) => ({
            accountId: channel.accountId ?? null,
            accountLabel: formatChannelAccountLabel(channel) || String(i18n.t("ui.unnamedAccount")),
            channels: [channel],
          }));

    return {
      platform,
      platformLabel: platformDisplayLabel(platform),
      pickerLayout,
      accounts,
    };
  });
}
