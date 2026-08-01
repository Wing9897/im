/** REST API client functions for channel-oriented data. */

import { apiClient } from "./client";
import type { ChannelWithAccount, Message } from "../types";

/** Fetches all channels with their associated account metadata. */
export function listChannelsWithAccounts(): Promise<ChannelWithAccount[]> {
  return apiClient.get<ChannelWithAccount[]>("/api/v1/channels/with-accounts");
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
