import { Dispatch, SetStateAction, useEffect, useState } from "react";

import { logWarn } from "../utils/logger";

type PersistStorage = "local" | "session";

function storageFor(kind: PersistStorage): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function readStoredValue<T>(
  storage: Storage,
  storageKey: string,
  fallback: T,
): { value: T; shouldReset: boolean } {
  const stored = storage.getItem(storageKey);
  if (stored === null) {
    return { value: fallback, shouldReset: false };
  }
  try {
    return { value: JSON.parse(stored) as T, shouldReset: false };
  } catch (error) {
    if (typeof fallback === "string") {
      return { value: stored as T, shouldReset: true };
    }
    logWarn(`[persisted-state] invalid JSON for key "${storageKey}"`, error);
    return { value: fallback, shouldReset: true };
  }
}

interface UsePersistedStateOptions {
  /** Delay storage writes while keeping React state immediate (e.g. search draft). */
  persistDebounceMs?: number;
  /**
   * `local` (default) survives browser restarts; `session` clears when the tab
   * closes — use for noisy search drafts.
   */
  storage?: PersistStorage;
}

/** Like `useState` but persists the value under the given key. */
export function usePersistedState<T>(
  storageKey: string,
  fallback: T,
  options?: UsePersistedStateOptions,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const persistDebounceMs = options?.persistDebounceMs ?? 0;
  const storageKind = options?.storage ?? "local";
  const [value, setValue] = useState<T>(() => {
    const storage = storageFor(storageKind);
    if (!storage) {
      return fallback;
    }

    try {
      const { value, shouldReset } = readStoredValue(storage, storageKey, fallback);
      if (shouldReset) {
        storage.removeItem(storageKey);
      }
      return value;
    } catch (error) {
      logWarn(`[persisted-state] failed to read key "${storageKey}"`, error);
      return fallback;
    }
  });

  useEffect(() => {
    const storage = storageFor(storageKind);
    if (!storage) return;

    const write = () => {
      try {
        storage.setItem(storageKey, JSON.stringify(value));
      } catch (error) {
        logWarn(`[persisted-state] failed to write key "${storageKey}"`, error);
      }
    };

    if (persistDebounceMs <= 0) {
      write();
      return;
    }

    const timer = window.setTimeout(write, persistDebounceMs);
    return () => window.clearTimeout(timer);
  }, [persistDebounceMs, storageKey, storageKind, value]);

  return [value, setValue] as const;
}
