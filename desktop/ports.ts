/**
 * Desktop shell default ports.
 *
 * Keep ``DEFAULT_SERVER_PORT`` in lockstep with ``server.constants.SERVICE_PORT``
 * (see ``tests/service-port-drift.test.ts``).
 */

export const DEFAULT_SERVER_PORT = 18820;
export const DEFAULT_VITE_DEV_PORT = 1420;

/** Loopback origin for host-mode shell / notifications (Electron uses localhost). */
export function defaultServerBaseUrl(port: number = DEFAULT_SERVER_PORT): string {
  return `http://localhost:${port}`;
}
