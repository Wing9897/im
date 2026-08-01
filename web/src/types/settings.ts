// ============================================================
// Settings Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

/** GET/PUT /config/settings wire snapshot. */
export type SystemSettingsSnapshot =
  components["schemas"]["SystemSettingsSnapshot"];

/** Settings fields writable via PUT /config/settings (excludes runtime-only keys). */
export type PersistableSystemSettings = Omit<SystemSettingsSnapshot, "analysisPaused">;

/** Partial update accepted by PUT /config/settings. */
export type SystemSettingsUpdate = Partial<PersistableSystemSettings>;

/**
 * Snapshot fields that the settings form edits 1:1 (same key + wire type).
 * Provider-specific URL/model/key stay on the snapshot; the form flattens them
 * into ``llmBaseUrl`` / ``llmModel`` / ``llmApiKey`` below.
 */
type SettingsFormFromSnapshot = Pick<
  SystemSettingsSnapshot,
  | "llmProvider"
  | "ollamaThinkingEnabled"
  | "openaiJsonMode"
  | "analysisBatchMessageLimit"
  | "analysisMaxTotalChars"
  | "analysisMaxEstimatedInputTokens"
  | "analysisTraceVerbose"
  | "llmGenerationTimeout"
  | "maxBatchRetries"
  | "maxConcurrentBatches"
  | "intelligenceRulesVersion"
  | "analysisStrategyMode"
  | "analysisTriggerThreshold"
  | "autoPauseOnRetriesExhausted"
>;

/** Unified settings object for SettingsSection — form adapter over the snapshot. */
export type SettingsObject = SettingsFormFromSnapshot & {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
};

/** All valid keys of SettingsObject */
export type SettingsKey = keyof SettingsObject;
