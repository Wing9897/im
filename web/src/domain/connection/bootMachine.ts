/**
 * Explicit app boot state machine.
 *
 * Phases: loading → secrets_blocked | setup | ready | unavailable.
 * App.tsx only consumes phase + payloads; transitions live here so revoke-all /
 * refresh-failure / retry paths stay unit-testable without mounting the shell.
 */

import type { SetupStatus } from "../../api/setup";
import type { SetupFlowReason } from "./authGate";

export type BootPhase =
  | "loading"
  | "secrets_blocked"
  | "setup"
  | "ready"
  | "unavailable";

export interface BootMachineState {
  phase: BootPhase;
  error: string | null;
  /** Decrypt failure detail while phase === secrets_blocked (from health.secretsError). */
  secretsError: string | null;
  setupStatus: SetupStatus | null;
  /** Which setup UI when phase === setup (first-run 3-step vs reauth). */
  setupReason: SetupFlowReason | null;
}

export type BootEvent =
  /** Full boot / retry: health check then schema / auth. */
  | { type: "check_started" }
  /** Encryption key cannot decrypt stored secrets — password rotate required. */
  | { type: "secrets_blocked"; error?: string | null }
  /** Schema ready; auth gate in flight (stay loading). */
  | { type: "schema_ok" }
  /** Auth gate: device session present. */
  | { type: "auth_ready" }
  /** Auth gate: FirstRunWizard or SessionReauthWizard required. */
  | { type: "auth_setup"; status: SetupStatus; reason: SetupFlowReason }
  /** Schema or auth hard failure. */
  | { type: "failed"; error: string }
  /**
   * Session cleared while shell was ready (refresh failure, revoke-all, logout).
   * Returns to loading; caller must re-run auth gate.
   */
  | { type: "session_lost" }
  /** SecretsBrokenGate finished rotate; caller re-runs checkBoot. */
  | { type: "secrets_gate_complete" }
  /** Wizard finished; caller re-runs auth gate. */
  | { type: "setup_complete" };

export const initialBootState: BootMachineState = {
  phase: "loading",
  error: null,
  secretsError: null,
  setupStatus: null,
  setupReason: null,
};

function loadingClear(): BootMachineState {
  return {
    phase: "loading",
    error: null,
    secretsError: null,
    setupStatus: null,
    setupReason: null,
  };
}

export function bootReduce(state: BootMachineState, event: BootEvent): BootMachineState {
  switch (event.type) {
    case "check_started":
      return loadingClear();
    case "secrets_blocked":
      return {
        phase: "secrets_blocked",
        error: null,
        secretsError: event.error ?? null,
        setupStatus: null,
        setupReason: null,
      };
    case "schema_ok":
      // Auth follows immediately; keep loading until auth_* lands.
      return { ...state, phase: "loading", error: null, secretsError: null, setupReason: null };
    case "auth_ready":
      return {
        phase: "ready",
        error: null,
        secretsError: null,
        setupStatus: null,
        setupReason: null,
      };
    case "auth_setup":
      return {
        phase: "setup",
        error: null,
        secretsError: null,
        setupStatus: event.status,
        setupReason: event.reason,
      };
    case "failed":
      return {
        phase: "unavailable",
        error: event.error,
        secretsError: null,
        setupStatus: null,
        setupReason: null,
      };
    case "session_lost":
      if (state.phase !== "ready") return state;
      return loadingClear();
    case "secrets_gate_complete":
      if (state.phase !== "secrets_blocked") return state;
      return loadingClear();
    case "setup_complete":
      if (state.phase !== "setup") return state;
      return loadingClear();
    default:
      return state;
  }
}

/**
 * When connection store notifies (refresh clear / logout / revoke-all),
 * re-enter auth only from a ready shell with no device session.
 */
export function shouldReenterAuthOnSessionChange(
  phase: BootPhase,
  hasSession: boolean,
): boolean {
  return phase === "ready" && !hasSession;
}
