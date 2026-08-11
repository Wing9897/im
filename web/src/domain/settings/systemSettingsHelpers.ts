import type {
  PersistableSystemSettings,
  SettingsObject,
  SystemSettingsSnapshot,
} from "../../types";
import { normalizeEvidenceStyle } from "../../domain/settings/analysisEvidenceStyle";

export function buildSettingsObject(snapshot: SystemSettingsSnapshot): SettingsObject {
  return {
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
