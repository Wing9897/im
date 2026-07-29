import { useCallback, useState } from "react";

export function useDetailSelection<T>() {
  const [selected, setSelected] = useState<T | null>(null);
  const isOpen = selected !== null;

  const select = useCallback((item: T) => {
    setSelected(item);
  }, []);

  const clear = useCallback(() => {
    setSelected(null);
  }, []);

  return { selected, isOpen, select, clear };
}
