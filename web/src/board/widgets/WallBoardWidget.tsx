import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listChannelsWithAccounts } from "../../api/channels";
import type { ChannelWithAccount } from "../../types";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";
import { WallBoardEmbed } from "../embeds/WallBoardEmbed";

/** Message wall compact embed — mounts heavy wall UI only while active. */
export function WallBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(() => listChannelsWithAccounts(), []);
  const { data: channels, error, loading, refresh } = useBoardWidgetPoll<ChannelWithAccount[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  return (
    <div className="board-widget-body board-widget-wall" data-testid="board-wall-widget">
      <BoardWidgetShell
        active={active}
        pausedLabel={t("board.common.pausedWall")}
        pausedTestId="board-wall-paused"
        loading={loading && !channels}
        error={!channels ? error : null}
        onRetry={refresh}
        empty={Array.isArray(channels) && channels.length === 0}
        emptyLabel={t("board.wallWidget.empty")}
      >
        {channels && channels.length > 0 ? <WallBoardEmbed channels={channels} /> : null}
      </BoardWidgetShell>
    </div>
  );
}
