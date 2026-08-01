import type { AnalysisTask } from "../../../types/tasks";
import type { ChannelWithAccount } from "../../../types/channels";
import { platformDisplayLabel } from "../../../utils/platformRegistry";

export function buildChannelNameById(
  channels: readonly ChannelWithAccount[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const channel of channels) {
    const label = channel.channelName?.trim() || channel.platformId;
    map.set(channel.id, label);
    map.set(`${channel.platform}:${channel.platformId}`, label);
  }
  return map;
}

export function channelRefKey(ref: AnalysisTask["channelIds"][number]): string {
  return ref.id || `${ref.platform}:${ref.platformId}`;
}

export function resolveChannelLabel(
  ref: AnalysisTask["channelIds"][number],
  channelNameById?: ReadonlyMap<string, string>,
): string {
  const key = channelRefKey(ref);
  const name = channelNameById?.get(key) ?? channelNameById?.get(`${ref.platform}:${ref.platformId}`);
  if (name) {
    return name;
  }
  const platform = platformDisplayLabel(ref.platform);
  return `${platform} · ${ref.platformId}`;
}
