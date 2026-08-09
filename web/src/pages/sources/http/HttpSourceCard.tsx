import { useTranslation } from "react-i18next";
import { SourceCard, SourceCardErrorLines } from "../board/SourceCard";
import { SourceCardActions } from "../board/SourceCardActions";
import { Button } from "../../../components/ui";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { formatOsDateTime } from "../../../utils/time";
import type { HttpSourceInfo } from "../../../types";
import { useReconnectCard } from "../board/useReconnectCard";

interface HttpSourceCardProps {
  source: HttpSourceInfo;
  onEditClick: () => void;
  onRemoveClick: () => void;
  onSelectClick: () => void;
  onReconnectSuccess: () => void;
}

export function HttpSourceCard({
  source,
  onEditClick,
  onRemoveClick,
  onSelectClick,
  onReconnectSuccess,
}: HttpSourceCardProps) {
  const { t } = useTranslation("sources");
  const status = source.source.status;
  const name = formatSourceLabel(source.source) || source.url;
  const showError = status === "error" || status === "disconnected";
  const minutes = Math.round(source.pollIntervalSeconds / 60);

  const { reconnecting, reconnectError, handleReconnect } = useReconnectCard({
    sourceId: source.source.id,
    onReconnectSuccess,
  });

  const subtitle = (
    <>
      <span
        className="block overflow-hidden text-ellipsis whitespace-nowrap break-all"
        title={source.url}
      >
        {source.method} {source.url} · {t("card.pollEveryMinutes", { minutes })}
      </span>
      <SourceCardErrorLines
        status={status}
        lastError={source.lastError}
        sourceLastError={source.source.lastError}
        reconnectError={reconnectError}
        lastSuccessAt={source.lastSuccessAt}
        showLastSuccessOnError
      />
      <div className="mt-0.5 text-[10px] text-text-muted">
        {source.source.updatedAt
          ? t("card.lastPoll", { time: formatOsDateTime(source.source.updatedAt) })
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
      platform="http"
      status={status}
      title={name}
      subtitle={subtitle}
      actions={actions}
      onSelect={onSelectClick}
    />
  );
}
