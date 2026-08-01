import { useCallback, useMemo, useRef } from "react";

/**
 * Provides a monotonic version token for stale-request guarding.
 * Call `begin()` before each async operation and `isCurrent(token)` when it
 * resolves to discard results from superseded requests.
 */
export function useLatestRequest() {
  const versionRef = useRef(0);

  const begin = useCallback(() => {
    versionRef.current += 1;
    return versionRef.current;
  }, []);

  const current = useCallback(() => versionRef.current, []);

  const isCurrent = useCallback(
    (version: number) => versionRef.current === version,
    [],
  );

  return useMemo(
    () => ({ begin, current, isCurrent }),
    [begin, current, isCurrent],
  );
}
