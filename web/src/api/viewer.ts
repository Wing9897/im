/**
 * Viewer API operations using the unified REST API client.
 * Provides read-only access to viewer-specific endpoints for remote LAN clients.
 */

import { apiClient } from "./client";
import type { ViewerStats, ViewerStatus, ViewerTask } from "../types";

/** Fetches the viewer tasks list. */
export function fetchViewerTasks(): Promise<ViewerTask[]> {
  return apiClient.get<ViewerTask[]>("/api/v1/viewer/tasks");
}

/** Fetches the viewer stats summary. */
export function fetchViewerStats(): Promise<ViewerStats> {
  return apiClient.get<ViewerStats>("/api/v1/viewer/stats");
}

/** Fetches the viewer system status. */
export function fetchViewerStatus(): Promise<ViewerStatus> {
  return apiClient.get<ViewerStatus>("/api/v1/viewer/status");
}
