import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { isCancelledError } from "../api/httpRetry";
import { ToastContext } from "../context/ToastContext";
import { toErrorMessage } from "../utils/errors";
import { useLatestRequest } from "./useLatestRequest";

export interface UseAsyncResourceOptions {
  /**
   * If true, errors are also surfaced via useToast().showToast.
   * Default false — page resources prefer ErrorRetryBanner / local error UI.
   * Opt in for command-style fetches that have no banner.
   */
  toastOnError?: boolean;
  /** Custom error mapper. Defaults to toErrorMessage. */
  errorMessage?: (error: unknown) => string;
}

export interface UseAsyncResourceResult<TArgs, TResult> {
  data: TResult | null;
  loading: boolean;
  /** True while waiting for the first successful payload (no cached data yet). */
  initialLoading: boolean;
  /** True when re-fetching while cached data is still shown. */
  isRefreshing: boolean;
  error: string | null;
  /**
   * Execute the fetcher. A newer `execute` aborts the previous request.
   * Stale / aborted responses are dropped. Returns null if stale or cancelled.
   */
  execute: (args: TArgs) => Promise<TResult | null>;
  /** Reset data/error/loading to initial state without triggering a fetch. */
  reset: () => void;
}

/**
 * Generic async resource hook that encapsulates the
 * `setLoading(true) → fetch → setData|setError+toast → setLoading(false)`
 * pattern with built-in stale-request guarding via {@link useLatestRequest}.
 *
 * - Stale responses (those superseded by a newer `execute` call) are dropped
 *   and `execute` resolves with `null` for that call.
 * - A newer `execute` aborts the previous in-flight request via AbortController.
 *   Cancellation is not a user-facing error.
 * - Errors are mapped via `options.errorMessage ?? toErrorMessage` and, when
 *   `options.toastOnError === true`, surfaced through `useToast().showToast`.
 * - State updates after unmount are skipped so callers don't need extra guards.
 */
export function useAsyncResource<TArgs, TResult>(
  fetcher: (args: TArgs, signal: AbortSignal) => Promise<TResult>,
  options?: UseAsyncResourceOptions,
): UseAsyncResourceResult<TArgs, TResult> {
  const { toastOnError = false, errorMessage } = options ?? {};
  // Use the context directly (not the `useToast` hook) so callers that opt
  // out of toast notifications don't need to provide a ToastProvider. This
  // matters for existing tests that mount these page hooks without wrapping
  // in <ToastProvider>.
  const toastContext = useContext(ToastContext);
  const request = useLatestRequest();

  const [data, setData] = useState<TResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track mount status so we don't setState after unmount when a pending
  // fetcher eventually resolves. In-flight work is also aborted on unmount
  // and when a newer `execute` starts.
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  // Keep the latest fetcher / options in refs so `execute` has a stable
  // identity and callers don't need to memoize them.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const errorMessageRef = useRef(errorMessage);
  useEffect(() => {
    errorMessageRef.current = errorMessage;
  }, [errorMessage]);

  const toastOnErrorRef = useRef(toastOnError);
  useEffect(() => {
    toastOnErrorRef.current = toastOnError;
  }, [toastOnError]);

  const execute = useCallback(
    async (args: TArgs): Promise<TResult | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const token = request.begin();
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await fetcherRef.current(args, controller.signal);
        if (!mountedRef.current || !request.isCurrent(token)) {
          return null;
        }
        setData(result);
        setLoading(false);
        return result;
      } catch (e) {
        if (!mountedRef.current || !request.isCurrent(token)) {
          return null;
        }
        if (isCancelledError(e)) {
          setLoading(false);
          return null;
        }
        const msg = errorMessageRef.current?.(e) ?? toErrorMessage(e);
        setError(msg);
        setLoading(false);
        if (toastOnErrorRef.current) {
          toastContext?.showToast(msg, "error");
        }
        return null;
      }
    },
    [request, toastContext],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // Invalidate any in-flight request so its result is dropped.
    request.begin();
    if (!mountedRef.current) return;
    setData(null);
    setLoading(false);
    setError(null);
  }, [request]);

  const initialLoading = data === null && (loading || error === null);
  const isRefreshing = loading && data !== null;

  return { data, loading, initialLoading, isRefreshing, error, execute, reset };
}
