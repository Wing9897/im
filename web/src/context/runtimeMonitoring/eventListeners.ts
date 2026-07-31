import type { SseEvent } from "../../api/client";
import { dispatchRuntimeEvent } from "./dispatch";
import type { EventListenerDeps } from "./sseHandlers/types";
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

/** Routes a single SSE event through the shared runtime dispatcher. */
export function handleSseEvent(event: SseEvent, deps: EventListenerDeps): void {
  dispatchRuntimeEvent(event, deps);
}
