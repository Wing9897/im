import React from "react";
import { Clock, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Message } from "../../types";
import { PlatformTag } from "./PlatformTag";
import { formatOsDateTime } from "../../utils/time";
import { CardFieldIcon, CardTitleIcon } from "../ui/CardFieldRow";
import { FeedCard } from "../ui/FeedCard";
import { cardTitleClass } from "../ui/pageTypography";

interface MessageCardProps {
  message: Message;
  onSelect?: () => void;
  isRead?: boolean;
}

export const MessageCard = React.memo(function MessageCard({
  message,
  onSelect,
  isRead = true,
}: MessageCardProps) {
  const { t } = useTranslation("common");
  const channelLabel = message.channelName || message.platformId;
  const senderLabel = message.senderName || message.senderId || t("ui.unknownSender");

  return (
    <FeedCard
      className="im-monitor-message-card"
      onClick={onSelect}
      aria-label={
        onSelect ? t("ui.viewMessageAria", { sender: senderLabel }) : undefined
      }
      header={
        <>
          {!isRead ? (
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              aria-label={t("ui.unread")}
              title={t("ui.unread")}
            />
          ) : null}
          <CardTitleIcon icon={MessageSquare} />
          <span
            className={`min-w-0 flex-1 truncate ${cardTitleClass} ${
              isRead ? "" : "font-semibold"
            }`}
            title={senderLabel}
          >
            {senderLabel}
          </span>
          <PlatformTag
            platform={message.platform}
            className="im-monitor-card-platform-tag shrink-0"
          />
        </>
      }
      meta={
        <>
          {channelLabel ? <span title={channelLabel}>{channelLabel}</span> : null}
          {channelLabel ? " · " : null}
          <span className="inline-flex items-center gap-xs">
            <CardFieldIcon icon={Clock} />
            <time dateTime={message.timestamp}>{formatOsDateTime(message.timestamp)}</time>
          </span>
        </>
      }
      body={
        <span data-testid="message-card-content" title={message.content}>
          {message.content}
        </span>
      }
    />
  );
});
