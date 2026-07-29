/**
 * Shared hook for Viewer pages that wraps `useAsyncResource` with:
 * - Auto-fetch on mount
 * - initialLoading semantics until first fetch settles
 * - Viewer-specific error mapping (401 → auth failure message)
 * - Retry callback for error UI
 */

import { useCallback, useEffect } from "react";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { ApiRequestError } from "../../api/client";
import i18n from "../../i18n";

interface UseViewerResourceResult<T> {
  data: T | null;
  initialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  retry: () => void;
}

/** Maps viewer API errors to user-friendly localized messages. */
function viewerErrorMessage(genericMessage: string) {
  return (err: unknown): string => {
    if (err instanceof ApiRequestError && err.status === 401) {
      return String(i18n.t("viewer.authFailed"));
    }
    return genericMessage;
  };
}

/**
 * Generic viewer resource hook. Fetches data on mount and exposes
 * loading/error/data/retry with consistent behavior across all viewer pages.
 */
export function useViewerResource<T>(
  fetcher: () => Promise<T>,
  errorFallback: string,
): UseViewerResourceResult<T> {
  const {
    data,
    initialLoading,
    isRefreshing,
    error,
    execute,
  } = useAsyncResource(
    () => fetcher(),
    {
      toastOnError: false,
      errorMessage: viewerErrorMessage(errorFallback),
    },
  );

  useEffect(() => {
    void execute(undefined);
  }, [execute]);

  const retry = useCallback(() => {
    void execute(undefined);
  }, [execute]);

  return { data, initialLoading, isRefreshing, error, retry };
}
