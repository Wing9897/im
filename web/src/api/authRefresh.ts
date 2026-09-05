/**
 * Single-flight access-token refresh for the HTTP client and SSE reconnect gate.
 */

import {
  clearDeviceSession,
  getConnectionSnapshot,
  getRefreshToken,
} from "../domain/connection/connectionStore";
import { refreshDeviceSession } from "./setupSession";

/** Paths that must not trigger a refresh loop on 401. */
export function isSetupAuthPath(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return (
      path.endsWith("/api/v1/setup/refresh") ||
      path.endsWith("/api/v1/setup/register") ||
      path.endsWith("/api/v1/setup/login") ||
      path.endsWith("/api/v1/setup/reset-password") ||
      path.endsWith("/api/v1/setup/status")
    );
  } catch {
    return false;
  }
}

/** True when stored access expiry is in the past. */
export function isStoredAccessExpired(): boolean {
  const exp = getConnectionSnapshot().accessExpiresAt;
  if (!exp) return false;
  const ms = Date.parse(exp);
  return !Number.isNaN(ms) && ms <= Date.now();
}

/** Single-flight refresh so concurrent 401s share one rotation. */
let refreshInFlight: Promise<boolean> | null = null;

export async function refreshAccessTokenOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      await refreshDeviceSession(refreshToken);
      return true;
    } catch {
      clearDeviceSession();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Test helper — clear the in-flight refresh promise between cases. Production builds drop the body. */
export function _resetAuthRefreshForTests(): void {
  refreshInFlight = null;
}
