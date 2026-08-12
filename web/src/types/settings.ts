// ============================================================
// Settings Type Definitions (OpenAPI SoT)
// ============================================================

import type { components } from "../api/generated/schema";

/**
 * GET/PUT /config/settings wire snapshot.
 * LLM provider slots / assistant_llm_* / web-search globals live on
 * ``/api/v1/llm/profiles`` (not system_config).
 */
export type SystemSettingsSnapshot = components["schemas"]["SystemSettingsSnapshot"];

/** Settings fields writable via PUT /config/settings (excludes runtime-only keys). */
export type PersistableSystemSettings = Omit<SystemSettingsSnapshot, "analysisPaused">;

/** Partial update accepted by PUT /config/settings. */
export type SystemSettingsUpdate = Partial<PersistableSystemSettings>;

/**
 * Snapshot fields that the settings form edits 1:1 (same key + wire type).
 * Provider connection fields live on LLM profiles, not system settings.
 */
export type SettingsObject = Pick<
  SystemSettingsSnapshot,
  | "analysisBatchMessageLimit"
  | "analysisMaxTotalChars"
  | "analysisMaxEstimatedInputTokens"
  | "analysisTraceVerbose"
  | "llmGenerationTimeout"
  | "maxBatchRetries"
  | "maxConcurrentBatches"
  | "analysisStrategyMode"
  | "analysisTriggerThreshold"
  | "autoPauseOnRetriesExhausted"
>;

/** All valid keys of SettingsObject */
export type SettingsKey = keyof SettingsObject;
