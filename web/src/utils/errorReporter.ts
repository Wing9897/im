/**
 * Error Reporter Module
 *
 * Provides production error capture for the IntelligenceMonitor frontend.
 * Critical errors are persisted via appendAppLog.
 */

import { appendAppLog } from "../api/logs";
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
 * via appendAppLog for critical severity.
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

  // Persist critical errors via appendAppLog (fire-and-forget)
  if (severity === "critical") {
    appendAppLog({
      level: "error",
      category: "frontend",
      message,
      details: stack,
    }).catch(() => {
      // Silently discard persistence failures (Requirement 4.7)
    });
  }
}
