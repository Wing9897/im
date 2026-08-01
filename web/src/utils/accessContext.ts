import { useMemo } from "react";

/**
 * Whether the UI is loaded from loopback or a non-local hostname (e.g. LAN IP).
 * API write access for remote hosts depends on the configured household Bearer
 * token, not on this flag alone.
 */
type AccessContext = "local" | "remote";

/** Loopback hostnames that indicate a local session. */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Detect the access context based on the current page's hostname.
 *
 * Returns `"local"` when loaded from localhost, 127.0.0.1, or ::1,
 * and `"remote"` for any other hostname (e.g. a LAN IP).
 *
 * @param hostname - Override for testing; defaults to `window.location.hostname`.
 */
export function detectAccessContext(hostname?: string): AccessContext {
  const host = hostname ?? window.location.hostname;
  if (LOCAL_HOSTNAMES.has(host)) {
    return "local";
  }
  return "remote";
}

/**
 * React hook that returns the current access context.
 *
 * The value is computed once on mount since the hostname cannot change
 * during a page session.
 */
export function useAccessContext(): AccessContext {
  return useMemo(() => detectAccessContext(), []);
}
