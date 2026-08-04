import type { TFunction } from "i18next";
import i18n from "../../i18n";
import type {
  LlmProvider,
  PersistableSystemSettings,
  SettingsObject,
  SystemSettingsSnapshot,
} from "../../types";
import { normalizeEvidenceStyle } from "../../domain/settings/analysisEvidenceStyle";
import { getLlmProviderConfig } from "./llmProviderConfig";

type Translate = TFunction | typeof i18n.t;

export function getActiveProviderConfig(
  settings: SystemSettingsSnapshot,
  t: Translate = i18n.t.bind(i18n),
): {
  fields: ReturnType<typeof getLlmProviderConfig>[LlmProvider];
  baseUrl: string;
  model: string;
  apiKey: string;
} {
  const fields = getLlmProviderConfig(t)[settings.llmProvider];
  return {
    fields,
    baseUrl: settings[fields.baseUrlKey] as string,
    model: settings[fields.modelKey] as string,
    apiKey: fields.apiKeyKey ? (settings[fields.apiKeyKey] as string) : "",
  };
}

export function buildSettingsObject(
  snapshot: SystemSettingsSnapshot,
  providerConfig: ReturnType<typeof getActiveProviderConfig>,
): SettingsObject {
  return {
    llmProvider: snapshot.llmProvider,
    llmBaseUrl: providerConfig.baseUrl,
    llmModel: providerConfig.model,
    llmApiKey: providerConfig.apiKey,
    openaiJsonMode: snapshot.openaiJsonMode,
    ollamaThinkingEnabled: snapshot.ollamaThinkingEnabled,
    analysisBatchMessageLimit: snapshot.analysisBatchMessageLimit,
    analysisMaxTotalChars: snapshot.analysisMaxTotalChars,
    analysisMaxEstimatedInputTokens: snapshot.analysisMaxEstimatedInputTokens,
    analysisTraceVerbose: snapshot.analysisTraceVerbose,
    llmGenerationTimeout: snapshot.llmGenerationTimeout,
    maxBatchRetries: snapshot.maxBatchRetries,
    maxConcurrentBatches: snapshot.maxConcurrentBatches,
    analysisStrategyMode: snapshot.analysisStrategyMode,
    analysisTriggerThreshold: snapshot.analysisTriggerThreshold,
    autoPauseOnRetriesExhausted: snapshot.autoPauseOnRetriesExhausted,
  };
}

/**
 * Determines whether the concurrent-batches confirmation dialog should
 * be shown before saving.
 *
 * Returns true when ALL of:
 *  - pendingValue > savedValue  (user is increasing)
 *  - pendingValue > 1           (target is above the safe default)
 */
export function shouldShowConcurrentBatchesWarning(
  pendingMaxConcurrentBatches: string,
  savedMaxConcurrentBatches: string,
): boolean {
  const pending = parseInt(pendingMaxConcurrentBatches, 10);
  const saved = parseInt(savedMaxConcurrentBatches, 10);
  const p = Number.isNaN(pending) ? 0 : pending;
  const s = Number.isNaN(saved) ? 0 : saved;
  return p > s && p > 1;
}

/** Strip runtime-only fields before persisting via PUT /config/settings. */
export function toPersistableSettings(
  snapshot: SystemSettingsSnapshot,
): PersistableSystemSettings {
  const rest: PersistableSystemSettings = { ...snapshot };
  delete (rest as { analysisPaused?: boolean }).analysisPaused;
  return {
    ...rest,
    analysisStrategyMode: normalizeEvidenceStyle(snapshot.analysisStrategyMode),
  };
}

/** Merge server-normalized fields into a local snapshot (partial PUT response). */
export function mergePersistedSnapshot(
  current: SystemSettingsSnapshot,
  normalized: SystemSettingsSnapshot,
): SystemSettingsSnapshot {
  return { ...current, ...normalized };
}
