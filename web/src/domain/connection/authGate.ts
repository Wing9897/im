/**
 * Boot-time auth gate: FirstRunWizard vs SessionReauthWizard vs AppShell.
 */

import { fetchSetupDevices, fetchSetupStatus, type SetupStatus } from "../../api/setup";
import { clearDeviceSession, hasDeviceSession } from "./connectionStore";

/** Which pre-shell UI to show when there is no valid device session. */
export type SetupFlowReason = "first_run" | "session_expired" | "needs_login";

export type AuthGateDecision =
  | { kind: "ready" }
  | { kind: "setup"; status: SetupStatus; reason: SetupFlowReason };

export function classifySetupReason(
  status: SetupStatus,
  flags: { sessionCleared?: boolean; fromSessionLoss?: boolean } = {},
): SetupFlowReason {
  // Admin exists but every device revoked — password login (FirstRun shell; no re-register).
  if (status.bootstrapped && !status.hasActiveDevice) {
    return "needs_login";
  }
  // Had a local session that died, or shell notified session_lost.
  if (flags.sessionCleared || flags.fromSessionLoss) {
    if (status.bootstrapped && status.hasActiveDevice) {
      return "session_expired";
    }
  }
  return "first_run";
}

/**
 * After schema is ready: decide wizard vs app.
 *
 * Local tokens alone are not enough — validate with an authed call. Cleared /
 * expired sessions use a dedicated reauth UI (not the 3-step first-run wizard).
 */
export async function resolveAuthGate(
  opts?: { fromSessionLoss?: boolean },
): Promise<AuthGateDecision> {
  let status = await fetchSetupStatus();
  const hadLocalSession = hasDeviceSession();

  // Setup status is authoritative. A Desktop renderer can retain tokens in its
  // origin-local storage after the host DB is wiped; while the fresh DB still
  // has localhost_auth_exempt=true, an authenticated probe may return 200 even
  // though that Bearer token no longer identifies a device.
  if (!status.bootstrapped) {
    if (hadLocalSession) clearDeviceSession();
    return { kind: "setup", status, reason: "first_run" };
  }

  if (hadLocalSession) {
    try {
      const devices = await fetchSetupDevices();
      // Loopback exemption can make the endpoint reachable without proving the
      // presented token. Only `current=true` confirms this device session.
      if (!devices.some((device) => device.current)) {
        clearDeviceSession();
      }
    } catch (error) {
      if (!hasDeviceSession()) {
        status = await fetchSetupStatus();
        return {
          kind: "setup",
          status,
          reason: classifySetupReason(status, {
            sessionCleared: true,
            fromSessionLoss: opts?.fromSessionLoss,
          }),
        };
      }
      // A probe that failed without the auth client clearing the session is a
      // connectivity/server failure, not proof that the session is valid.
      throw error;
    }
    if (!hasDeviceSession()) {
      status = await fetchSetupStatus();
      return {
        kind: "setup",
        status,
        reason: classifySetupReason(status, {
          sessionCleared: true,
          fromSessionLoss: opts?.fromSessionLoss,
        }),
      };
    }
    return { kind: "ready" };
  }

  return {
    kind: "setup",
    status,
    reason: classifySetupReason(status, { fromSessionLoss: opts?.fromSessionLoss }),
  };
}
