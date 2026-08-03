import { Dispatch, SetStateAction, useEffect, useState } from "react";

import type { MonitorViewMode } from "../domain/monitor/monitorViewMode";
import { isMonitorViewMode } from "../domain/monitor/monitorViewMode";
import type { ViewMode } from "../types/common";
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

/** Persists a string enum, falling back when storage contains an invalid member. */
export function usePersistedEnum<T extends string>(
  storageKey: string,
  fallback: T,
  isValid: (value: string | null) => value is T,
) {
  const [storedValue, setStoredValue] = usePersistedState<T>(storageKey, fallback);
  return [isValid(storedValue) ? storedValue : fallback, setStoredValue] as const;
}

function isViewMode(value: string | null): value is ViewMode {
  return value === "card" || value === "list" || value === "map";
}

/** Persists a ViewMode ("card" | "list" | "map") to localStorage. */
export function usePersistedViewMode(storageKey: string, fallback: ViewMode = "card") {
  return usePersistedEnum(storageKey, fallback, isViewMode);
}

/** Persists monitor view mode (card | list | wall) to localStorage. */
export function usePersistedMonitorViewMode(
  storageKey: string,
  fallback: MonitorViewMode = "card",
) {
  return usePersistedEnum(
    storageKey,
    fallback,
    (value): value is MonitorViewMode => isMonitorViewMode(value),
  );
}
