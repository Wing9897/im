import type { SseEvent } from "../../api/client";
import { emitResourceModified } from "../../domain/sse/resourceModified";
import { handleSourceStatusChanged } from "./sseHandlers/sourceStatus";
import {
  handleAnalysisCompleted,
  handleAnalysisFailed,
  handleAnalysisPausedChanged,
  handleAnalysisStarted,
} from "./sseHandlers/analysisEvents";
import { handleCollectorStatusChanged } from "./sseHandlers/collectorStatus";
import { handleMessagesUpdated } from "./sseHandlers/messagesUpdated";
import type { EventListenerDeps } from "./sseHandlers/types";

type SseHandler = (data: unknown, deps: EventListenerDeps) => void;

const SSE_HANDLERS: Record<string, SseHandler> = {
  collector_status_changed: handleCollectorStatusChanged,
  source_status_changed: handleSourceStatusChanged,
  messages_updated: handleMessagesUpdated,
  analysis_started: handleAnalysisStarted,
  analysis_completed: handleAnalysisCompleted,
  analysis_failed: handleAnalysisFailed,
  analysis_paused_changed: handleAnalysisPausedChanged,
  resource_modified: (data) => {
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
  },
};

/** Single SSE / synthetic runtime event dispatcher. */
export function dispatchRuntimeEvent(event: SseEvent, deps: EventListenerDeps): void {
  const data = event.data;
  if (data == null || typeof data !== "object") return;
  const handler = SSE_HANDLERS[event.event];
  if (!handler) return;
  handler(data, deps);
}
