import { apiClient } from "../client";

/** Settings blob stored under ``voice_reminder_settings``. */
export type VoiceReminderSettingsPayload = {
  enabled: boolean;
  leadOffsetsMinutes: number[];
  /** Hierarchical source selection (same model as board/timeline); `null` = all. */
  sourceFilter: { taskIds: string[]; worksetIds: string[] } | null;
  preambleChimeId: string;
  quietHours: { enabled: boolean; start: string; end: string };
};

export type VoiceReminderHistoryEntryPayload = {
  id: string;
  triggerReason: string;
  status: "success" | "failure";
  errorMessage: string | null;
  triggeredAt: string;
  eventId?: string;
  title?: string;
  leadOffsetMinutes?: number;
};

export type VoiceReminderSettingsResponse = {
  configured: boolean;
  settings: VoiceReminderSettingsPayload | null;
};

export type VoiceReminderFiredResponse = {
  configured: boolean;
  keys: string[] | null;
};

export type VoiceReminderFiredClaimResponse = {
  configured: boolean;
  /** Keys newly reserved for this client to speak. */
  claimed: string[];
  keys: string[];
};

export type VoiceReminderHistoryResponse = {
  configured: boolean;
  entries: VoiceReminderHistoryEntryPayload[] | null;
};

const VOICE_SETTINGS_PATH = "/api/v1/ui-prefs/voice-reminder/settings";
const VOICE_FIRED_PATH = "/api/v1/ui-prefs/voice-reminder/fired";
const VOICE_HISTORY_PATH = "/api/v1/ui-prefs/voice-reminder/history";

/** GET voice-reminder settings (`configured: false` when unset). */
export function fetchVoiceReminderSettings(): Promise<VoiceReminderSettingsResponse> {
  return apiClient.get<VoiceReminderSettingsResponse>(VOICE_SETTINGS_PATH);
}

/** PUT voice-reminder settings blob. */
export function putVoiceReminderSettings(
  settings: VoiceReminderSettingsPayload,
): Promise<VoiceReminderSettingsResponse> {
  return apiClient.put<VoiceReminderSettingsResponse>(VOICE_SETTINGS_PATH, { settings });
}

/** GET fired dedupe keys. */
export function fetchVoiceReminderFired(): Promise<VoiceReminderFiredResponse> {
  return apiClient.get<VoiceReminderFiredResponse>(VOICE_FIRED_PATH);
}

/** PUT fired dedupe keys (server prunes stale). */
export function putVoiceReminderFired(keys: string[]): Promise<VoiceReminderFiredResponse> {
  return apiClient.put<VoiceReminderFiredResponse>(VOICE_FIRED_PATH, { keys });
}

/** POST — atomically reserve keys before speak (multi-client dedupe). */
export function claimVoiceReminderFired(
  keys: string[],
): Promise<VoiceReminderFiredClaimResponse> {
  return apiClient.post<VoiceReminderFiredClaimResponse>(`${VOICE_FIRED_PATH}/claim`, {
    keys,
  });
}

/** GET trigger history entries. */
export function fetchVoiceReminderHistory(): Promise<VoiceReminderHistoryResponse> {
  return apiClient.get<VoiceReminderHistoryResponse>(VOICE_HISTORY_PATH);
}

/** PUT trigger history (server truncates to ≤100). */
export function putVoiceReminderHistory(
  entries: VoiceReminderHistoryEntryPayload[],
): Promise<VoiceReminderHistoryResponse> {
  return apiClient.put<VoiceReminderHistoryResponse>(VOICE_HISTORY_PATH, { entries });
}
