/**
 * Public device-session endpoints shared by setup flows and auth refresh.
 *
 * This module intentionally stays below ApiClient: importing it must never
 * pull in the authenticated client that invokes refresh on 401 responses.
 */

import {
  saveDeviceSession,
  type DeviceSessionTokens,
} from "../domain/connection/connectionStore";
import { publicFetchJson } from "./publicFetch";

export interface DeviceSessionResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  device: {
    id: string;
    label: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
  };
}

function toSessionTokens(body: DeviceSessionResponse): DeviceSessionTokens {
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    accessExpiresAt: body.accessExpiresAt,
    refreshExpiresAt: body.refreshExpiresAt,
    deviceId: body.device?.id,
    deviceLabel: body.device?.label,
  };
}

export async function registerAdmin(
  username: string,
  password: string,
  label = "Host",
  baseUrl?: string,
): Promise<DeviceSessionResponse> {
  const body = await publicFetchJson<DeviceSessionResponse>("/api/v1/setup/register", {
    method: "POST",
    body: JSON.stringify({ username, password, label }),
    baseUrl,
  });
  saveDeviceSession(toSessionTokens(body));
  return body;
}

export async function loginWithPassword(
  username: string,
  password: string,
  label = "Device",
  baseUrl?: string,
): Promise<DeviceSessionResponse> {
  const body = await publicFetchJson<DeviceSessionResponse>("/api/v1/setup/login", {
    method: "POST",
    body: JSON.stringify({ username, password, label }),
    baseUrl,
  });
  saveDeviceSession(toSessionTokens(body));
  return body;
}

/** Refresh without ApiClient, preventing recursive 401 refresh. */
export async function refreshDeviceSession(
  refreshToken: string,
  baseUrl?: string,
): Promise<DeviceSessionResponse> {
  const body = await publicFetchJson<DeviceSessionResponse>("/api/v1/setup/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    baseUrl,
  });
  saveDeviceSession(toSessionTokens(body));
  return body;
}
