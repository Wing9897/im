import { useCallback, useState } from "react";
import { ApiRequestError } from "../api/parseApiError";
import { toErrorMessage } from "../utils/errors";

interface UseFormSubmitReturn {
  submitting: boolean;
  error: string | null;
  errorCode: string | null;
  handleSubmit: (action: () => Promise<void>) => Promise<void>;
  clearError: () => void;
}

/** Manages form submission state (submitting flag, error message) with automatic error extraction. */
export function useFormSubmit(): UseFormSubmitReturn {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleSubmit = useCallback(async (action: () => Promise<void>) => {
    setSubmitting(true);
    setError(null);
    setErrorCode(null);
    try {
      await action();
    } catch (e) {
      setError(toErrorMessage(e));
      setErrorCode(e instanceof ApiRequestError ? e.errorCode : null);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  return { submitting, error, errorCode, handleSubmit, clearError };
}
