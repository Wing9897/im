// ============================================================
// Common / Shared Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

/** Supported messaging platforms */
export type Platform = string;

/** Account connection status */
export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

/**
 * Aggregate collector status (OpenAPI ``CollectorStatusResponse.status``).
 * ``CollectorManager.get_status()`` never reports transitional states.
 */
export type CollectorStatus = components["schemas"]["CollectorStatusResponse"]["status"];

/** GET ``/system/ai-engine/status`` wire payload (OpenAPI). */
export type AiEngineHealthStatus = components["schemas"]["AiEngineHealthStatusResponse"];

/** POST ``/system/ai-engine/test`` result (OpenAPI). */
export type AiEngineTestResult = components["schemas"]["AiEngineTestResultResponse"];

/**
 * Unsaved profile-card draft for ``POST /system/ai-engine/test`` (OpenAPI body).
 * Wire field names match ``LlmProfileUpsert`` connection fields.
 */
export type AiEngineTestDraft = components["schemas"]["AiEngineTestBody"];

/**
 * AI engine service status for UI/runtime — includes client-only ``unknown``
 * before the first successful probe (API only returns available／unavailable).
 */
export type AiEngineStatus = AiEngineHealthStatus["status"] | "unknown";

/** LLM Provider options (OpenAPI `LlmProfileUpsertBody.provider` — domain CHECK vocabulary). */
export type LlmProvider = components["schemas"]["LlmProfileUpsertBody"]["provider"];

/** Analysis mode — see `domain/tasks/analysisModeCapabilities` (FE SoT / BE drift-tested). */
export type { AnalysisMode } from "../domain/tasks/analysisModeCapabilities";

/**
 * Canonical task ``analysis_time_range`` windows (DB CHECK / task API).
 * Prefer this name when contrasting with {@link MessageTimeRange}.
 */
export type { TaskAnalysisTimeRange } from "../domain/tasks/taskAnalysisTimeRange";

/**
 * Monitor／agent message-query windows — task windows plus ``12h``／``24h``.
 * Never persist ``12h``／``24h`` on tasks (use ``1d``／``48h``).
 */
export type { MessageTimeRange } from "../domain/messages/messageTimeRange";

/** 時間窗口（毫秒精度），用於定義起訖時間範圍 */
export interface TimeWindow {
  start: Date;
  end: Date;
}

/** View mode for content display (card, list, map) */
export type ViewMode = "card" | "list" | "map";

/** Workspace navigation item — `labelKey` is resolved via `t(labelKey)` at render time. */
export interface WorkspaceNavItem {
  to: string;
  labelKey: string;
}

/** Validation result from config validation */
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
