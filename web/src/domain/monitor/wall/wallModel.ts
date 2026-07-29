import type { Message } from "../../../types";
import i18n from "../../../i18n";

export const WALL_QUEUE_LIMIT = 10;
export const WALL_CAROUSEL_INTERVAL_MS = 6000;

export interface WallSlotState {
  queue: Message[];
  currentIndex: number;
  unseenCount: number;
}

export function createEmptySlot(): WallSlotState {
  return { queue: [], currentIndex: 0, unseenCount: 0 };
}

/** Replace slot contents from bootstrap API (newest-first). */
export function bootstrapSlot(messages: Message[], limit = WALL_QUEUE_LIMIT): WallSlotState {
  return {
    queue: messages.slice(0, limit),
    currentIndex: 0,
    unseenCount: 0,
  };
}

/** Refresh a populated slot while preserving the visible message when possible. */
export function refreshSlot(
  slot: WallSlotState,
  messages: Message[],
  limit = WALL_QUEUE_LIMIT,
): WallSlotState {
  if (messages.length === 0) return slot;
  const queue = messages.slice(0, limit);
  const previousCurrentId = slot.queue[slot.currentIndex]?.id;
  const relocated = previousCurrentId
    ? queue.findIndex((entry) => entry.id === previousCurrentId)
    : -1;
  const currentIndex =
    relocated >= 0
      ? relocated
      : Math.min(slot.currentIndex, Math.max(queue.length - 1, 0));
  return { ...slot, queue, currentIndex };
}

/**
 * Insert a novel message at the front without jumping the carousel index.
 * Drops oldest entries beyond *limit* and clamps index when the current slide is removed.
 */
export function enqueueMessage(
  slot: WallSlotState,
  message: Message,
  limit = WALL_QUEUE_LIMIT,
): WallSlotState {
  if (slot.queue.some((entry) => entry.id === message.id)) {
    return slot;
  }

  const previousCurrentId = slot.queue[slot.currentIndex]?.id;
  const queue = [message, ...slot.queue].slice(0, limit);

  let currentIndex = slot.currentIndex;
  if (previousCurrentId) {
    const relocated = queue.findIndex((entry) => entry.id === previousCurrentId);
    if (relocated >= 0) {
      currentIndex = relocated;
    } else {
      currentIndex = Math.min(currentIndex, Math.max(queue.length - 1, 0));
    }
  } else {
    currentIndex = Math.min(currentIndex, Math.max(queue.length - 1, 0));
  }

  return {
    queue,
    currentIndex,
    unseenCount: slot.unseenCount + 1,
  };
}

export function advanceCarousel(slot: WallSlotState): WallSlotState {
  if (slot.queue.length <= 1) {
    return { ...slot, unseenCount: 0 };
  }
  const nextIndex = (slot.currentIndex + 1) % slot.queue.length;
  const unseenCount = nextIndex === 0 ? 0 : slot.unseenCount;
  return { ...slot, currentIndex: nextIndex, unseenCount };
}

export function channelKeyForMessage(message: Message): string {
  return `${message.platform}:${message.platformId}`;
}

function mediaPlaceholderLabel(kind: string | undefined): string {
  switch (kind) {
    case "photo":
      return String(i18n.t("monitor:wallCard.mediaPhoto"));
    case "video":
      return String(i18n.t("monitor:wallCard.mediaVideo"));
    case "gif":
      return String(i18n.t("monitor:wallCard.mediaGif"));
    case "sticker":
      return String(i18n.t("monitor:wallCard.mediaSticker"));
    case "audio":
      return String(i18n.t("monitor:wallCard.mediaAudio"));
    case "file":
      return String(i18n.t("monitor:wallCard.mediaFile"));
    default:
      return "";
  }
}

export function displayContent(message: Message): string {
  const trimmed = message.content.trim();
  if (trimmed) return trimmed;
  return mediaPlaceholderLabel(message.media?.kind) || String(i18n.t("monitor:wallCard.noText"));
}

export function isVisualMediaKind(kind: string | undefined): boolean {
  return kind === "photo" || kind === "video" || kind === "gif";
}
