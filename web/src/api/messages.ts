/**
 * REST API client functions for messages.
 */

import { apiClient } from "./client";
import type { MessageCursor, MessageFilters, MessagePage } from "../types";

/** Fetches a page of messages using cursor-based pagination with filters. */
export function queryMessagesPage(query: {
  filters: MessageFilters;
  cursor?: MessageCursor | null;
  limit: number;
  includeTotal?: boolean;
}): Promise<MessagePage> {
  const params: Record<string, string> = {};
  if (query.filters.sourceIds?.length)
    params.sourceIds = query.filters.sourceIds.join(",");
  if (query.filters.channelIds?.length)
    params.channelIds = query.filters.channelIds.join(",");
  if (query.filters.timeRange) params.timeRange = query.filters.timeRange;
  if (query.filters.search) params.search = query.filters.search;
  if (query.filters.platform) params.platform = query.filters.platform;
  params.limit = String(query.limit);
  if (query.includeTotal === false) params.includeTotal = "false";
  if (query.cursor) {
    params.cursorTime = query.cursor.timestamp;
    params.cursorId = query.cursor.id;
  }
  return apiClient.get<MessagePage>("/api/v1/messages/page", params);
}

/** Fetch message media as a blob (Telegram proxy; auth header required). */
export function fetchMessageMediaBlob(
  messageId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  // Media can be large — disable the default request timeout.
  return apiClient.getBlob(`/api/v1/messages/${messageId}/media`, { signal, timeoutMs: 0 });
}
