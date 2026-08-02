import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fetchTrendingTopics } from "../../api/results";
import { useRefreshOnAnalysisEvent } from "../../hooks/useRefreshOnAnalysisEvent";
import type { TrendingTopic } from "../../types";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

/** Compact trending / leaderboard list for the ops board. */
export function LeaderboardBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(() => fetchTrendingTopics(), []);
  const { data: topics, error, loading, refresh } = useBoardWidgetPoll<TrendingTopic[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );
  useRefreshOnAnalysisEvent(refresh, { analysisMode: "leaderboard" });

  const ranked = (topics ?? [])
    .filter((item) => item.rank != null)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 12);

  return (
    <div className="board-widget-body" data-testid="board-leaderboard-widget">
      <BoardWidgetShell
        loading={loading && !topics}
        error={!topics ? error : null}
        onRetry={refresh}
        empty={Boolean(topics) && ranked.length === 0}
        emptyLabel={t("board.leaderboard.empty")}
      >
        {ranked.length > 0 ? (
          <ul className="board-widget-list">
            {ranked.map((topic) => (
              <li key={topic.id} className="board-widget-list__item">
                <button
                  type="button"
                  className="board-widget-list__row"
                  data-testid={`board-leaderboard-row-${topic.id}`}
                >
                  <span className="board-widget-list__primary">
                    <span className="board-rank-chip">#{topic.rank}</span>
                    {topic.topicName || t("board.common.untitled")}
                  </span>
                  <span className="board-widget-list__meta">
                    {topic.taskName ? `${topic.taskName} · ` : ""}
                    {t("board.leaderboard.score", { score: topic.score })}
                    {topic.messageCount != null
                      ? t("board.leaderboard.messages", { count: topic.messageCount })
                      : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}
