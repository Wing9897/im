import type { SourceStatusChangedPayload } from "../../../types";
import { refreshAggregateCollectorStatus } from "./collectorStatus";
import type { EventListenerDeps } from "./types";

export function handleSourceStatusChanged(data: unknown, deps: EventListenerDeps): void {
  if (data == null || typeof data !== "object") return;
  const payload = data as SourceStatusChangedPayload;
  if (!payload.sourceId || !payload.status) return;
  deps.state.setLastSourceStatusChange(payload);
  deps.refreshLogsForBackendEvent();
  // Adapter connect/disconnect only emits source_status_changed; refresh aggregate.
  refreshAggregateCollectorStatus(deps);
}
