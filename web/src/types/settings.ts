// ============================================================
// Settings Type Definitions
// ============================================================

/**
 * GET/PUT /config/settings wire snapshot (Stamp 29).
 * LLM provider slots / assistant_llm_* / web-search globals live on
 * ``/api/v1/llm/profiles`` (not system_config).
 */
export type SystemSettingsSnapshot = {
  analysisPaused: boolean;
  analysisBatchMessageLimit: string;
  analysisMaxTotalChars: string;
  analysisMaxEstimatedInputTokens: string;
  analysisTraceVerbose: boolean;
  llmGenerationTimeout: string;
  maxBatchRetries: string;
  maxConcurrentBatches: string;
  analysisStrategyMode: string;
  analysisTriggerThreshold: string;
  retentionMessagesDays: string;
  retentionAnalysisDays: string;
  retentionLeaderboardDays: string;
  retentionAppLogsDays: string;
  retentionUserEventsDays: string;
  autoPauseOnRetriesExhausted: boolean;
  weatherLocation: string;
  uiLocale: string;
  agentHistoryMaxMessages: string;
  agentHistoryMaxChars: string;
  assistantDisplayName: string;
  assistantAvatar: string;
  userDisplayName: string;
  userAvatar: string;
  userBackground: string;
};

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
