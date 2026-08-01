import type {
  AccountStatusChangedPayload,
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
  activeAnalysis: ActiveAnalysisState | null;
  activeAnalyses: Map<string, ActiveAnalysisState>;
  lastAnalysisEvent: RuntimeAnalysisEvent | null;
  lastAccountStatusChange: AccountStatusChangedPayload | null;
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
    message: String(i18n.t("common:runtime.aiCheckFailed")),
    details: message,
  };
}

export function buildWindowErrorLog(event: ErrorEvent): AppLogInput {
  const details = [
    event.message,
    event.filename ? `file=${event.filename}` : "",
    event.lineno ? `line=${event.lineno}` : "",
    event.colno ? `column=${event.colno}` : "",
    event.error ? `stack=${String(event.error)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    level: "error",
    category: "system",
    message: String(i18n.t("common:runtime.frontendError")),
    details,
  };
}

export function buildUnhandledRejectionLog(
  event: PromiseRejectionEvent,
): AppLogInput {
  return {
    level: "error",
    category: "system",
    message: String(i18n.t("common:runtime.unhandledRejection")),
    details:
      event.reason instanceof Error
        ? (event.reason.stack ?? event.reason.message)
        : String(event.reason),
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
