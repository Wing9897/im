import { useCallback, useState } from "react";

/** Shared busy-key gate for subscribe / unsubscribe card actions. */
export function useCatalogMembershipBusy(): {
  busyKey: string | null;
  runMembership: (key: string, action: () => Promise<void>) => Promise<void>;
} {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const runMembership = useCallback(async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await action();
    } finally {
      setBusyKey(null);
    }
  }, []);
  return { busyKey, runMembership };
}
