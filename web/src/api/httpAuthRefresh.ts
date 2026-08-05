/**
 * HTTP-layer auth refresh: 401 single-retry gate and SSE reconnect probe.
 * Token rotation itself lives in `./authRefresh`.
 */

import {
  getAccessToken,
  getRefreshToken,
} from "../domain/connection/connectionStore";
import {
  isSetupAuthPath,
  isStoredAccessExpired,
  refreshAccessTokenOnce,
} from "./authRefresh";

/** True when this response may trigger a single-flight refresh + retry. */
export function shouldAttemptAuthRefresh(
  url: string,
  status: number,
  options: { skipAuthRefresh?: boolean; retried?: boolean },
): boolean {
  return (
    status === 401 &&
    !options.retried &&
    !options.skipAuthRefresh &&
    !isSetupAuthPath(url) &&
    Boolean(getRefreshToken())
  );
}

/**
 * SSE reconnect gate: probe auth (EventSource cannot surface 401); refresh
 * only when needed; abort if still no access token — stops bare /events storms.
 */
export function createSseReconnectAuthGate(
  getBaseUrl: () => string,
): (signal: AbortSignal) => Promise<boolean> {
  return async (signal) => {
    if (signal.aborted) return false;
    const refresh = getRefreshToken();
    let access = getAccessToken();

    if (!access && refresh) {
      await refreshAccessTokenOnce();
      access = getAccessToken();
    }
    if (signal.aborted) return false;
    if (!access) return false;

    let needsRefresh = isStoredAccessExpired();
    if (!needsRefresh) {
      try {
        const probeUrl = new URL("/api/v1/setup/devices", getBaseUrl()).toString();
        const res = await fetch(probeUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${access}` },
          signal,
        });
        if (res.status === 401) needsRefresh = true;
      } catch {
        if (signal.aborted) return false;
      }
    }

    if (needsRefresh && refresh) {
      const ok = await refreshAccessTokenOnce();
      if (!ok) return false;
    }
    if (signal.aborted) return false;
    return Boolean(getAccessToken());
  };
}
