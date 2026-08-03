// ============================================================
// Log Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

/** Log severity level */
export type LogLevel = "info" | "success" | "warning" | "error";

/** Log category for classification ("frontend" = browser-originated logs
    accepted by POST /api/v1/logs). */
export type LogCategory = "analysis" | "collector" | "account" | "system" | "frontend";

/** OpenAPI wire shape for a stored / listed app log. */
export type AppLogEntryPayload = components["schemas"]["AppLogEntryResponse"];

/**
 * UI-narrowed {@link AppLogEntryPayload} (`level` / `category` as closed unions).
 * Runtime conversion: `toAppLogEntry` in `context/appRuntimeShared`.
 */
export type AppLogEntry = Omit<AppLogEntryPayload, "level" | "category" | "details"> & {
  level: LogLevel;
  category: LogCategory;
  details?: string;
};

/** Input type for creating a new log entry (id and time are auto-generated) */
export type AppLogInput = Omit<AppLogEntry, "id" | "time">;

export type AppLogCursorPayload = components["schemas"]["AppLogCursorResponse"];

export type AppLogPagePayload = components["schemas"]["AppLogPageResponse"];
