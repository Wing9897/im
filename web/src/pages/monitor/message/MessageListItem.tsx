import React from "react";
import { useTranslation } from "react-i18next";
import type { Message } from "../../../types";
import { PlatformTag } from "../../../components/common/PlatformTag";
import { formatOsDateTime } from "../../../utils/time";
import { SelectableSurface } from "../../../components/detail/SelectableSurface";
import { ListRowMain, ListRowTime } from "../../../components/ui";

interface MessageListItemProps {
  message: Message;
  onSelect?: () => void;
  isSelected?: boolean;
  isRead?: boolean;
}

/**
 * Compact stream row:
 * [time] [platform icon] [channel] [sender] [content…]
 */
export const MessageListItem = React.memo(function MessageListItem({
  message,
  onSelect,
  isSelected = false,
  isRead = true,
}: MessageListItemProps) {
  const { t } = useTranslation("monitor");
  const senderLabel =
    message.senderName || message.senderId || t("message.unknownSender");

  return (
    <SelectableSurface
      variant="row"
      semanticRole="row"
      onSelect={onSelect}
      selectAriaLabel={
        onSelect ? t("message.viewDetailAria", { sender: senderLabel }) : undefined
      }
      isSelected={isSelected}
      className="im-monitor-list-item"
    >
      <ListRowTime dateTime={message.timestamp} role="cell">
        {formatOsDateTime(message.timestamp)}
      </ListRowTime>
      <span
        className={`h-1.5 w-1.5 shrink-0 ${isRead ? "" : "rounded-full bg-accent"}`}
        role="cell"
        aria-label={isRead ? undefined : t("message.unread")}
        title={isRead ? undefined : t("message.unread")}
        aria-hidden={isRead ? "true" : undefined}
      />
      <PlatformTag
        platform={message.platform}
        className="im-monitor-list-platform-tag"
        role="cell"
      />
      {message.channelName && (
        <span
          className="im-monitor-list-source max-w-[120px] shrink-0 truncate text-xs text-text-secondary"
          title={message.channelName ?? undefined}
          role="cell"
        >
          {message.channelName}
        </span>
      )}
      <span
        className={`max-w-[140px] shrink-0 truncate text-xs text-text-primary ${
          isRead ? "font-medium" : "font-semibold"
        }`}
        title={message.senderName || message.senderId || undefined}
        role="cell"
      >
        {message.senderName || message.senderId}
      </span>
      <ListRowMain
        title={message.content}
        role="cell"
        className={
          isRead
            ? "im-monitor-list-body text-text-secondary"
            : "im-monitor-list-body is-unread font-medium text-text-primary"
        }
      >
        {message.content}
      </ListRowMain>
    </SelectableSurface>
  );
});
