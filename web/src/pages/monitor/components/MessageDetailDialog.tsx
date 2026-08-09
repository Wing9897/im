import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Message } from "../../../types";
import { Button } from "../../../components/ui";
import { PlatformTag } from "../../../components/common/PlatformTag";
import { DetailPresentationShell, type DetailPresentation } from "../../../components/detail";
import {
  detailDialogFlexColClass,
  detailDialogShellClass,
  messageDetailBubbleClass,
  messageDetailCompactMetaClass,
  messageDetailFooterClass,
  messageDetailHeaderClass,
  messageDetailMetaClass,
  messageDetailSenderClass,
  messageDetailTechPanelClass,
  messageDetailTechToggleClass,
  sourceDetailBodyClass,
} from "../../../components/detail/classes";
import { formatOsDateTime } from "../../../utils/time";

interface MessageDetailViewProps {
  message: Message;
  onClose: () => void;
  presentation?: DetailPresentation;
}

export function MessageDetailView({
  message,
  onClose,
  presentation = "modal",
}: MessageDetailViewProps) {
  const { t } = useTranslation("monitor");
  const { t: tc } = useTranslation("common");
  const [techOpen, setTechOpen] = useState(false);
  const senderLabel =
    message.senderName || message.senderId || t("message.unknownSender");
  const mediaLabel = message.media
    ? `${message.media.kind}${message.media.mime ? ` (${message.media.mime})` : ""}`
    : null;
  const emDash = tc("emDash");

  const content = (
    <>
      <header className={messageDetailHeaderClass}>
        <h2 className={messageDetailSenderClass}>{senderLabel}</h2>
        <div className={messageDetailMetaClass}>
          <span>{formatOsDateTime(message.timestamp)}</span>
          <PlatformTag platform={message.platform} size={10} />
        </div>
      </header>

      <div className={sourceDetailBodyClass}>
        <div className={messageDetailBubbleClass} data-testid="message-detail-bubble">
          <pre>{message.content || t("message.noContent")}</pre>
        </div>

        <div className={messageDetailCompactMetaClass}>
          <span>
            {t("message.channel", {
              name: message.channelName ?? message.platformId,
            })}
          </span>
          {mediaLabel ? <span>{t("message.media", { label: mediaLabel })}</span> : null}
          <span>{t("message.id", { id: message.id })}</span>
        </div>

        <button
          type="button"
          className={messageDetailTechToggleClass}
          aria-expanded={techOpen}
          onClick={() => setTechOpen((open) => !open)}
        >
          {techOpen ? t("message.hideTech") : t("message.showTech")}
        </button>

        {techOpen ? (
          <div className={messageDetailTechPanelClass}>
            <div>
              {t("message.platformMessageId", {
                id: message.platformMessageId ?? emDash,
              })}
            </div>
            <div>
              {t("message.sourceId", { id: message.sourceId ?? emDash })}
            </div>
            <div>{t("message.platformId", { id: message.platformId })}</div>
            <div>
              {t("message.createdAt", { time: formatOsDateTime(message.createdAt) })}
            </div>
            {message.rawData ? (
              <div>
                {t("message.rawDataLabel")}
                {message.rawData.length > 500
                  ? t("message.rawDataTruncated", {
                      preview: message.rawData.slice(0, 500),
                      count: message.rawData.length,
                    })
                  : message.rawData}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className={messageDetailFooterClass}>
        <Button variant="secondary" onClick={onClose}>
          {tc("dialog.close")}
        </Button>
      </footer>
    </>
  );

  return (
    <DetailPresentationShell
      presentation={presentation}
      onClose={onClose}
      className={
        presentation === "inline" ? detailDialogFlexColClass : detailDialogShellClass
      }
      width="min(560px, calc(100vw - 32px))"
      aria-label={t("message.detailAria", { sender: senderLabel })}
    >
      {content}
    </DetailPresentationShell>
  );
}

interface MessageDetailDialogProps {
  message: Message;
  onClose: () => void;
  presentation?: DetailPresentation;
}

export function MessageDetailDialog({
  message,
  onClose,
  presentation = "modal",
}: MessageDetailDialogProps) {
  return (
    <MessageDetailView message={message} onClose={onClose} presentation={presentation} />
  );
}
