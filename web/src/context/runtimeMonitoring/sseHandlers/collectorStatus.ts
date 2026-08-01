import type { CollectorStatusChangedPayload } from "../../../types";
import { fetchCollectorStatus } from "../../../api/system";
import {
  normalizeCollectorStatus,
  shouldRefetchCollectorStatus,
} from "../../../utils/collector";
import { errorToastEmitter } from "../../../api/errorToastEmitter";
import i18n from "../../../i18n";
import { logWarn } from "../../../utils/logger";
import type { EventListenerDeps } from "./types";
import type { CollectorStatus } from "../../../types";

function isTransientCollectorError(summary: string): boolean {
  const message = summary.toLowerCase();
  return (
    message.includes("database is locked")
    || message.includes("busy")
    || message.includes("connection timeout")
    || message.includes("timeout to host")
  );
}

function applyCollectorStatus(status: CollectorStatus, deps: EventListenerDeps): void {
  const { state, refreshQueueStatus, refreshAiStatus, refreshLogsForBackendEvent } = deps;
  const previousStatus = state.collectorStatusRef.current;
  if (status !== previousStatus) {
    state.collectorStatusVersionRef.current += 1;
  }
  state.collectorStatusRef.current = status;
  state.setCollectorStatus(status);
  if (status !== "running") {
    state.setQueueStatus((prev) =>
      prev?.processingBatches?.length || prev?.attentionBatches?.length
        ? {
            ...prev,
            processingBatches: [],
            attentionBatches: [],
          }
        : prev,
    );
    state.setAiEngineStatus("unknown");
    state.setActiveAnalyses(new Map());
    state.lastAiHealthSignatureRef.current = "collector-not-running";
  } else if (previousStatus !== "running") {
    refreshQueueStatus(false);
    refreshAiStatus(true);
  }
  if (status !== previousStatus) {
    refreshLogsForBackendEvent();
  }
}

/** Refetch aggregate collector status from REST (authoritative). */
export function refreshAggregateCollectorStatus(deps: EventListenerDeps): void {
  void fetchCollectorStatus()
    .then((apiStatus) => applyCollectorStatus(normalizeCollectorStatus(apiStatus), deps))
    .catch((error) => {
      logWarn("[collector-status] failed to refresh aggregate status", error);
    });
}

export function handleCollectorStatusChanged(
  data: unknown,
  deps: EventListenerDeps,
): void {
  if (data == null || typeof data !== "object") return;
  const payload = data as CollectorStatusChangedPayload;
  if (!payload.status) return;

  const aggregateStatus = normalizeCollectorStatus(String(payload.status));

  if (
    payload.adapter_name
    && payload.error_summary
    && aggregateStatus !== "running"
    && !isTransientCollectorError(payload.error_summary)
  ) {
    errorToastEmitter.emit({
      errorCode: "COLLECTOR_UNAVAILABLE",
      message: String(
        i18n.t("common:runtime.adapterConnectFailed", {
          name: payload.adapter_name,
          summary: payload.error_summary,
        }),
      ),
      correlationId: payload.correlation_id ?? crypto.randomUUID(),
    });
  }

  const raw = String(payload.status);

  if (shouldRefetchCollectorStatus(payload)) {
    refreshAggregateCollectorStatus(deps);
    return;
  }

  applyCollectorStatus(normalizeCollectorStatus(raw), deps);
}
