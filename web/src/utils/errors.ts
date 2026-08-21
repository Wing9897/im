import { ApiRequestError } from "../api/parseApiError";
import { formatAnalysisErrorMessage } from "../domain/analysis/formatAnalysisError";
import i18n from "../i18n";
import { messageForErrorCode } from "../i18n/errorCodes";

function localizeMessage(raw: string): string {
  const byCode = messageForErrorCode(raw);
  if (byCode) return byCode;
  return formatAnalysisErrorMessage(raw, i18n.t.bind(i18n)) ?? raw;
}

/** Coerces an unknown error value into an Error instance. */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/** Extracts a human-readable message string from an unknown error value. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const mapped = messageForErrorCode(error.errorCode);
    if (mapped) return mapped;
    return localizeMessage(error.message);
  }
  if (error instanceof Error) {
    return localizeMessage(error.message);
  }
  if (typeof error === "string") {
    return localizeMessage(error);
  }
  return String(error);
}

/**
 * Command-failure path into the single ToastProvider pipeline.
 *
 * Use for mutations / user-triggered actions. Do not pair with
 * `emitErrorToast: true` on the same request (would double-notify).
 * List/resource loads should prefer ErrorRetryBanner instead.
 *
 * @param error - The caught error from an API call.
 * @param showToast - Optional toast function (from `useToast().showToast`).
 *                    When provided the error is surfaced as an "error" toast.
 * @returns The extracted error message string.
 */
export function handleCommandError(
  error: unknown,
  showToast?: (message: string, tone?: "success" | "error" | "info" | "warning") => void,
): string {
  const message = toErrorMessage(error);
  if (showToast) {
    showToast(message, "error");
  }
  return message;
}
