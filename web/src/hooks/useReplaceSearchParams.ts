import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

type Mutator = (params: URLSearchParams) => void;

/** Replace the current URL query string without pushing history. */
export function useReplaceSearchParams() {
  const [, setSearchParams] = useSearchParams();

  return useCallback(
    (mutate: Mutator) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          // Avoid re-renders / history churn when nothing changed.
          if (next.toString() === prev.toString()) return prev;
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
}
