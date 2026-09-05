/**
 * Single frontend entry point for persisting application logs.
 *
 * All Settings→Logs writes should go through {@link recordAppLog} so the
 * details envelope and `kind` field stay consistent with the server facade.
 */

import { appendAppLog } from "../api/logs";
import type { AppLogEntryPayload } from "../types";

/** Well-known app log kinds (keep in sync with server AppLog.record callers). */
export const APP_LOG_KIND = {
  BATCH_FAILURE: "batch.failure",
  ANALYSIS_TRACE: "analysis.trace",
  FRONTEND_WINDOW: "frontend.window",
  FRONTEND_REJECTION: "frontend.rejection",
  FRONTEND_REACT: "frontend.react",
  FRONTEND_CRITICAL: "frontend.critical",
  RUNTIME_AI_STATUS: "runtime.ai_status",
  RUNTIME_AI_CHECK: "runtime.ai_check",
  RUNTIME_COLLECTOR: "runtime.collector",
  SCHEDULER_PAUSED: "scheduler.paused",
  SCHEDULER_RESUMED: "scheduler.resumed",
  SOURCE_ERROR: "source.error",
  RETENTION_CLEANUP: "retention.cleanup",
} as const;

export type RecordAppLogInput = {
  level: string;
  category: string;
  kind: string;
  message?: string;
  messageKey?: string;
  messageParams?: Record<string, unknown>;
  source?: string;
  payload?: unknown;
};

/** details JSON envelope v1 — matches server AppLog.record. */
export type AppLogDetailsEnvelopeV1 = {
  v: 1;
  messageKey?: string;
  messageParams?: Record<string, unknown>;
  source?: string;
  payload?: unknown;
};

/** Build the v1 details envelope string, or null when there is nothing to store. */
export function buildAppLogDetailsEnvelope(
  input: Pick<
    RecordAppLogInput,
    "messageKey" | "messageParams" | "source" | "payload"
  >,
): string | null {
  const envelope: AppLogDetailsEnvelopeV1 = { v: 1 };
  let hasContent = false;
  if (typeof input.messageKey === "string" && input.messageKey) {
    envelope.messageKey = input.messageKey;
    hasContent = true;
  }
  if (
    input.messageParams &&
    typeof input.messageParams === "object" &&
    !Array.isArray(input.messageParams)
  ) {
    envelope.messageParams = input.messageParams;
    hasContent = true;
  }
  if (typeof input.source === "string" && input.source) {
    envelope.source = input.source;
    hasContent = true;
  }
  if (input.payload !== undefined) {
    envelope.payload = input.payload;
    hasContent = true;
  }
  if (!hasContent) {
    return null;
  }
  return JSON.stringify(envelope);
}

/** Parse a details string into the v1 envelope when possible. */
export function parseAppLogDetails(
  details: string | null | undefined,
): AppLogDetailsEnvelopeV1 | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    if (parsed.v !== 1 && typeof parsed.messageKey !== "string") {
      // Legacy / non-envelope JSON — expose as payload for the detail dialog.
      return { v: 1, payload: parsed };
    }
    return {
      v: 1,
      messageKey:
        typeof parsed.messageKey === "string" ? parsed.messageKey : undefined,
      messageParams:
        parsed.messageParams &&
        typeof parsed.messageParams === "object" &&
        !Array.isArray(parsed.messageParams)
          ? (parsed.messageParams as Record<string, unknown>)
          : undefined,
      source: typeof parsed.source === "string" ? parsed.source : undefined,
      payload: "payload" in parsed ? parsed.payload : undefined,
    };
  } catch {
    return { v: 1, payload: { text: details } };
  }
}

function asPayloadRecord(
  payload: unknown,
): Record<string, unknown> | undefined {
  if (payload === undefined || payload === null) return undefined;
  if (typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return { value: payload };
}

/**
 * Persist an application log through POST /api/v1/logs.
 * Sends flat LogCreate fields; the server builds the details envelope.
 * Fire-and-forget callers should `.catch(...)` as needed.
 */
export function recordAppLog(
  input: RecordAppLogInput,
): Promise<AppLogEntryPayload> {
  return appendAppLog({
    level: input.level,
    category: input.category,
    kind: input.kind,
    message: input.message,
    messageKey: input.messageKey,
    messageParams: input.messageParams,
    source: input.source,
    payload: asPayloadRecord(input.payload),
  });
}
