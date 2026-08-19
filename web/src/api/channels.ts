/** REST API client functions for channel-oriented data. */

import { apiClient } from "./client";
import type { ChannelWithSource, Message } from "../types";

/** Fetches all channels with their associated source metadata. */
export function listChannelsWithSources(): Promise<ChannelWithSource[]> {
  return apiClient.get<ChannelWithSource[]>("/api/v1/channels");
}

/** Bootstraps the newest messages per channel for the wall page. */
export function fetchLatestByChannels(
  channelIds: string[],
  limit: number,
): Promise<Record<string, Message[]>> {
  if (channelIds.length === 0) {
    return Promise.resolve({});
  }
  return apiClient.get<Record<string, Message[]>>("/api/v1/channels/latest-messages", {
    channels: channelIds.join(","),
    limit: String(limit),
  });
}
