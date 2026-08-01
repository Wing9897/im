import { useCallback, useMemo, type CSSProperties } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ChannelWithAccount } from "../../types";
import { EmptyState } from "../../components/common/EmptyState";
import { SectionErrorBoundary } from "../../components/common/SectionErrorBoundary";
import {
  useWallMediaCache,
  useWallData,
  WallCard,
  WallChannelPicker,
} from "../../components/monitor/wall";
import { useWallFullscreen } from "../../components/monitor/wall/useWallFullscreen";
import { wallFullscreenGrid } from "../../domain/monitor/wall/wallFullscreenLayout";
import { MonitorToolbar } from "./MonitorToolbar";
import type { MonitorViewMode } from "../../domain/monitor/monitorViewMode";
import { contentFadeClass } from "../../components/ui/pageLayout";
import { MONITOR_WALL_SKELETON_CLASS } from "../../domain/monitor/wall/wallConstants";
import { monitorWallStatusLabel } from "./monitorStatusLabel";
import { useErrorToast } from "../../hooks/useErrorToast";

interface MonitorWallSectionProps {
  viewMode: MonitorViewMode;
  onViewModeChange: (mode: MonitorViewMode) => void;
  /** Shared channel list from useMonitorData (avoids a duplicate channel fetch). */
  channels: ChannelWithAccount[];
  /** False while the shared channel catalog is still loading. */
  channelsReady?: boolean;
  totalCount: number;
  statsLoading: boolean;
  metadataError?: string | null;
  onRetryMetadata?: () => void;
}

export function MonitorWallSection({
  viewMode,
  onViewModeChange,
  channels,
  channelsReady = true,
  totalCount,
  statsLoading,
  metadataError,
}: MonitorWallSectionProps) {
  const { t } = useTranslation("monitor");
  const { get: getCachedUrl, put: putCachedUrl, revokeExcept } = useWallMediaCache();
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
    isRefreshing,
    error,
    advanceSlot,
    setSlotIndex,
  } = useWallData(channels, handleRetainedIdsChange, channelsReady);
  useErrorToast(metadataError);
  useErrorToast(error);
  const { containerRef, isFullscreen, toggleFullscreen } = useWallFullscreen();

  const wallLoadedCount = useMemo(
    () =>
      Object.values(slots).reduce((sum, slot) => sum + slot.queue.length, 0),
    [slots],
  );

  const statusLabel = monitorWallStatusLabel(
    selectedChannelIds.length,
    initialLoading,
    totalCount,
    statsLoading,
    wallLoadedCount,
  );

  const fsGrid = wallFullscreenGrid(selectedChannelIds.length);
  const gridStyle = isFullscreen
    ? ({
        gridTemplateColumns: `repeat(${fsGrid.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${fsGrid.rows}, minmax(0, 1fr))`,
      } as CSSProperties)
    : undefined;

  const fullscreenToggle = (
    <button
      type="button"
      className="inline-flex min-h-7 min-w-7 cursor-pointer items-center justify-center rounded-md border border-surface-border bg-transparent px-sm text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary"
      onClick={() => void toggleFullscreen()}
      aria-label={
        isFullscreen ? t("wall.exitFullscreen") : t("wall.enterFullscreen")
      }
      title={isFullscreen ? t("wall.exitFullscreen") : t("wall.enterFullscreen")}
      data-testid="wall-fullscreen-toggle"
    >
      {isFullscreen ? (
        <Minimize2 size={14} strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <Maximize2 size={14} strokeWidth={2.2} aria-hidden="true" />
      )}
    </button>
  );

  return (
    <div
      ref={containerRef}
      className="im-wall-fs-host"
      data-testid="monitor-wall-root"
    >
      <MonitorToolbar
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        isRefreshing={isRefreshing}
        statusLabel={statusLabel}
        controls={
          <>
            <WallChannelPicker
              channels={channels}
              selectedChannelIds={selectedChannelIds}
              onChange={setSelectedChannelIds}
            />
            {fullscreenToggle}
          </>
        }
      />

      <SectionErrorBoundary sectionName={t("sections.wall")}>
        {selectedChannelIds.length === 0 ? (
          <EmptyState
            title={t("wall.emptyTitle")}
            description={t("wall.emptyDescription")}
          />
        ) : initialLoading ? (
          <div
            className="im-wall-grid"
            style={gridStyle}
            aria-busy="true"
            aria-label={t("wall.loadingAria")}
          >
            {selectedChannelIds.map((channelId) => (
              <div key={channelId} className={MONITOR_WALL_SKELETON_CLASS} />
            ))}
          </div>
        ) : (
          <div
            className={`im-wall-grid ${contentFadeClass}`}
            style={gridStyle}
            data-allow-opacity-transition
          >
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
