/**
 * Node-side default service / Vite ports.
 *
 * Keep SERVICE_PORT in lockstep with ``server/constants.py`` (drift-tested from
 * web + desktop packages). Prefer importing this module over scattering 18820.
 */

export const SERVICE_PORT = 18820;
export const VITE_PORT = 1420;

/** Loopback API origin used by smoke / health helpers (hostname form may vary). */
export const DEFAULT_API_LOOPBACK_HOST = "127.0.0.1";

export function defaultApiBaseUrl(host = DEFAULT_API_LOOPBACK_HOST) {
  return `http://${host}:${SERVICE_PORT}`;
}

export const HEALTH_URL = `http://localhost:${SERVICE_PORT}/api/v1/health`;
