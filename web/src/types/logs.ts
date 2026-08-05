// ============================================================
// Log Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

/** Log severity level */
export type LogLevel = "info" | "success" | "warning" | "error";

/** Log category for classification ("frontend" = browser-originated logs
    accepted by POST /api/v1/logs). */
export type LogCategory = "analysis" | "collector" | "source" | "system" | "frontend";

/** OpenAPI wire shape for a stored / listed app log. */
export type AppLogEntryPayload = components["schemas"]["AppLogEntryResponse"];

/**
 * UI-narrowed {@link AppLogEntryPayload} (`level` / `category` as closed unions).
 * Runtime conversion: `toAppLogEntry` in `context/appRuntimeShared`.
 */
export type AppLogEntry = Omit<AppLogEntryPayload, "level" | "category" | "details" | "kind"> & {
  level: LogLevel;
  category: LogCategory;
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
