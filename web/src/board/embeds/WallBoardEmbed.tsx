import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SectionErrorBoundary } from "../../components/common/SectionErrorBoundary";
import { EmptyState } from "../../components/common/EmptyState";
import { useErrorToast } from "../../hooks/useErrorToast";
import type { ChannelWithSource } from "../../types";
import {
  WallCard,
  WallChannelPicker,
  useWallData,
  useWallMediaCache,
} from "../../components/monitor/wall";
import { MONITOR_WALL_SKELETON_CLASS } from "../../domain/monitor/wall/wallConstants";
import { useBoardWidgetHeaderActions } from "../BoardWidgetFrame";

interface WallBoardEmbedProps {
  channels: ChannelWithSource[];
}

/** Compact message-wall grid for ops board (reuses monitor wall data + cards). */
export function WallBoardEmbed({ channels }: WallBoardEmbedProps) {
  const { t } = useTranslation();
  const { get: getCachedUrl, put: putCachedUrl, revokeExcept } = useWallMediaCache(16);
  const handleRetainedIdsChange = useCallback(
    (retainedIds: Set<string>) => revokeExcept(retainedIds),
    [revokeExcept],
  );
  const {
    channelById,
    selectedChannelIds,
    setSelectedChannelIds,
    slots,
    initialLoading,
    error,
    advanceSlot,
    setSlotIndex,
  } = useWallData(channels, handleRetainedIdsChange);
  useErrorToast(error);

  const headerActions = useMemo(
    () => (
      <WallChannelPicker
        channels={channels}
        selectedChannelIds={selectedChannelIds}
        onChange={setSelectedChannelIds}
        compact
      />
    ),
    [channels, selectedChannelIds, setSelectedChannelIds],
  );
  useBoardWidgetHeaderActions(headerActions);

  return (
    <div className="board-wall-embed" data-testid="board-wall-embed">
      <SectionErrorBoundary sectionName={t("board.wall.sectionName")}>
        {selectedChannelIds.length === 0 ? (
          <EmptyState
            title={t("board.wall.noChannelsTitle")}
            description={t("board.wall.noChannelsDescription")}
          />
        ) : initialLoading ? (
          <div
            className="board-wall-embed__grid"
            aria-busy="true"
            aria-label={t("board.wall.loadingAria")}
          >
            {selectedChannelIds.map((channelId) => (
              <div key={channelId} className={MONITOR_WALL_SKELETON_CLASS} />
            ))}
          </div>
        ) : (
          <div className="board-wall-embed__grid">
            {selectedChannelIds.map((channelId) => (
              <WallCard
                key={channelId}
                channel={channelById[channelId]}
                slot={slots[channelId] ?? { queue: [], currentIndex: 0, unseenCount: 0 }}
                onAdvance={() => advanceSlot(channelId)}
                onSelectIndex={(index) => setSlotIndex(channelId, index)}
                getCachedUrl={getCachedUrl}
                putCachedUrl={putCachedUrl}
              />
            ))}
          </div>
        )}
      </SectionErrorBoundary>
    </div>
  );
}
