/**
 * First-run setup and authenticated device-management API.
 *
 * Public device-session endpoints are re-exported from `setupSession`, which
 * deliberately does not import ApiClient. Authenticated endpoints use
 * `apiClient` so expired access tokens refresh.
 */

import { apiClient } from "./client";
import { publicFetchJson } from "./publicFetch";
export {
  loginWithPassword,
  refreshDeviceSession,
  registerAdmin,
} from "./setupSession";
export type { DeviceSessionResponse } from "./setupSession";

export interface SetupStatus {
  bootstrapped: boolean;
  hasAdmin: boolean;
  hasActiveDevice: boolean;
  credentialsConfigured: boolean;
  localhostAuthExempt: boolean;
  /** File-armed local forgot-password (`connection.json` → resetPasswordForLocal). */
  resetPasswordForLocal: boolean;
}

export interface SetupDevice {
  id: string;
  label: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export function fetchSetupStatus(baseUrl?: string): Promise<SetupStatus> {
  return publicFetchJson<SetupStatus>("/api/v1/setup/status", { baseUrl });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return apiClient.post<{ ok: boolean }>("/api/v1/setup/change-password", {
    currentPassword,
    newPassword,
  });
}

export function resetPassword(
  username: string,
  newPassword: string,
  baseUrl?: string,
): Promise<{ ok: boolean }> {
  return publicFetchJson<{ ok: boolean }>("/api/v1/setup/reset-password", {
    method: "POST",
    body: JSON.stringify({ username, newPassword }),
    baseUrl,
  });
}

export function logoutDeviceSession(): Promise<{ ok: boolean }> {
  return apiClient.post<{ ok: boolean }>("/api/v1/setup/logout");
}

export async function fetchSetupDevices(): Promise<SetupDevice[]> {
  const body = await apiClient.get<{ devices: SetupDevice[] }>("/api/v1/setup/devices");
  return body.devices ?? [];
}

export function revokeSetupDevice(deviceId: string): Promise<{ ok: boolean }> {
  return apiClient.delete<{ ok: boolean }>(
    `/api/v1/setup/devices/${encodeURIComponent(deviceId)}`,
  );
}
