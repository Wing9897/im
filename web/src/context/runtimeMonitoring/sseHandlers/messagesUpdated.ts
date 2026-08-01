import type { MessagesUpdatedPayload } from "../../../types";
import type { EventListenerDeps } from "./types";

export function handleMessagesUpdated(data: unknown, deps: EventListenerDeps): void {
  if (data == null || typeof data !== "object") return;
  const payload = data as MessagesUpdatedPayload;
  const messages = payload.messages ?? [];
  deps.state.setLastMessagesUpdate({
    payload: { ...payload, messages },
    receivedAt: Date.now(),
  });
  if (messages.length > 0) {
    deps.refreshLogsForBackendEvent();
  }
}
