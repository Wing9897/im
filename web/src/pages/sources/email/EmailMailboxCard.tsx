import { useTranslation } from "react-i18next";
import { SourceCard, SourceCardErrorLines } from "../board/SourceCard";
import { SourceCardActions } from "../board/SourceCardActions";
import { Button } from "../../../components/ui";
import { formatOsDateTime } from "../../../utils/time";
import type { EmailMailboxInfo } from "../../../types";
import { useReconnectCard } from "../board/useReconnectCard";

interface EmailMailboxCardProps {
  mailbox: EmailMailboxInfo;
  onRemoveClick: () => void;
  onEditClick: () => void;
  onSelectClick: () => void;
  onReconnectSuccess: () => void;
}

export function EmailMailboxCard({
  mailbox,
  onRemoveClick,
  onEditClick,
  onSelectClick,
  onReconnectSuccess,
}: EmailMailboxCardProps) {
  const { t } = useTranslation("sources");
  const status = mailbox.source.status;
  const showError = status === "error" || status === "disconnected";

  const { reconnecting, reconnectError, handleReconnect } = useReconnectCard({
    sourceId: mailbox.source.id,
    onReconnectSuccess,
  });

  const folderSummary =
    mailbox.folders.length > 0
      ? mailbox.folders.join(", ")
      : t("email.noFolders");
  const minutes = Math.round(mailbox.pollIntervalSeconds / 60);

  const subtitle = (
    <>
      <span title={`${mailbox.imapHost} · ${folderSummary}`}>
        {mailbox.imapHost} · {t("email.foldersCount", { count: mailbox.folders.length })} ·{" "}
        {t("card.pollEveryMinutes", { minutes })}
        {mailbox.lastSuccessAt && status === "connected" && (
          <>
            {" "}
            · {t("email.lastSuccessInline", { time: formatOsDateTime(mailbox.lastSuccessAt) })}
          </>
        )}
      </span>
      <SourceCardErrorLines
        status={status}
        lastError={mailbox.lastError}
        sourceLastError={mailbox.source.lastError}
        reconnectError={reconnectError}
      />
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
      platform="email"
      status={status}
      title={mailbox.username || mailbox.source.name || t("email.fallbackName")}
      subtitle={subtitle}
      actions={actions}
      onSelect={onSelectClick}
    />
  );
}
