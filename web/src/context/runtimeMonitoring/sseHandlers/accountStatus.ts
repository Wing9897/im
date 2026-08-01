import type { AccountStatusChangedPayload } from "../../../types";
import { refreshAggregateCollectorStatus } from "./collectorStatus";
import type { EventListenerDeps } from "./types";

export function handleAccountStatusChanged(data: unknown, deps: EventListenerDeps): void {
  if (data == null || typeof data !== "object") return;
  const payload = data as AccountStatusChangedPayload;
  if (!payload.accountId || !payload.status) return;
  deps.state.setLastAccountStatusChange(payload);
  deps.refreshLogsForBackendEvent();
  // Adapter connect/disconnect only emits account_status_changed; refresh aggregate.
  refreshAggregateCollectorStatus(deps);
}
