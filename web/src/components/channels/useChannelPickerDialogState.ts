import { useEffect, useMemo, useState } from "react";

import type { ChannelWithAccount } from "../../types";
import { useDraftSelection } from "../../hooks/useDraftSelection";
import { uniquePlatformsFromChannels } from "../../utils/platformFilter";

/** Shared draft + platform-filter state for channel picker modals. */
export function useChannelPickerDialogState(
  channels: ChannelWithAccount[],
  selectedChannelIds: string[],
  open: boolean,
) {
  const [platformFilter, setPlatformFilter] = useState("");
  const [draftIds, setDraftIds, resetDraft] = useDraftSelection(selectedChannelIds, open);

  useEffect(() => {
    if (open) setPlatformFilter("");
  }, [open]);

  const platforms = useMemo(() => uniquePlatformsFromChannels(channels), [channels]);

  const visibleChannels = useMemo(
    () =>
      platformFilter
        ? channels.filter((channel) => channel.platform === platformFilter)
        : channels,
    [channels, platformFilter],
  );

  return {
    platformFilter,
    setPlatformFilter,
    draftIds,
    setDraftIds,
    resetDraft,
    platforms,
    visibleChannels,
  };
}
