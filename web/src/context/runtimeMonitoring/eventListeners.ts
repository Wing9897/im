import type { SseEvent } from "../../api/client";
import { emitResourceModified } from "../../domain/sse/resourceModified";
import type { EventListenerDeps } from "./sseHandlers/types";
import { handleAccountStatusChanged } from "./sseHandlers/accountStatus";
import {
  handleAnalysisCompleted,
  handleAnalysisFailed,
  handleAnalysisPausedChanged,
  handleAnalysisStarted,
} from "./sseHandlers/analysisEvents";
import { handleCollectorStatusChanged } from "./sseHandlers/collectorStatus";
import { handleMessagesUpdated } from "./sseHandlers/messagesUpdated";
import { buildWindowErrorLog, buildUnhandledRejectionLog } from "./types";
import type { RuntimeMonitoringOptions } from "./types";
import type { RuntimeStateBundle } from "./stateManagement";

export type { EventListenerDeps } from "./sseHandlers/types";

interface EventListenerSetupDeps {
  state: RuntimeStateBundle;
  options: RuntimeMonitoringOptions;
  refreshQueueStatus: (logPauseChanges: boolean) => void;
  refreshAiStatus: (logOnChange: boolean) => void;
  refreshLogsForBackendEvent: () => void;
}

/**
 * Registers window error handlers.
 * Returns a cleanup function that removes them.
 *
 * SSE-based event routing is handled separately via handleSseEvent().
 */
export function setupEventListeners({
  options,
}: EventListenerSetupDeps): () => void {
  const { addLog } = options;

  const handleWindowError = (event: ErrorEvent) => {
    addLog(buildWindowErrorLog(event));
  };
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    addLog(buildUnhandledRejectionLog(event));
  };

  window.addEventListener("error", handleWindowError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    window.removeEventListener("error", handleWindowError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
}

/** Routes a single SSE event to the appropriate state handler. */
export function handleSseEvent(event: SseEvent, deps: EventListenerDeps): void {
  const data = event.data;
  if (data == null || typeof data !== "object") return;

  switch (event.event) {
    case "collector_status_changed":
      handleCollectorStatusChanged(data, deps);
      break;
    case "account_status_changed":
      handleAccountStatusChanged(data, deps);
      break;
    case "messages_updated":
      handleMessagesUpdated(data, deps);
      break;
    case "analysis_started":
      handleAnalysisStarted(data, deps);
      break;
    case "analysis_completed":
      handleAnalysisCompleted(data, deps);
      break;
    case "analysis_failed":
      handleAnalysisFailed(data, deps);
      break;
    case "analysis_paused_changed":
      handleAnalysisPausedChanged(data, deps);
      break;
    case "resource_modified": {
      const payload = data as Record<string, unknown>;
      const resourceType = payload.resourceType;
      const resourceId = payload.resourceId;
      const action = payload.action;
      if (
        typeof resourceType === "string" &&
        typeof resourceId === "string" &&
        typeof action === "string"
      ) {
        emitResourceModified({ resourceType, resourceId, action });
      }
      break;
    }
    default:
      break;
  }
}
