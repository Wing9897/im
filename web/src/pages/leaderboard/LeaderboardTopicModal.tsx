import { useTranslation } from "react-i18next";
import { SurfaceCard } from "../../components/ui";
import { statValueClass } from "../../components/ui/pageTypography";
import { EmptyState } from "../../components/common/EmptyState";
import { MessageCard } from "../../components/common/MessageCard";
import { ModalDialog } from "../../components/ModalDialog";
import type { Message, TrendingTopic } from "../../types";
import { formatOsDateTime } from "../../utils/time";
import { useErrorToast } from "../../hooks/useErrorToast";

export function LeaderboardTopicModal({
  taskName,
  topic,
  rank,
  messages,
  isLoadingMessages,
  messageError,
  onClose,
}: {
  taskName: string;
  topic: TrendingTopic;
  rank: number;
  messages: Message[];
  isLoadingMessages: boolean;
  messageError: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  useErrorToast(
    messageError ? t("leaderboard:loadMessagesFailed", { error: messageError }) : null,
  );

  return (
    <ModalDialog
      open
      size="wide"
      ariaLabel={t("leaderboard:detailAria", { name: taskName })}
      onClose={onClose}
      footer={<></>}
      bodyClassName="flex flex-col gap-sm"
    >
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-sm">
            <span className={`${statValueClass} text-accent`}>#{rank}</span>
            <span className="text-section-title font-semibold text-text-primary">{topic.topicName}</span>
            <span className={`${statValueClass} text-info`}>{topic.score.toFixed(1)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-sm text-[11px] text-text-muted">
            <span>{taskName}</span>
            <span>{formatOsDateTime(topic.createdAt)}</span>
          </div>
        </div>
      </div>

      <SurfaceCard density="field">
        <div className="text-[10px] font-bold tracking-wide text-text-secondary">
          {t("leaderboard:summary")}
        </div>
        <div className="mt-1 text-[11px] leading-snug text-text-primary">
          {topic.summary || t("leaderboard:noSummary")}
        </div>
      </SurfaceCard>

      <div className="min-h-4 text-[11px] leading-4 text-text-muted">
        {isLoadingMessages
          ? t("leaderboard:loadingMessages")
          : t("leaderboard:relatedMessages", { count: messages.length })}
      </div>

      <div className="grid min-h-[160px] max-h-[360px] gap-sm overflow-y-auto [scrollbar-gutter:stable]">
        {!isLoadingMessages && !messageError && messages.length === 0 ? (
          <EmptyState
            compact
            title={t("leaderboard:noMessagesTitle")}
            description={t("leaderboard:noMessagesDescription")}
          />
        ) : null}
        {isLoadingMessages
          ? null
          : messages.map((message) => (
              <MessageCard key={message.id} message={message} />
            ))}
      </div>
    </ModalDialog>
  );
}
