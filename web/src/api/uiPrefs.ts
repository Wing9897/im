/**
 * REST client for SQLite-backed UI prefs (ops board, voice reminder, assistant…).
 *
 * INVARIANTS:
 * - After successful hydrate/PUT, server (SQLite) is SoT. Empty / unconfigured
 *   server → client defaults. Retired localStorage migration/cleanup bridges
 *   are not part of this boundary.
 * - Device chrome stays local forever: `im:monitor-mode`, `im:pages-last-path`
 *   (see `MonitorModeContext` / `boardPrefsStore`) — never put those in ui-prefs.
 * - Browse-position UI (F5 restore) stays on local `im:*` keys via
 *   `usePersistedState` — constants live next to each feature, e.g.
 *   `useTimelineNavigation` (time cursor/scale), `useTimeFilter`
 *   (`INTELLIGENCE_TIME_PRESET_STORAGE_KEY`), `mapViewHelpers` (map live/window),
 *   `systemTaskCatalog` (tasks search/mode), `*PersistedKeys.ts` on
 *   leaderboard/logs/viewer, `useTimelinePageContainer` (focused day/gantt pick).
 *   Board gantt day/month zoom is server-side only:
 *   `widgetState.ganttViewModes` on `/ui-prefs/board` (not localStorage).
 * - Unsaved drafts use sessionStorage (`storage: "session"`): chat-editor form/
 *   messages/input, `im:assistant:composer-drafts`, `im:user:profile:draft:v1`.
 * - Panel chrome (filter open / channel expand) is device-local `im:*` too
 *   (`monitorPersistedKeys`, timeline filter/event-list keys, discord expand).
 * - Timeline client statuses / time overrides: `/ui-prefs/timeline/annotations`
 *   (not soft-dismiss; that stays on `/timeline/dismissals`).
 * - UI locale remains LS-first (`i18n/locale.ts`); do not make server authoritative
 *   for `auto` locale the same way as board layout.
 * Hand-written (same pattern as timelineDismissals.ts). OpenAPI paths live under
 * `/api/v1/ui-prefs/*`; regenerate types via `npm run openapi:types` when desired.
 */

import { apiClient } from "./client";

// ── Board (layout + widgetState) ─────────────────────────────────────────

export type BoardMapViewPref = {
  center: [number, number];
  zoom: number;
};

/** Per-widget gantt day/month zoom (board gantt widgets). */
export type BoardGanttViewMode = "day" | "month";

/**
 * Per-widget source filter: hierarchical `{taskIds, worksetIds}`, or `null`
 * (all sources). Flat `string[]` is rejected on read (server sanitize may still
 * normalize older SQLite payloads before they reach the client).
 */
export type BoardSourceFilterPref =
  | { taskIds: string[]; worksetIds: string[] }
  | null;

export type BoardWidgetStatePref = {
  mapViews: Record<string, BoardMapViewPref>;
  sourceFilters: Record<string, BoardSourceFilterPref>;
  ganttViewModes: Record<string, BoardGanttViewMode>;
};

/** GET payload after server sanitize (hierarchical only). */
export type BoardWidgetStatePrefWire = BoardWidgetStatePref;

/** Layout blob stored under `ops_board_layout` (v14 widgets mosaic). */
export type BoardLayoutPref = {
  version: number;
  widgets: Array<{
    i: string;
    type: string;
    col: number;
    row: number;
    sizeId: string;
    z?: number;
  }>;
};

export type BoardPrefsResponse = {
  configured: boolean;
  layout: BoardLayoutPref | null;
  widgetState: BoardWidgetStatePrefWire | null;
};

export type BoardPrefsPutBody = {
  /** Omit to leave unchanged; `null` clears the server key. */
  layout?: BoardLayoutPref | null;
  widgetState?: BoardWidgetStatePref | null;
};

const BOARD_PATH = "/api/v1/ui-prefs/board";

/** GET `/api/v1/ui-prefs/board` — empty/missing → `{ configured: false, … null }`. */
export function fetchBoardPrefs(): Promise<BoardPrefsResponse> {
  return apiClient.get<BoardPrefsResponse>(BOARD_PATH);
}

/** PUT `/api/v1/ui-prefs/board` — partial body; returns the merged prefs. */
export function putBoardPrefs(body: BoardPrefsPutBody): Promise<BoardPrefsResponse> {
  return apiClient.put<BoardPrefsResponse>(BOARD_PATH, body);
}

// ── Voice reminder ───────────────────────────────────────────────────────

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

// ── Assistant sessions + voice IO ─────────────────────────────────────────

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

// ── Timeline annotations (statuses + time overrides) ──────────────────────

export type TimelineEventStatusPayload = "pending" | "confirmed" | "completed";

export type TimelineEventTimeOverridePayload = {
  startTime: string;
  endTime: string | null;
};

export type TimelineAnnotationsPayload = {
  eventStatuses: Record<string, TimelineEventStatusPayload>;
  eventTimeOverrides: Record<string, TimelineEventTimeOverridePayload>;
};

export type TimelineAnnotationsResponse = {
  configured: boolean;
  eventStatuses: Record<string, TimelineEventStatusPayload> | null;
  eventTimeOverrides: Record<string, TimelineEventTimeOverridePayload> | null;
};

const TIMELINE_ANNOTATIONS_PATH = "/api/v1/ui-prefs/timeline/annotations";

/** GET timeline client annotations (`configured: false` when unset). */
export function fetchTimelineAnnotations(): Promise<TimelineAnnotationsResponse> {
  return apiClient.get<TimelineAnnotationsResponse>(TIMELINE_ANNOTATIONS_PATH);
}

/** PUT full timeline annotations blob (statuses + time overrides). */
export function putTimelineAnnotations(
  body: TimelineAnnotationsPayload,
): Promise<TimelineAnnotationsResponse> {
  return apiClient.put<TimelineAnnotationsResponse>(TIMELINE_ANNOTATIONS_PATH, body);
}
