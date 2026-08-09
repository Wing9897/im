import type { ReactNode } from "react";
import { contentFadeClass } from "../../../components/ui/pageLayout";
import { CardGrid } from "../../../components/ui";
import { MessageCard } from "../../../components/common/MessageCard";
import type { Message } from "../../../types";

interface MonitorCardFeedProps {
  messages: Message[];
  isMessageRead: (id: string) => boolean;
  onSelectMessage: (message: Message) => void;
  setListContainerRef: (node: HTMLDivElement | null) => void;
  footer: ReactNode;
}

/**
 * Card stream on the page scroll canvas (no boxed max-height scroller).
 * Anchor ref is for virtualization / scroll-parent discovery; IO root is the
 * page scroll parent via useInfiniteScroll(root: null).
 */
export function MonitorCardFeed({
  messages,
  isMessageRead,
  onSelectMessage,
  setListContainerRef,
  footer,
}: MonitorCardFeedProps) {
  return (
    <div
      ref={setListContainerRef}
      className={`im-animate-in min-w-0 ${contentFadeClass}`}
      data-allow-opacity-transition
    >
      <CardGrid className="im-monitor-feed-board">
        {messages.map((msg) => (
          <MessageCard
            key={msg.id}
            message={msg}
            isRead={isMessageRead(msg.id)}
            onSelect={() => onSelectMessage(msg)}
          />
        ))}
      </CardGrid>
      {footer}
    </div>
  );
}
