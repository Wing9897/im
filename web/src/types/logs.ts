// ============================================================
// Log Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

/** OpenAPI wire shape for a stored / listed app log. */
export type AppLogEntryPayload = components["schemas"]["AppLogEntryResponse"];

/** Log severity level (server SoT: `server/domain/app_log_levels.py`). */
export type LogLevel = AppLogEntryPayload["level"];

/** Log category for classification ("frontend" = browser-originated logs
    accepted by POST /api/v1/logs). */
export type LogCategory = AppLogEntryPayload["category"];

/**
 * UI shape for {@link AppLogEntryPayload} (`details` optional, `kind` defaulted).
 * Runtime conversion: `toAppLogEntry` in `context/appRuntimeShared`.
 */
export type AppLogEntry = Omit<AppLogEntryPayload, "details" | "kind"> & {
  /** Stable event kind from the API (defaults to `"event"` if missing). */
  kind: string;
  details?: string;
};

/**
 * Input for creating a runtime / frontend log via `recordAppLog` /
 * `RuntimeLogsState.addLog`. Prefer `messageKey` + `payload` over baked details.
 */
export type AppLogInput = {
  level: LogLevel;
  category: LogCategory;
  kind: string;
  message: string;
  messageKey?: string;
  messageParams?: Record<string, unknown>;
  source?: string;
  payload?: unknown;
};

export type AppLogCursorPayload = components["schemas"]["AppLogCursorResponse"];

export type AppLogPagePayload = components["schemas"]["AppLogPageResponse"];
