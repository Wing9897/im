import type { ChannelWithSource } from "../types";
import { formatChannelSourceLabel } from "./sourceDisplay";
import { sortChannelsByName } from "./channelPickerModel";
import { groupChannelsByPlatform } from "./platform";
import { getPlatformSpec, platformDisplayLabel, type PickerLayout } from "./platformRegistry";
import i18n from "../i18n";

export interface PickerSourceGroup {
  sourceId: string | null;
  sourceLabel: string;
  channels: ChannelWithSource[];
}

export interface PickerPlatformGroup {
  platform: string;
  platformLabel: string;
  pickerLayout: PickerLayout;
  sources: PickerSourceGroup[];
}

function groupBySource(channels: ChannelWithSource[]): PickerSourceGroup[] {
  const map = new Map<string, ChannelWithSource[]>();
  for (const channel of channels) {
    const key = channel.sourceId ?? "__orphan__";
    const bucket = map.get(key);
    if (bucket) bucket.push(channel);
    else map.set(key, [channel]);
  }

  return Array.from(map.entries())
    .map(([key, bucket]) => ({
      sourceId: key === "__orphan__" ? null : key,
      sourceLabel: formatChannelSourceLabel(bucket[0]) || String(i18n.t("ui.unnamedSource")),
      channels: sortChannelsByName(bucket),
    }))
    .sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel));
}

export function groupChannelsForPicker(channels: ChannelWithSource[]): PickerPlatformGroup[] {
  return groupChannelsByPlatform(channels).map(([platform, platformChannels]) => {
    const { pickerLayout } = getPlatformSpec(platform);
    const sources =
      pickerLayout === "source-tree"
        ? groupBySource(platformChannels)
        : sortChannelsByName(platformChannels).map((channel) => ({
            sourceId: channel.sourceId ?? null,
            sourceLabel: formatChannelSourceLabel(channel) || String(i18n.t("ui.unnamedSource")),
            channels: [channel],
          }));

    return {
      platform,
      platformLabel: platformDisplayLabel(platform),
      pickerLayout,
      sources,
    };
  });
}
