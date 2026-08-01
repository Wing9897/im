/**
 * Message selectors for the caption-mode (direct) bubble stack.
 * Pure so the turn-baseline gate can be unit-tested without the portal UI.
 */
import type { AssistantSessionMessage } from "../../domain/assistant/assistantSessions";

/** Keep only messages not frozen at arm time. */
export function messagesAfterDirectBaseline(
  messages: readonly AssistantSessionMessage[],
  frozenIds: ReadonlySet<string>,
): AssistantSessionMessage[] {
  return messages.filter((m) => !frozenIds.has(m.id));
}

/** Most recent message for a role, or null when the role has not spoken yet. */
export function latestOfRole(
  messages: readonly AssistantSessionMessage[],
  role: "user" | "assistant",
): AssistantSessionMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === role) return messages[i] ?? null;
  }
  return null;
}
