import { useMemo } from "react";
import type { ChannelWithSource } from "../../../types";
import { groupChannelsForPicker } from "../../../utils/groupChannelsForPicker";
import { filterChannelsByQuery } from "../../../utils/channelPickerModel";

export function useChannelPickerGroups(
  channels: ChannelWithSource[],
  query: string,
  hidePlatformHeaders: boolean,
) {
  const filteredChannels = useMemo(
    () => filterChannelsByQuery(channels, query),
    [channels, query],
  );
  const grouped = useMemo(() => groupChannelsForPicker(filteredChannels), [filteredChannels]);
  const allGrouped = useMemo(() => groupChannelsForPicker(channels), [channels]);
  return {
    filteredChannels,
    grouped,
    allGrouped,
    // Keep platform headers (with logos) even for a single platform, unless the
    // caller already filtered to one platform via hidePlatformHeaders.
    usePlatformGroups: !hidePlatformHeaders && grouped.length > 0,
    expansionUsesPlatformGroups: !hidePlatformHeaders && allGrouped.length > 0,
  };
}
