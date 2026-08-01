/** HTTP poll source management. */

import { apiClient } from "../client";
import type { components } from "../generated/schema";
import type { AddHttpSourceResponse, HttpSourceInfo, HttpSourcePatch } from "../../types";

type HttpSourceBody = components["schemas"]["HttpSourceBody"];
type CreateHttpSourceParams = Pick<HttpSourceBody, "url"> &
  Partial<Omit<HttpSourceBody, "url">>;

/** Creates a new HTTP poll source. */
export function createHttpSource(
  params: CreateHttpSourceParams,
): Promise<AddHttpSourceResponse> {
  return apiClient.post<AddHttpSourceResponse>("/api/v1/accounts/http", params);
}

/** Updates an existing HTTP poll source and reconnects. */
export function updateHttpSource(
  accountId: string,
  params: HttpSourcePatch,
): Promise<AddHttpSourceResponse> {
  return apiClient.patch<AddHttpSourceResponse>(
    `/api/v1/accounts/http/${accountId}`,
    params,
  );
}

/** Fetches all registered HTTP poll sources. */
export function listHttpSources(): Promise<HttpSourceInfo[]> {
  return apiClient.get<HttpSourceInfo[]>("/api/v1/accounts/http");
}
