import { apiClient } from "../client";
import type { components } from "../generated/schema";

export type AssistantSessionMessagePayload =
  components["schemas"]["AssistantSessionMessageSchema"];
/** Wire session row (OpenAPI Input/Output variants are identical). */
export type AssistantSessionPayload =
  components["schemas"]["AssistantSessionSchema-Output"];
export type AssistantSessionsResponse = components["schemas"]["AssistantSessionsResponse"];
export type AssistantSessionsPutBody = components["schemas"]["AssistantSessionsPutBody"];
export type AssistantVoiceIoSettingsPayload =
  components["schemas"]["AssistantVoiceIoSettingsSchema"];
export type AssistantVoiceIoResponse = components["schemas"]["AssistantVoiceIoResponse"];

const ASSISTANT_SESSIONS_PATH = "/api/v1/ui-prefs/assistant/sessions";
const ASSISTANT_VOICE_IO_PATH = "/api/v1/ui-prefs/assistant/voice-io";

/** GET assistant chat sessions for one device slot (`configured: false` when unset). */
export function fetchAssistantSessions(deviceId: string): Promise<AssistantSessionsResponse> {
  return apiClient.get<AssistantSessionsResponse>(ASSISTANT_SESSIONS_PATH, { deviceId });
}

/**
 * PUT full session list + active id.
 * Delete a session by omitting it from `sessions` (UI still supports delete).
 */
export function putAssistantSessions(
  body: AssistantSessionsPutBody,
): Promise<AssistantSessionsResponse> {
  return apiClient.put<AssistantSessionsResponse>(ASSISTANT_SESSIONS_PATH, body);
}

/** GET assistant STT/TTS IO settings. */
export function fetchAssistantVoiceIo(): Promise<AssistantVoiceIoResponse> {
  return apiClient.get<AssistantVoiceIoResponse>(ASSISTANT_VOICE_IO_PATH);
}

/** PUT assistant STT/TTS IO settings. */
export function putAssistantVoiceIo(
  settings: AssistantVoiceIoSettingsPayload,
): Promise<AssistantVoiceIoResponse> {
  return apiClient.put<AssistantVoiceIoResponse>(ASSISTANT_VOICE_IO_PATH, { settings });
}
