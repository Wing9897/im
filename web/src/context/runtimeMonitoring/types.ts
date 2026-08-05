import type {
  SourceStatusChangedPayload,
  AiEngineStatus,
  AiEngineHealthStatus,
  AnalysisCompletedPayload,
  AnalysisFailedPayload,
  AnalysisStartedPayload,
  MessagesUpdatedPayload,
  QueueStatus,
  CollectorStatus,
} from "../../types";
import type { ActiveAnalysisState, AppLogInput } from "../appRuntimeShared";
import i18n from "../../i18n";
import { APP_LOG_KIND } from "../../logging/appLogClient";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RuntimeAnalysisEvent =
  | {
      type: "started";
      payload: AnalysisStartedPayload;
      receivedAt: number;
    }
  | {
      type: "completed";
      payload: AnalysisCompletedPayload;
      receivedAt: number;
    }
  | {
      type: "failed";
      payload: AnalysisFailedPayload;
      receivedAt: number;
    };

export interface RuntimeMessagesUpdateEvent {
  payload: MessagesUpdatedPayload;
  receivedAt: number;
}

export interface RuntimeMonitoringState {
  collectorStatus: CollectorStatus;
  aiEngineStatus: AiEngineStatus;
  queueStatus: QueueStatus | null;
  analysisPaused: boolean;
  activeAnalyses: Map<string, ActiveAnalysisState>;
  lastAnalysisEvent: RuntimeAnalysisEvent | null;
  lastSourceStatusChange: SourceStatusChangedPayload | null;
  lastMessagesUpdate: RuntimeMessagesUpdateEvent | null;
  requestAiStatusRefresh: (logOnChange?: boolean) => void;
  requestQueueStatusRefresh: (logPauseChanges?: boolean) => void;
}

export interface RuntimeMonitoringOptions {
  addLog: (entry: AppLogInput) => void;
  refreshStoredLogs: () => Promise<void>;
  warnNonFatal: (key: string, message: string, error: unknown) => void;
}

// ---------------------------------------------------------------------------
// Log-building helpers
// ---------------------------------------------------------------------------

export function buildAiHealthSignature(
  status: AiEngineStatus,
  health: AiEngineHealthStatus,
): string {
  return `${status}|${health.reason ?? ""}|${health.provider ?? ""}`;
}

export function buildAiStatusCheckFailureLog(message: string): AppLogInput {
  return {
    level: "error",
    category: "collector",
    kind: APP_LOG_KIND.RUNTIME_AI_CHECK,
    message: String(i18n.t("common:runtime.aiCheckFailed")),
    messageKey: "logs:templates.runtimeAiCheckFailed",
    source: "frontend.runtime.ai_check",
    payload: { error: message },
  };
}

export function buildWindowErrorLog(event: ErrorEvent): AppLogInput {
  return {
    level: "error",
    category: "frontend",
    kind: APP_LOG_KIND.FRONTEND_WINDOW,
    message: String(i18n.t("common:runtime.frontendError")),
    messageKey: "logs:templates.frontendWindowError",
    source: "frontend.window",
    payload: {
      message: event.message,
      filename: event.filename || null,
      lineno: event.lineno || null,
      colno: event.colno || null,
      stack: event.error ? String(event.error) : null,
    },
  };
}

export function buildUnhandledRejectionLog(
  event: PromiseRejectionEvent,
): AppLogInput {
  return {
    level: "error",
    category: "frontend",
    kind: APP_LOG_KIND.FRONTEND_REJECTION,
    message: String(i18n.t("common:runtime.unhandledRejection")),
    messageKey: "logs:templates.frontendUnhandledRejection",
    source: "frontend.rejection",
    payload: {
      reason:
        event.reason instanceof Error
          ? (event.reason.stack ?? event.reason.message)
          : String(event.reason),
    },
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EVENT_LOG_REFRESH_DELAY_MS = 350;
export const AI_STATUS_REFRESH_INTERVAL_MS = 45_000;
export const COLLECTOR_STATUS_REFRESH_INTERVAL_MS = 45_000;
export const STORED_LOG_REFRESH_INTERVAL_MS = 15_000;
export const QUEUE_STATUS_REFRESH_INTERVAL_MS = 20_000;
