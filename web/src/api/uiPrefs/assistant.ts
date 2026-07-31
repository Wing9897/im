import { apiClient } from "../client";

export type AssistantSessionMessagePayload = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; resultSummary?: string }>;
};

export type AssistantSessionPayload = {
  id: string;
  title: string;
  updatedAt: number;
  messages: AssistantSessionMessagePayload[];
  sessionId?: string;
};

export type AssistantSessionsResponse = {
  configured: boolean;
  sessions: AssistantSessionPayload[] | null;
  activeSessionId: string | null;
};

export type AssistantSessionsPutBody = {
  deviceId: string;
  sessions: AssistantSessionPayload[];
  activeSessionId?: string | null;
};

export type AssistantVoiceIoSettingsPayload = {
  sttProvider: string;
  ttsProvider: string;
  ttsEnabled: boolean;
  speechLanguage: string;
  spacePttMode?: "hold" | "toggle";
  ttsVoiceUri?: string;
  /** Default assistant create target; ``__user__`` = 一般. */
  defaultWorksetId?: string;
};

export type AssistantVoiceIoResponse = {
  configured: boolean;
  settings: AssistantVoiceIoSettingsPayload | null;
};

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
