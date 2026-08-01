import { useCallback, useEffect, useState } from "react";

/**
 * localStorage value synced across components via a window Event.
 * Unlike usePersistedState, this supports custom serialize/parse and live peers.
 */
export function useSyncedLocalStorage<T>({
  key,
  eventName,
  read,
  write,
}: {
  key: string;
  eventName: string;
  read: () => T;
  write: (value: T) => void;
}): readonly [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValueState] = useState(read);

  useEffect(() => {
    const onChange = () => setValueState(read());
    window.addEventListener(eventName, onChange);
    return () => window.removeEventListener(eventName, onChange);
    // Intentionally subscribe once; readers always hit current localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable key/event contract
  }, [eventName, key]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(read()) : next;
      write(resolved);
      window.dispatchEvent(new Event(eventName));
      setValueState(resolved);
    },
    [eventName, read, write],
  );

  return [value, setValue] as const;
}
