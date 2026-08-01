// ============================================================
// Log Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

/** Log severity level */
export type LogLevel = "info" | "success" | "warning" | "error";

/** Log category for classification ("frontend" = browser-originated logs
    accepted by POST /api/v1/logs). */
export type LogCategory = "analysis" | "collector" | "account" | "system" | "frontend";

/** A runtime log entry displayed in the UI */
export interface AppLogEntry {
  id: string;
  time: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: string;
}

/** Input type for creating a new log entry (id and time are auto-generated) */
export type AppLogInput = Omit<AppLogEntry, "id" | "time">;

export type AppLogEntryPayload = components["schemas"]["AppLogEntryResponse"];

export type AppLogCursorPayload = components["schemas"]["AppLogCursorResponse"];

export type AppLogPagePayload = components["schemas"]["AppLogPageResponse"];
