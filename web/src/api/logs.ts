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
  /** Include only this kind (`?kind=`). */
  kind?: string;
  /** Exclude this kind (`?excludeKind=`, e.g. analysis.trace). */
  excludeKind?: string;
}): Promise<AppLogPagePayload> {
  const params: Record<string, string> = {};
  params.limit = String(query.limit);
  if (query.cursor) {
    params.cursor_time = query.cursor.time;
    params.cursor_id = query.cursor.id;
  }
  if (query.kind) {
    params.kind = query.kind;
  }
  if (query.excludeKind) {
    params.excludeKind = query.excludeKind;
  }
  return apiClient.get<AppLogPagePayload>("/api/v1/logs", params);
}

/** Body for POST /api/v1/logs — matches server LogCreate (no raw `details`). */
export type AppendAppLogBody = {
  level: string;
  category: string;
  kind: string;
  message?: string | null;
  messageKey?: string | null;
  messageParams?: Record<string, unknown> | null;
  source?: string | null;
  payload?: Record<string, unknown> | null;
};

/** Persists a new application log entry to the backend. */
export function appendAppLog(
  entry: AppendAppLogBody,
): Promise<AppLogEntryPayload> {
  return apiClient.post<AppLogEntryPayload>("/api/v1/logs", entry);
}

/** Deletes all application log entries. */
export function clearAppLogs(): Promise<void> {
  return apiClient.delete<void>("/api/v1/logs");
}
