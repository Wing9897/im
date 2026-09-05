/**
 * Error Reporter Module
 *
 * Provides production error capture for the IntelligenceMonitor frontend.
 * Critical errors are persisted via recordAppLog.
 */

import { APP_LOG_KIND, recordAppLog } from "../api/appLogClient";
import { toErrorMessage } from "./errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a stack trace from an unknown error value, if available.
 */
function toErrorStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type Severity = "warning" | "error" | "critical";

/**
 * Capture an error, logging it to the console and optionally persisting
 * via recordAppLog for critical severity.
 */
export function captureError(
  error: unknown,
  context?: { component?: string; severity?: Severity },
): void {
  const severity = context?.severity ?? "error";
  const message = toErrorMessage(error);
  const stack = toErrorStack(error);

  // Always log to console so developers see the error
  console.error(
    `[${context?.component ?? "unknown"}]`,
    message,
    stack ?? "",
  );

  // Persist critical errors via recordAppLog (fire-and-forget)
  if (severity === "critical") {
    recordAppLog({
      level: "error",
      category: "frontend",
      kind: APP_LOG_KIND.FRONTEND_CRITICAL,
      message,
      messageKey: "logs:templates.frontendCritical",
      source: context?.component
        ? `frontend.${context.component}`
        : "frontend.critical",
      payload: stack ? { stack, message } : { message },
    }).catch(() => {
      // Silently discard persistence failures (Requirement 4.7)
    });
  }
}
