/**
 * REST API client functions for application log operations.
 */

import { apiClient } from "./client";
import type {
  AppLogCursorPayload,
  AppLogEntryPayload,
  AppLogPagePayload,
} from "../types";



/** Fetches a page of application logs using cursor-based pagination. */
export function queryAppLogsPage(query: {
  cursor: AppLogCursorPayload | null;
  limit: number;
}): Promise<AppLogPagePayload> {
  const params: Record<string, string> = {};
  params.limit = String(query.limit);
  if (query.cursor) {
    params.cursor_time = query.cursor.time;
    params.cursor_id = query.cursor.id;
  }
  return apiClient.get<AppLogPagePayload>("/api/v1/logs", params);
}

/** Persists a new application log entry to the backend. */
export function appendAppLog(entry: {
  level: string;
  category: string;
  message: string;
  details?: string | null;
}): Promise<AppLogEntryPayload> {
  return apiClient.post<AppLogEntryPayload>("/api/v1/logs", entry);
}

/** Deletes all application log entries. */
export function clearAppLogs(): Promise<void> {
  return apiClient.delete<void>("/api/v1/logs");
}
