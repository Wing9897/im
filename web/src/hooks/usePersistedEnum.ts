import { usePersistedState } from "./usePersistedState";

/** Persists a string enum, falling back when storage contains an invalid member. */
export function usePersistedEnum<T extends string>(
  storageKey: string,
  fallback: T,
  isValid: (value: string | null) => value is T,
) {
  const [storedValue, setStoredValue] = usePersistedState<T>(storageKey, fallback);
  return [isValid(storedValue) ? storedValue : fallback, setStoredValue] as const;
}
