import { formatMessage } from "../../i18n/formatMessage";
import { getDateTimeLocale } from "../../i18n/locale";
import {
  MSG_MONITOR_LOADING,
  MSG_MONITOR_STREAM_DONE,
  MSG_MONITOR_STREAM_MORE,
  MSG_MONITOR_WALL_LOADED,
  MSG_MONITOR_WALL_LOADING,
  MSG_MONITOR_WALL_PICK,
  MSG_MONITOR_WALL_READY,
  MSG_MONITOR_WALL_TOTAL,
} from "../../i18n/messageKeys";

export function monitorStreamStatusLabel({
  initialLoading,
  messagesLength,
  totalCount,
  hasMore,
}: {
  initialLoading: boolean;
  messagesLength: number;
  totalCount: number;
  hasMore: boolean;
  viewMode?: "card" | "list";
}): string {
  if (initialLoading) return formatMessage(MSG_MONITOR_LOADING);
  if (hasMore) {
    return formatMessage(MSG_MONITOR_STREAM_MORE, {
      loaded: messagesLength,
      total: totalCount,
    });
  }
  return formatMessage(MSG_MONITOR_STREAM_DONE, { total: totalCount });
}

export function monitorWallStatusLabel(
  selectedCount: number,
  initialLoading: boolean,
  totalCount: number,
  statsLoading: boolean,
  wallLoadedCount: number,
): string {
  if (selectedCount === 0) return formatMessage(MSG_MONITOR_WALL_PICK);
  if (initialLoading || statsLoading) {
    return formatMessage(MSG_MONITOR_WALL_LOADING, { selectedCount });
  }
  const locale = getDateTimeLocale();
  const totalPart = formatMessage(MSG_MONITOR_WALL_TOTAL, {
    total: totalCount.toLocaleString(locale),
  });
  const loadedPart =
    wallLoadedCount > 0
      ? formatMessage(MSG_MONITOR_WALL_LOADED, {
          loaded: wallLoadedCount.toLocaleString(locale),
        })
      : "";
  return formatMessage(MSG_MONITOR_WALL_READY, {
    selectedCount,
    totalPart,
    loadedPart,
  });
}
