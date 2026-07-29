// ============================================================
// Common / Shared Type Definitions
// ============================================================

/** Supported messaging platforms */
export type Platform = string;

/** Account connection status */
export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

/** Collector process status */
export type CollectorStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "restarting"
  | "error";

/** AI engine service status */
export type AiEngineStatus = "available" | "unavailable" | "unknown";

export interface AiEngineHealthStatus {
  status: AiEngineStatus;
  reason?: string | null;
  provider?: string | null;
}

/** Result from POST /api/v1/system/ai-engine/test */
export interface AiEngineTestResult {
  success: boolean;
  provider?: string | null;
  model?: string | null;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  preview?: string | null;
  error?: string | null;
}

/** Draft LLM settings for an unsaved AI test run */
export interface AiEngineTestDraft {
  llmProvider: LlmProvider;
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  ollamaThinkingEnabled?: boolean;
}

/** LLM Provider options */
export type LlmProvider = "ollama" | "openai_compatible" | "gemini_compatible" | "openrouter";

/** Analysis mode — see `domain/tasks/analysisModeCapabilities` (FE SoT / BE drift-tested). */
export type { AnalysisMode } from "../domain/tasks/analysisModeCapabilities";

/** Canonical analysis-task windows accepted by the task API and DB constraint. */
export type AnalysisTimeRange =
  | "all"
  | "today"
  | "1h"
  | "6h"
  | "12h"
  | "24h"
  | "48h"
  | "1d"
  | "7d"
  | "30d";

/** Message-query windows (same canonical tokens as analysis tasks). */
export type MessageTimeRange = AnalysisTimeRange;

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
