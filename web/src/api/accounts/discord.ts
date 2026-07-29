/** Discord bot source management. */

import { apiClient } from "../client";
import type { components } from "../generated/schema";
import type { AddDiscordBotResponse, DiscordBotInfo } from "../../types";

type DiscordBotBody = components["schemas"]["DiscordBotBody"];
type DiscordBotPatch = components["schemas"]["DiscordBotPatchBody"];
type DiscordSubscribeResponse =
  components["schemas"]["DiscordSubscribeResponse"];

/** Creates a new Discord bot source with the given token. */
export function createDiscordBot(
  params: DiscordBotBody,
): Promise<AddDiscordBotResponse> {
  return apiClient.post<AddDiscordBotResponse>("/api/v1/accounts/discord", params);
}

/** Updates Discord bot display name and/or bot token (token change reconnects). */
export function updateDiscordBot(
  accountId: string,
  patch: DiscordBotPatch,
): Promise<AddDiscordBotResponse> {
  return apiClient.patch<AddDiscordBotResponse>(
    `/api/v1/accounts/discord/${accountId}`,
    patch,
  );
}

/** Subscribes a Discord bot to the specified channel IDs for message collection. */
export function subscribeDiscordChannels(
  accountId: string,
  channelIds: string[],
): Promise<DiscordSubscribeResponse> {
  return apiClient.post<DiscordSubscribeResponse>(
    `/api/v1/accounts/discord/${accountId}/subscribe`,
    { channelIds },
  );
}

/** Fetches all registered Discord bot sources. */
export function listDiscordBots(): Promise<DiscordBotInfo[]> {
  return apiClient.get<DiscordBotInfo[]>("/api/v1/accounts/discord");
}
