/** Platform-agnostic source CRUD (list / delete / reconnect / refresh). */

import { apiClient } from "../client";
import type { Source, AddSourceResponse, RefreshAllSourcesResponse } from "../../types";

/** Fetches all registered sources as Source[]. */
export function listSources(): Promise<Source[]> {
  return apiClient.get<Source[]>("/api/v1/sources");
}

/** Removes an source and its associated data by ID. */
export function deleteSource(sourceId: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/sources/${sourceId}`);
}

/** Attempts to reconnect a disconnected source. */
export function reconnectSource(sourceId: string): Promise<AddSourceResponse> {
  return apiClient.post<AddSourceResponse>(
    `/api/v1/sources/${sourceId}/reconnect`,
  );
}

/** Triggers a refresh of all registered sources' connection status. */
export function refreshAllSources(): Promise<RefreshAllSourcesResponse> {
  return apiClient.post<RefreshAllSourcesResponse>(
    "/api/v1/sources/refresh-all",
  );
}
