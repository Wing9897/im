import { useEffect, useState, memo } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Channel, Message } from "../../../types";
import { platformDisplayLabel } from "../../../utils/platformRegistry";
import type { WallSlotState } from "../../../domain/monitor/wall/wallModel";
import {
  displayContent,
  isVisualMediaKind,
  WALL_CAROUSEL_INTERVAL_MS,
} from "../../../domain/monitor/wall/wallModel";
import { pickWallLayout } from "../../../domain/monitor/wall/wallLayout";
import { useSlideMedia } from "./useSlideMedia";
import {
  wallCardInlineStyle,
  wallContentProps,
  wallDotClass,
  wallEmptyBodyClass,
  wallMainClass,
  wallMediaErrorClass,
  wallMediaFrameProps,
  wallMediaImageClass,
  wallMediaRetryClass,
} from "./wallCardLayout";
import { WallMediaLightbox } from "./WallMediaLightbox";

interface WallCardProps {
  channel: Pick<Channel, "id" | "platform" | "platformId" | "channelName"> | undefined;
  slot: WallSlotState;
  onAdvance: () => void;
  onSelectIndex: (index: number) => void;
  getCachedUrl: (messageId: string) => string | undefined;
  putCachedUrl: (messageId: string, objectUrl: string) => string;
}

function MediaRegion({
  message,
  onAspectRatio,
  onMediaClick,
  getCachedUrl,
  putCachedUrl,
}: {
  message: Message;
  onAspectRatio: (ratio: number | null) => void;
  onMediaClick: (objectUrl: string) => void;
  getCachedUrl: (messageId: string) => string | undefined;
  putCachedUrl: (messageId: string, objectUrl: string) => string;
}) {
  const { t } = useTranslation("monitor");
  const hasText = Boolean(message.content.trim());
  const { objectUrl, loading, failed, retry } = useSlideMedia({
    message,
    enabled: true,
    getCachedUrl,
    putCachedUrl,
  });

  useEffect(() => {
    onAspectRatio(null);
  }, [message.id, onAspectRatio]);

  if (!message.media || !isVisualMediaKind(message.media.kind)) {
    return null;
  }

  if (objectUrl) {
    return (
      <img
        src={objectUrl}
        alt={hasText ? "" : displayContent(message)}
        className={`cursor-zoom-in ${wallMediaImageClass}`}
        role="button"
        tabIndex={0}
        aria-label={t("wallCard.expandMedia")}
        onClick={() => onMediaClick(objectUrl)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onMediaClick(objectUrl);
          }
        }}
        onLoad={(event) => {
          const img = event.currentTarget;
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            onAspectRatio(img.naturalWidth / img.naturalHeight);
          }
        }}
      />
    );
  }

  if (failed) {
    return (
      <div className={wallMediaErrorClass} role="status">
        <ImageOff size={17} aria-hidden="true" />
        <span>{t("wallCard.mediaFailed")}</span>
        <button type="button" className={wallMediaRetryClass} onClick={retry}>
          {t("wallCard.retry")}
        </button>
      </div>
    );
  }

  return loading ? (
    <span role="status" aria-live="polite" aria-label={t("wallCard.mediaLoading")}>
      <Loader2
        size={22}
        className="im-spin shrink-0 text-[var(--wall-text-muted)]"
        aria-hidden="true"
      />
    </span>
  ) : null;
}

export const WallCard = memo(function WallCard({
  channel,
  slot,
  onAdvance,
  onSelectIndex,
  getCachedUrl,
  putCachedUrl,
}: WallCardProps) {
  const { t } = useTranslation("monitor");
  const [paused, setPaused] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const currentMessage = slot.queue[slot.currentIndex];

  useEffect(() => {
    setAspectRatio(null);
    setLightboxUrl(null);
  }, [currentMessage?.id]);

  useEffect(() => {
    if (slot.queue.length <= 1 || paused) return undefined;
    const timer = window.setInterval(onAdvance, WALL_CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [onAdvance, paused, slot.queue.length]);

  const channelLabel = channel?.channelName || channel?.platformId || t("wallCard.unknownChannel");
  const platform = channel?.platform ?? currentMessage?.platform ?? "telegram";
  const channelKey = channel?.id ?? `${platform}:${currentMessage?.platformId ?? "unknown"}`;
  const rawContent = currentMessage?.content.trim() ?? "";
  const hasVisualMedia = Boolean(
    currentMessage?.media && isVisualMediaKind(currentMessage.media.kind),
  );
  const hasText = Boolean(rawContent);
  const content = currentMessage
    ? hasVisualMedia && !rawContent
      ? ""
      : displayContent(currentMessage)
    : "";

  const layoutMode = pickWallLayout({
    hasVisualMedia,
    hasText,
    textLength: rawContent.length,
    aspectRatio,
  });

  return (
    <article
      className="im-wall-card im-card-hover"
      style={wallCardInlineStyle(channelKey)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label={t("wallCard.carouselAria", { channel: channelLabel })}
    >
      <span className="im-wall-backdrop" aria-hidden="true" />
      <span className="im-wall-scrim" aria-hidden="true" />

      <p className="im-wall-watermark" title={`${channelLabel} · ${platformDisplayLabel(platform)}`}>
        {channelLabel} · {platformDisplayLabel(platform)}
      </p>

      {currentMessage ? (
        <div className={wallMainClass(layoutMode)}>
          {hasVisualMedia && (
            <div {...wallMediaFrameProps(layoutMode, rawContent.length, aspectRatio)}>
              <MediaRegion
                message={currentMessage}
                onAspectRatio={setAspectRatio}
                onMediaClick={setLightboxUrl}
                getCachedUrl={getCachedUrl}
                putCachedUrl={putCachedUrl}
              />
            </div>
          )}
          {content && (
            <p {...wallContentProps(content.length, layoutMode)}>{content}</p>
          )}
        </div>
      ) : (
        <div className={wallEmptyBodyClass}>{t("wallCard.empty")}</div>
      )}

      {slot.queue.length > 0 && (
        <div className="im-wall-dots-row" aria-label={t("wallCard.dotsAria")}>
          {slot.queue.map((message, index) => (
            <button
              key={message.id}
              type="button"
              aria-label={t("wallCard.dotAria", { index: index + 1 })}
              aria-current={index === slot.currentIndex ? "true" : undefined}
              className={wallDotClass(index === slot.currentIndex)}
              onClick={() => onSelectIndex(index)}
            />
          ))}
        </div>
      )}
      {slot.unseenCount > 0 && (
        <span className="im-wall-badge">
          {t("wallCard.newBadge", { count: slot.unseenCount })}
        </span>
      )}

      <WallMediaLightbox
        open={lightboxUrl != null}
        imageUrl={lightboxUrl ?? ""}
        title={`${channelLabel} · ${platformDisplayLabel(platform)}`}
        caption={content || undefined}
        onClose={() => setLightboxUrl(null)}
      />
    </article>
  );
});
