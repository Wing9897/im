import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { TrendingTopic } from "../../types";

export const LeaderboardRow = memo(function LeaderboardRow({
  topic,
  rank,
  expanded,
  onToggleTopic,
}: {
  topic: TrendingTopic;
  rank: number;
  expanded: boolean;
  onToggleTopic: (topicId: string) => void;
}) {
  const { t } = useTranslation("common");
  const isTop = rank <= 3;

  return (
    <li className="im-leaderboard-item">
      <button
        type="button"
        className={[
          "im-leaderboard-row-btn",
          "im-leaderboard-row",
          isTop ? "is-top" : "",
          expanded ? "im-leaderboard-row-expanded" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onToggleTopic(topic.id)}
        aria-expanded={expanded}
        aria-label={t("leaderboard.rowAria", {
          rank,
          topic: topic.topicName,
          score: topic.score.toFixed(1),
        })}
      >
        <span className="im-leaderboard-rank">{rank}</span>
        <span className="im-leaderboard-topic" title={topic.topicName}>
          {topic.topicName}
        </span>
        <span className="im-leaderboard-score">{topic.score.toFixed(1)}</span>
      </button>
    </li>
  );
});
