import { useTranslation } from "react-i18next";
import { SourceCard, SourceCardErrorLines } from "../SourceCard";
import { SourceCardActions } from "../SourceCardActions";
import { Button } from "../../../components/ui";
import type { RssFeedItem } from "./providers/types";
import { formatAccountLabel } from "../../../utils/accountDisplay";
import { formatOsDateTime } from "../../../utils/time";
import { useReconnectCard } from "../useReconnectCard";

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
  const status = feed.account.status;
  const name = formatAccountLabel(feed.account) || feed.feedUrl;
  const showError = status === "error" || status === "disconnected";
  const minutes = Math.round(feed.pollIntervalSeconds / 60);

  const { reconnecting, reconnectError, handleReconnect } = useReconnectCard({
    accountId: feed.account.id,
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
        accountLastError={feed.account.lastError}
        reconnectError={reconnectError}
        lastSuccessAt={feed.lastSuccessAt}
        showLastSuccessOnError
      />
      <div className="mt-0.5 text-[10px] text-text-muted">
        {feed.account.updatedAt
          ? t("card.lastPoll", { time: formatOsDateTime(feed.account.updatedAt) })
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
      platform={feed.account.platform}
      status={status}
      title={name}
      subtitle={subtitle}
      actions={actions}
      onSelect={onSelectClick}
    />
  );
}
