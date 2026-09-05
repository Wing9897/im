/**
 * Frontend defaults for the local Intelligence Monitor API.
 *
 * Keep ``DEFAULT_API_PORT`` in lockstep with ``server.constants.SERVICE_PORT``
 * (see ``serviceEndpoints.drift.test.ts``). Runtime origin still comes from
 * ``resolveBaseUrl`` (custom server / Vite env / window.origin).
 */

export const DEFAULT_API_PORT = 18820;

/** Preferred loopback host for fallbacks and docs examples. */
export const DEFAULT_API_LOOPBACK_HOST = "127.0.0.1";

/** Default API origin when no custom / env / window origin applies. */
export function defaultApiBaseUrl(
  host: string = DEFAULT_API_LOOPBACK_HOST,
  port: number = DEFAULT_API_PORT,
): string {
  return `http://${host}:${port}`;
}
