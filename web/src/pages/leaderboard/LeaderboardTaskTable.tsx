import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AiStaffAvatar } from "../../components/aiStaff/AiStaffAvatar";
import type { Message, TrendingTopic } from "../../types";
import { platformDisplayLabel } from "../../utils/platformRegistry";
import { formatOsDateTime } from "../../utils/time";
import { LeaderboardRow } from "./LeaderboardRow";
import { LeaderboardTopicModal } from "./LeaderboardTopicModal";
import { leaderboardPlatformBadgeProps } from "./leaderboardClasses";

const headerDateOptions: Intl.DateTimeFormatOptions = {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export const LeaderboardTaskTable = memo(function LeaderboardTaskTable({
  taskName,
  topics,
  expandedTopicId,
  topicMessages,
  loadingMessages,
  topicMessageErrors,
  onToggleTopic,
  platforms,
}: {
  taskName: string;
  topics: TrendingTopic[];
  expandedTopicId: string | null;
  topicMessages: Record<string, Message[]>;
  loadingMessages: Record<string, boolean>;
  topicMessageErrors: Record<string, string>;
  onToggleTopic: (topicId: string) => void;
  platforms?: string[];
}) {
  const { t } = useTranslation("common");
  const latestUpdatedAt = useMemo(
    () => topics.map((topic) => topic.createdAt).sort().at(-1),
    [topics],
  );

  const expandedTopic = topics.find((topic) => topic.id === expandedTopicId) ?? null;
  const expandedIndex = expandedTopic ? topics.indexOf(expandedTopic) : -1;

  return (
    <section className="im-leaderboard-board" aria-label={t("leaderboard.boardAria", { name: taskName })}>
      <header className="im-leaderboard-header">
        <div className="flex min-w-0 items-center gap-sm">
          <AiStaffAvatar
            staffId="leaderboard"
            size="xs"
            label={t("aiStaff.leaderboard")}
          />
          <h3 className="im-leaderboard-title" title={taskName}>
            {taskName}
          </h3>
        </div>
        <div className="im-leaderboard-meta">
          <span>Top {Math.min(topics.length, 10)}</span>
          {latestUpdatedAt && (
            <>
              <span className="im-leaderboard-meta-dot" aria-hidden="true" />
              <span>{formatOsDateTime(latestUpdatedAt, headerDateOptions)}</span>
            </>
          )}
          {platforms?.map((platform) => (
            <span
              key={platform}
              {...leaderboardPlatformBadgeProps(platform)}
            >
              {platformDisplayLabel(platform)}
            </span>
          ))}
        </div>
      </header>

      <ol className="im-leaderboard-list">
        {topics.map((topic, index) => (
          <LeaderboardRow
            key={topic.id}
            topic={topic}
            rank={topic.rank || index + 1}
            expanded={expandedTopicId === topic.id}
            onToggleTopic={onToggleTopic}
          />
        ))}
      </ol>

      {expandedTopic && (
        <LeaderboardTopicModal
          taskName={taskName}
          topic={expandedTopic}
          rank={expandedTopic.rank || expandedIndex + 1}
          messages={topicMessages[expandedTopic.id] || []}
          isLoadingMessages={!!loadingMessages[expandedTopic.id]}
          messageError={topicMessageErrors[expandedTopic.id] ?? null}
          onClose={() => onToggleTopic(expandedTopic.id)}
        />
      )}
    </section>
  );
});
