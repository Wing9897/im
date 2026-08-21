/**
 * Caption PTT voiceTurn latch: keep the overlay send/reply path alive through
 * the listen → send gap, then drop after this turn's assistant lands (or rollback).
 */

export function latestAssistantId(
  messages: readonly { role: string; id: string }[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item?.role === "assistant") return item.id;
  }
  return null;
}

export function shouldKeepVoiceTurn(state: {
  listening: boolean;
  holdArmed: boolean;
  sending: boolean;
  sendStartedThisTurn: boolean;
  assistantIdWhenArmed: string | null;
  latestAssistantId: string | null;
}): boolean {
  if (state.listening || state.holdArmed || state.sending) return true;
  const gotNewAssistant =
    state.latestAssistantId != null &&
    state.latestAssistantId !== state.assistantIdWhenArmed;
  if (gotNewAssistant) return false;
  if (state.sendStartedThisTurn) return false;
  return true;
}
