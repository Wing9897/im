import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { queryMessagesPage } from "../../api/messages";
import { MessageCard } from "../../components/common/MessageCard";
import { useAnalysisStatus } from "../../context/AnalysisStatusContext";
import type { Message } from "../../types";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

const FEED_LIMIT = 10;

/** Compact monitor card list (truncated via FeedCard clamp). */
export function FeedBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const { lastMessagesUpdate } = useAnalysisStatus();
  const fetcher = useCallback(
    () =>
      queryMessagesPage({ filters: {}, limit: FEED_LIMIT, includeTotal: false }).then(
        (page) => page.messages,
      ),
    [],
  );
  const { data: messages, error, loading, refresh } = useBoardWidgetPoll<Message[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  useEffect(() => {
    if (!lastMessagesUpdate) return;
    refresh();
  }, [lastMessagesUpdate, refresh]);

  return (
    <div className="board-widget-body board-widget-feed" data-testid="board-feed-widget">
      <BoardWidgetShell
        loading={loading && !messages}
        error={!messages ? error : null}
        onRetry={refresh}
        empty={Array.isArray(messages) && messages.length === 0}
        emptyLabel={t("board:feed.empty")}
      >
        {messages && messages.length > 0 ? (
          <ul className="board-feed-cards">
            {messages.map((msg) => (
              <li key={msg.id} className="board-feed-cards__item">
                <div
                  className="board-feed-cards__hit"
                  data-testid={`board-feed-row-${msg.id}`}
                >
                  <MessageCard message={msg} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}
