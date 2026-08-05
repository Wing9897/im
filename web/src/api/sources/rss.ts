/** RSS feed source management. */

import { apiClient } from "../client";
import type { components } from "../generated/schema";
import type { AddRssFeedResponse, RssFeedInfo, RssFeedPatch } from "../../types";

type RssFeedBody = components["schemas"]["RssFeedBody"];
type CreateRssFeedParams = Pick<RssFeedBody, "feedUrl"> &
  Partial<Omit<RssFeedBody, "feedUrl">>;

/** Creates a new RSS feed source. */
export function createRssFeed(
  params: CreateRssFeedParams,
): Promise<AddRssFeedResponse> {
  return apiClient.post<AddRssFeedResponse>("/api/v1/sources/rss", params);
}

/** Updates an existing RSS feed and reconnects. */
export function updateRssFeed(
  sourceId: string,
  params: RssFeedPatch,
): Promise<AddRssFeedResponse> {
  return apiClient.patch<AddRssFeedResponse>(
    `/api/v1/sources/rss/${sourceId}`,
    params,
  );
}

/** Fetches all registered RSS feed sources. */
export function listRssFeeds(): Promise<RssFeedInfo[]> {
  return apiClient.get<RssFeedInfo[]>("/api/v1/sources/rss");
}
