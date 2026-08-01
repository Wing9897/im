import { useCallback, useRef } from "react";

export type DeepLinkGate = "clear" | "skip" | "apply";

/**
 * Latch for keep-mount deep-links: apply once per `location.key` + payload,
 * skip Strict Mode / effect re-runs, clear when the signal disappears so a
 * later navigation with the same payload can apply again.
 */
export function useDeepLinkFingerprint() {
  const appliedFingerprintRef = useRef<string | null>(null);

  return useCallback((locationKey: string, payload: string | null): DeepLinkGate => {
    if (payload == null) {
      appliedFingerprintRef.current = null;
      return "clear";
    }
    const fingerprint = `${locationKey}:${payload}`;
    if (appliedFingerprintRef.current === fingerprint) {
      return "skip";
    }
    appliedFingerprintRef.current = fingerprint;
    return "apply";
  }, []);
}
