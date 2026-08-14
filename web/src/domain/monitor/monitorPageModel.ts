import type { MonitorViewMode } from "./monitorViewMode";
import type { Source, Channel, Message, MessageFilters } from "../../types";
import i18n from "../../i18n";
import { getOsTimeMs } from "../../utils/time";
import { getScrollViewportRangeInContainer } from "../../utils/scrollParent";

export const PAGE_SIZE = 40;

/* Compact ui-data-row: 7px padding ×2 + 18px line + 1px border */
const LIST_ITEM_HEIGHT = 33;
const LIST_OVERSCAN = 18;
const LIST_VIEWPORT_BUFFER_PX = 280;
const LIST_INITIAL_WINDOW = 80;

interface MessageListWindow {
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  visibleMessages: Message[];
}

export function mergeUniqueMessages(
  current: Message[],
  incoming: Message[],
  mode: "prepend" | "append" = "prepend",
): Message[] {
  if (incoming.length === 0) return current;
  const seen = new Set(current.map((message) => message.id));
  const novel = incoming.filter((message) => !seen.has(message.id));
  if (novel.length === 0) return current;
  return mode === "append" ? [...current, ...novel] : [...novel, ...current];
}

export function normalizeMonitorFilters(
  filters: MessageFilters,
  sources: Source[],
  channels: Array<Pick<Channel, "id">>,
): { filters: MessageFilters; changed: boolean } {
  const validSourceIds = new Set(sources.map((source) => source.id));
  const validChannelIds = new Set(channels.map((channel) => channel.id));

  const nextSourceIds = filters.sourceIds?.filter((sourceId) =>
    validSourceIds.has(sourceId),
  );
  const nextChannelIds = filters.channelIds?.filter((channelId) =>
    validChannelIds.has(channelId),
  );
  const normalizedFilters: MessageFilters = {
    ...filters,
    sourceIds:
      nextSourceIds && nextSourceIds.length > 0 ? nextSourceIds : undefined,
    channelIds:
      nextChannelIds && nextChannelIds.length > 0 ? nextChannelIds : undefined,
  };

  return {
    filters: normalizedFilters,
    changed:
      (filters.sourceIds?.length ?? 0) !==
        (normalizedFilters.sourceIds?.length ?? 0) ||
      (filters.channelIds?.length ?? 0) !==
        (normalizedFilters.channelIds?.length ?? 0),
  };
}

export function getMessageListWindow({
  viewMode,
  messages,
  listContainerNode,
}: {
  viewMode: MonitorViewMode;
  messages: Message[];
  listContainerNode: HTMLDivElement | null;
}): MessageListWindow {
  if (viewMode !== "list" || messages.length === 0) {
    return {
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      visibleMessages: messages,
    };
  }

  if (!listContainerNode) {
    const initialCount = Math.min(messages.length, LIST_INITIAL_WINDOW);
    return {
      topSpacerHeight: 0,
      bottomSpacerHeight: Math.max(
        0,
        (messages.length - initialCount) * LIST_ITEM_HEIGHT,
      ),
      visibleMessages: messages.slice(0, initialCount),
    };
  }

  const { visibleTop, visibleBottom } = getScrollViewportRangeInContainer(
    listContainerNode,
    LIST_VIEWPORT_BUFFER_PX,
  );

  const startIndex = Math.max(
    0,
    Math.floor(visibleTop / LIST_ITEM_HEIGHT) - LIST_OVERSCAN,
  );
  const endIndex = Math.min(
    messages.length,
    Math.ceil(visibleBottom / LIST_ITEM_HEIGHT) + LIST_OVERSCAN,
  );

  return {
    topSpacerHeight: startIndex * LIST_ITEM_HEIGHT,
    bottomSpacerHeight: Math.max(
      0,
      (messages.length - endIndex) * LIST_ITEM_HEIGHT,
    ),
    visibleMessages: messages.slice(startIndex, endIndex),
  };
}

export function hasActiveMessageFilters(filters: MessageFilters): boolean {
  return countActiveMessageFilters(filters) > 0;
}

export function countActiveMessageFilters(filters: MessageFilters): number {
  let count = 0;
  if (filters.search?.trim()) count += 1;
  if (filters.platform) count += 1;
  if (filters.sourceIds && filters.sourceIds.length > 0) count += 1;
  if (filters.timeRange) count += 1;
  if (filters.channelIds && filters.channelIds.length > 0) count += 1;
  return count;
}

export type ActiveMessageFilterChipKey =
  | "search"
  | "platform"
  | "timeRange"
  | "sources"
  | "channels";

export interface ActiveMessageFilterChip {
  key: ActiveMessageFilterChipKey;
  label: string;
}

const TIME_RANGE_CHIP_KEYS: Record<string, string> = {
  today: "filter.timeToday",
  "7d": "filter.time7d",
  "30d": "filter.time30d",
};

/** Compact chip descriptors for toolbar summary (removable outside the dialog). */
export function describeActiveMessageFilters(
  filters: MessageFilters,
  options?: {
    platformLabel?: (platform: string) => string;
  },
): ActiveMessageFilterChip[] {
  const chips: ActiveMessageFilterChip[] = [];
  const search = filters.search?.trim();
  if (search) {
    const query = search.length > 18 ? `${search.slice(0, 18)}…` : search;
    chips.push({
      key: "search",
      label: String(i18n.t("monitor:filterChip.search", { query })),
    });
  }
  if (filters.platform) {
    const label = options?.platformLabel?.(filters.platform) ?? filters.platform;
    chips.push({ key: "platform", label });
  }
  if (filters.timeRange) {
    const key = TIME_RANGE_CHIP_KEYS[filters.timeRange];
    chips.push({
      key: "timeRange",
      label: key
        ? String(i18n.t(`monitor:${key}`))
        : filters.timeRange,
    });
  }
  if (filters.sourceIds && filters.sourceIds.length > 0) {
    chips.push({
      key: "sources",
      label: String(
        i18n.t("monitor:filterChip.sources", {
          count: filters.sourceIds.length,
        }),
      ),
    });
  }
  if (filters.channelIds && filters.channelIds.length > 0) {
    chips.push({
      key: "channels",
      label: String(
        i18n.t("monitor:filterChip.channels", {
          count: filters.channelIds.length,
        }),
      ),
    });
  }
  return chips;
}

export function clearMessageFilterKey(
  filters: MessageFilters,
  key: ActiveMessageFilterChipKey,
): MessageFilters {
  switch (key) {
    case "search":
      return { ...filters, search: undefined };
    case "platform":
      return { ...filters, platform: undefined };
    case "timeRange":
      return { ...filters, timeRange: undefined };
    case "sources":
      return { ...filters, sourceIds: undefined };
    case "channels":
      return { ...filters, channelIds: undefined };
    default:
      return filters;
  }
}

export function matchesFilters(message: Message, filters: MessageFilters): boolean {
  if (filters.platform) {
    if (message.platform !== filters.platform) return false;
  }
  if (filters.sourceIds && filters.sourceIds.length > 0) {
    if (message.sourceId === null || !filters.sourceIds.includes(message.sourceId))
      return false;
  }
  if (filters.channelIds && filters.channelIds.length > 0) {
    const msgChannelKey = `${message.platform}:${message.platformId}`;
    if (!filters.channelIds.includes(msgChannelKey)) return false;
  }
  if (filters.timeRange) {
    const msgTime = getOsTimeMs(message.timestamp);
    const now = Date.now();
    let cutoff: number;
    switch (filters.timeRange) {
      case "today": {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        cutoff = start.getTime();
        break;
      }
      case "7d":
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "30d":
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        return true;
    }
    if (msgTime < cutoff) return false;
  }
  if (filters.search && filters.search.trim()) {
    const keyword = filters.search.trim().toLowerCase();
    const haystack = [
      message.senderName,
      message.senderId,
      message.channelName,
      message.content,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(keyword)) return false;
  }
  return true;
}
