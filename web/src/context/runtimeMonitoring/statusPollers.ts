import { checkAiEngineStatus } from "../../api/system";
import { fetchCollectorStatus } from "../../api/system";
import { fetchQueueStatus } from "../../api/results";
import i18n from "../../i18n";
import { toErrorMessage } from "../../utils/errors";
import { normalizeCollectorStatus } from "../../utils/collector";
import { createSerializedAsyncRunner } from "../../utils/serializedAsyncRunner";
import {
  REPEATED_ERROR_LOG_WINDOW_MS,
  buildAiHealthStatusLog,
  normalizeAiStatus,
} from "../appRuntimeShared";
import { APP_LOG_KIND } from "../../api/appLogClient";
import type { RuntimeStateBundle } from "./stateManagement";
import {
  buildAiHealthSignature,
  buildAiStatusCheckFailureLog,
} from "./types";
import type { RuntimeMonitoringOptions } from "./types";

/** Serialized AI-engine health refresh runner. */
export function createAiEngineStatusPoller(
  state: RuntimeStateBundle,
  options: RuntimeMonitoringOptions,
  isMounted: () => boolean,
): { refreshAiStatusAsync: (logOnChange: boolean) => Promise<void> } {
  const { addLog } = options;

  const { run: refreshAiStatusAsync } = createSerializedAsyncRunner<[boolean]>(
    async (logOnChange = true) => {
      if (state.collectorStatusRef.current === "error") {
        if (!isMounted()) return;
        state.setAiEngineStatus("unknown");
        state.lastAiHealthSignatureRef.current = "collector-error";
        return;
      }
      const statusVersion = state.collectorStatusVersionRef.current;
      try {
        const health = await checkAiEngineStatus();
        const result = normalizeAiStatus(health.status);
        if (
          !isMounted() ||
          statusVersion !== state.collectorStatusVersionRef.current
        )
          return;
        state.setAiEngineStatus(result);
        const signature = buildAiHealthSignature(result, health);
        const shouldLog =
          signature !== state.lastAiHealthSignatureRef.current;
        if (logOnChange && shouldLog) {
          state.lastAiHealthSignatureRef.current = signature;
          addLog(buildAiHealthStatusLog(result, health));
        }
      } catch (error) {
        if (
          !isMounted() ||
          statusVersion !== state.collectorStatusVersionRef.current
        )
          return;
        state.setAiEngineStatus("unknown");
        const now = Date.now();
        const message = toErrorMessage(error);
        if (
          logOnChange &&
          (message !== state.lastAiHealthSignatureRef.current ||
            now - state.lastAiErrorLoggedAtRef.current >
              REPEATED_ERROR_LOG_WINDOW_MS)
        ) {
          state.lastAiHealthSignatureRef.current = message;
          state.lastAiErrorLoggedAtRef.current = now;
          addLog(buildAiStatusCheckFailureLog(message));
        }
      }
    },
    (current, next) => [Boolean(current?.[0] || next[0])],
  );

  return { refreshAiStatusAsync };
}

/** Collector-status bootstrap + periodic refresh. */
export function createCollectorStatusPoller(
  state: RuntimeStateBundle,
  options: RuntimeMonitoringOptions,
  isMounted: () => boolean,
): {
  bootstrapCollectorStatus: () => Promise<void>;
  refreshCollectorStatus: () => Promise<void>;
} {
  const { addLog, warnNonFatal } = options;

  const bootstrapCollectorStatus = async () => {
    try {
      const status = normalizeCollectorStatus(await fetchCollectorStatus());
      if (isMounted()) {
        if (status !== state.collectorStatusRef.current) {
          state.collectorStatusVersionRef.current += 1;
        }
        state.collectorStatusRef.current = status;
        state.setCollectorStatus(status);
      }
    } catch (error) {
      addLog({
        level: "error",
        category: "collector",
        kind: APP_LOG_KIND.RUNTIME_COLLECTOR,
        message: String(i18n.t("common:runtime.collectorReadFailed")),
        messageKey: "logs:templates.runtimeCollectorReadFailed",
        source: "frontend.runtime.collector",
        payload: { error: toErrorMessage(error) },
      });
    }
  };

  const refreshCollectorStatus = async () => {
    try {
      const status = normalizeCollectorStatus(await fetchCollectorStatus());
      if (!isMounted()) return;
      if (status !== state.collectorStatusRef.current) {
        state.collectorStatusVersionRef.current += 1;
        state.collectorStatusRef.current = status;
        state.setCollectorStatus(status);
      }
    } catch (error) {
      warnNonFatal("refresh_collector_status", "failed to refresh collector status", error);
    }
  };

  return { bootstrapCollectorStatus, refreshCollectorStatus };
}

/** Serialized queue-status refresh runner. */
export function createQueueStatusPoller(
  state: RuntimeStateBundle,
  options: RuntimeMonitoringOptions,
  isMounted: () => boolean,
): { refreshQueueStatusAsync: (logPauseChanges: boolean) => Promise<void> } {
  const { warnNonFatal, refreshStoredLogs } = options;

  const { run: refreshQueueStatusAsync } = createSerializedAsyncRunner<
    [boolean]
  >(
    async (logPauseChanges = false) => {
      const statusVersion = state.collectorStatusVersionRef.current;
      try {
        const queue = await fetchQueueStatus();
        if (!isMounted() || statusVersion !== state.collectorStatusVersionRef.current)
          return;
        state.setQueueStatus(queue);
        const previousPaused = state.analysisPausedRef.current;
        state.setAnalysisPaused(queue.analysisPaused);
        // Pause/resume AppLog is server-owned (scheduler.paused / .resumed).
        // When callers ask to observe pause flips, refresh stored logs instead
        // of double-writing a frontend runtime.analysis_pause row.
        if (
          logPauseChanges &&
          queue.analysisPaused !== previousPaused
        ) {
          void refreshStoredLogs().catch(() => {});
        }
        if ((queue.processingBatches ?? []).length === 0) {
          state.setActiveAnalyses(new Map());
        }
      } catch (error) {
        warnNonFatal(
          "refresh_queue_status",
          "failed to refresh queue status",
          error,
        );
      }
    },
    (current, next) => [Boolean(current?.[0] || next[0])],
  );

  return { refreshQueueStatusAsync };
}
