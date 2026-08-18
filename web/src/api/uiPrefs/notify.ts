import { apiClient } from "../client";
import type { components } from "../generated/schema";

/** Settings blob stored under ``notify_settings``. */
export type NotifySettingsPayload =
  components["schemas"]["NotifySettingsSchema"];
export type NotifyHistoryEntryPayload =
  components["schemas"]["NotifyHistoryEntrySchema"];
export type NotifySettingsResponse =
  components["schemas"]["NotifySettingsResponse"];
export type NotifyFiredResponse =
  components["schemas"]["NotifyFiredResponse"];
export type NotifyFiredClaimResponse =
  components["schemas"]["NotifyFiredClaimResponse"];
export type NotifyHistoryResponse =
  components["schemas"]["NotifyHistoryResponse"];

const NOTIFY_SETTINGS_PATH = "/api/v1/ui-prefs/notify/settings";
const NOTIFY_FIRED_PATH = "/api/v1/ui-prefs/notify/fired";
const NOTIFY_HISTORY_PATH = "/api/v1/ui-prefs/notify/history";

/** GET local-notify settings (`configured: false` when unset). */
export function fetchNotifySettings(): Promise<NotifySettingsResponse> {
  return apiClient.get<NotifySettingsResponse>(NOTIFY_SETTINGS_PATH);
}

/** PUT local-notify settings blob. */
export function putNotifySettings(
  settings: NotifySettingsPayload,
): Promise<NotifySettingsResponse> {
  return apiClient.put<NotifySettingsResponse>(NOTIFY_SETTINGS_PATH, { settings });
}

/** GET fired dedupe keys. */
export function fetchNotifyFired(): Promise<NotifyFiredResponse> {
  return apiClient.get<NotifyFiredResponse>(NOTIFY_FIRED_PATH);
}

/** PUT fired dedupe keys (server prunes stale). */
export function putNotifyFired(keys: string[]): Promise<NotifyFiredResponse> {
  return apiClient.put<NotifyFiredResponse>(NOTIFY_FIRED_PATH, { keys });
}

/** POST — atomically reserve keys before speak (multi-client dedupe). */
export function claimNotifyFired(
  keys: string[],
): Promise<NotifyFiredClaimResponse> {
  return apiClient.post<NotifyFiredClaimResponse>(`${NOTIFY_FIRED_PATH}/claim`, {
    keys,
  });
}

/** GET trigger history entries. */
export function fetchNotifyHistory(): Promise<NotifyHistoryResponse> {
  return apiClient.get<NotifyHistoryResponse>(NOTIFY_HISTORY_PATH);
}

/** PUT trigger history (server truncates to ≤100). */
export function putNotifyHistory(
  entries: NotifyHistoryEntryPayload[],
): Promise<NotifyHistoryResponse> {
  return apiClient.put<NotifyHistoryResponse>(NOTIFY_HISTORY_PATH, { entries });
}
