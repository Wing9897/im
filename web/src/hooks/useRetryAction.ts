import { useCallback, useRef, useState } from "react";

interface UseRetryActionReturn {
  retrying: boolean;
  handleRetry: () => void;
}

/** Wraps an async action with a `retrying` flag and guards against concurrent invocations. */
export function useRetryAction(
  asyncFn: () => Promise<void>,
): UseRetryActionReturn {
  const [retrying, setRetrying] = useState(false);
  const retryingRef = useRef(false);

  const handleRetry = useCallback(() => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    void asyncFn()
      .catch(() => {})
      .finally(() => {
        retryingRef.current = false;
        setRetrying(false);
      });
  }, [asyncFn]);

  return { retrying, handleRetry };
}
