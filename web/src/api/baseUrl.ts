/**
 * Runtime API origin resolution (supports thin-client custom server URL).
 */

import { defaultApiBaseUrl } from "./serviceEndpoints";
import { getConnectionSnapshot } from "../domain/connection/connectionStore";

/**
 * Resolves the API base URL.
 * Priority: persisted custom serverBaseUrl → VITE_API_BASE_URL → window.origin → default loopback.
 * Always strips trailing slashes.
 */
export const resolveBaseUrl = (): string => {
  const custom = getConnectionSnapshot().serverBaseUrl?.trim();
  if (custom) return custom.replace(/\/+$/, "");

  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl?.trim()) return envUrl.replace(/\/+$/, "");

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return defaultApiBaseUrl();
};
