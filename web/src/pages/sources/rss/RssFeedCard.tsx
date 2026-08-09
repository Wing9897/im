import { useTranslation } from "react-i18next";
import { SourceCard, SourceCardErrorLines } from "../board/SourceCard";
import { SourceCardActions } from "../board/SourceCardActions";
import { Button } from "../../../components/ui";
import type { RssFeedItem } from "./providers/types";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { formatOsDateTime } from "../../../utils/time";
import { useReconnectCard } from "../board/useReconnectCard";

interface RssFeedCardProps {
  feed: RssFeedItem;
  onEditClick: () => void;
  onRemoveClick: () => void;
  onSelectClick: () => void;
  onReconnectSuccess: () => void;
}

export function RssFeedCard({
  feed,
  onEditClick,
  onRemoveClick,
  onSelectClick,
  onReconnectSuccess,
}: RssFeedCardProps) {
  const { t } = useTranslation("sources");
  const status = feed.source.status;
  const name = formatSourceLabel(feed.source) || feed.feedUrl;
  const showError = status === "error" || status === "disconnected";
  const minutes = Math.round(feed.pollIntervalSeconds / 60);

  const { reconnecting, reconnectError, handleReconnect } = useReconnectCard({
    sourceId: feed.source.id,
    onReconnectSuccess,
  });

  const subtitle = (
    <>
      <span
        className="block overflow-hidden text-ellipsis whitespace-nowrap break-all"
        title={feed.feedUrl}
      >
        {feed.feedUrl} · {t("card.pollEveryMinutes", { minutes })}
      </span>
      <SourceCardErrorLines
        status={status}
        lastError={feed.lastError}
        sourceLastError={feed.source.lastError}
        reconnectError={reconnectError}
        lastSuccessAt={feed.lastSuccessAt}
        showLastSuccessOnError
      />
      <div className="mt-0.5 text-[10px] text-text-muted">
        {feed.source.updatedAt
          ? t("card.lastPoll", { time: formatOsDateTime(feed.source.updatedAt) })
          : t("card.neverPolled")}
      </div>
    </>
  );

  const actions = (
    <>
      <Button size="sm" variant="secondary" onClick={onEditClick}>
        {t("shared.edit")}
      </Button>
      <SourceCardActions
        showReconnect={showError}
        reconnecting={reconnecting}
        onReconnect={handleReconnect}
        onRemove={onRemoveClick}
      />
    </>
  );

  return (
    <SourceCard
      platform={feed.source.platform}
      status={status}
      title={name}
      subtitle={subtitle}
      actions={actions}
      onSelect={onSelectClick}
    />
  );
}
