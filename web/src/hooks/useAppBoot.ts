import { useCallback, useEffect, useReducer } from "react";
import { fetchHealth } from "../api/system";
import { resolveAuthGate } from "../domain/connection/authGate";
import {
  bootReduce,
  initialBootState,
  shouldReenterAuthOnSessionChange,
  type BootMachineState,
} from "../domain/connection/bootMachine";
import {
  clearDeviceSession,
  hasDeviceSession,
  subscribeConnection,
} from "../domain/connection/connectionStore";
import { syncDesktopConnectionOnBoot } from "../electron/electronConnection";
import { isElectronDesktop } from "../electron/electronWindow";

export type AppBootController = {
  boot: BootMachineState;
  checkBoot: () => Promise<void>;
  markSecretsRecovered: () => void;
  onSetupComplete: () => void;
};

/** Boot state machine + desktop sync / session-loss reauth side effects. */
export function useAppBoot(): AppBootController {
  const [boot, dispatchBoot] = useReducer(bootReduce, initialBootState);

  const runAuthGate = useCallback(async (opts?: { fromSessionLoss?: boolean }) => {
    dispatchBoot({ type: "check_started" });
    try {
      const decision = await resolveAuthGate(opts);
      if (decision.kind === "ready") {
        dispatchBoot({ type: "auth_ready" });
        return;
      }
      dispatchBoot({
        type: "auth_setup",
        status: decision.status,
        reason: decision.reason,
      });
    } catch (error) {
      dispatchBoot({
        type: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const checkBoot = useCallback(async () => {
    dispatchBoot({ type: "check_started" });
    try {
      const health = await fetchHealth();
      if (health.secretsReady === false) {
        clearDeviceSession();
        dispatchBoot({ type: "secrets_blocked", error: health.secretsError ?? null });
        return;
      }
      dispatchBoot({ type: "schema_ok" });
      await runAuthGate();
    } catch (error) {
      dispatchBoot({
        type: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [runAuthGate]);

  const markSecretsRecovered = useCallback(() => {
    dispatchBoot({ type: "secrets_gate_complete" });
    void checkBoot();
  }, [checkBoot]);

  // Desktop host: await connection sync before schema/auth so a stale remote
  // baseUrl cannot poison the first checkBoot (false "unavailable").
  useEffect(() => {
    let cancelled = false;
    const bootOnce = async () => {
      try {
        if (isElectronDesktop()) {
          await syncDesktopConnectionOnBoot();
        }
        if (!cancelled) {
          await checkBoot();
        }
      } catch (error) {
        if (!cancelled) {
          dispatchBoot({
            type: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };
    void bootOnce();
    return () => {
      cancelled = true;
    };
  }, [checkBoot]);

  // Session cleared (refresh failure / revoke-all / logout) → reauth / first-run by reason.
  useEffect(() => {
    return subscribeConnection(() => {
      if (!shouldReenterAuthOnSessionChange(boot.phase, hasDeviceSession())) return;
      dispatchBoot({ type: "session_lost" });
      void runAuthGate({ fromSessionLoss: true });
    });
  }, [boot.phase, runAuthGate]);

  const onSetupComplete = useCallback(() => {
    dispatchBoot({ type: "setup_complete" });
    void runAuthGate();
  }, [runAuthGate]);

  return {
    boot,
    checkBoot,
    markSecretsRecovered,
    onSetupComplete,
  };
}
