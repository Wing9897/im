import type {
  AiEngineHealthStatus,
  AiEngineStatus,
  AppLogEntryPayload,
  AppLogEntry,
  AppLogInput,
  LogLevel,
  LogCategory,
  ActiveAnalysisState,
  ActiveAnalysisInput,
} from "../types";
import i18n from "../i18n";
import { messageForErrorCode } from "../i18n/errorCodes";
import { APP_LOG_KIND } from "../api/appLogClient";
import { getOsTimeMs } from "../utils/time";

export type { LogLevel, LogCategory, AppLogEntry, AppLogInput, ActiveAnalysisState, ActiveAnalysisInput };

export const MAX_LOG_ENTRIES = 5000;
export const REPEATED_ERROR_LOG_WINDOW_MS = 5 * 60 * 1000;
export const NON_FATAL_WARN_WINDOW_MS = 30_000;
const LOG_DEDUP_WINDOW_MS = 5_000;

export function makeLogId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const VALID_LOG_LEVELS: readonly LogLevel[] = [
  "info",
  "success",
  "warning",
  "error",
];
const VALID_LOG_CATEGORIES: readonly LogCategory[] = [
  "analysis",
  "collector",
  "source",
  "system",
  "frontend",
];

const DEFAULT_LOG_KIND = "event";

function isLogLevel(value: string): value is LogLevel {
  return (VALID_LOG_LEVELS as readonly string[]).includes(value);
}
function isLogCategory(value: string): value is LogCategory {
  return (VALID_LOG_CATEGORIES as readonly string[]).includes(value);
}

export function toAppLogEntry(entry: AppLogEntryPayload): AppLogEntry {
  if (!entry) {
    return {
      id: makeLogId(),
      time: new Date().toISOString(),
      level: "info",
      category: "system",
      kind: DEFAULT_LOG_KIND,
      message: "",
      details: undefined,
    };
  }
  const level = entry.level ?? "";
  const category = entry.category ?? "";
  const kind =
    typeof entry.kind === "string" && entry.kind.trim()
      ? entry.kind
      : DEFAULT_LOG_KIND;
  return {
    id: entry.id ?? makeLogId(),
    time: entry.time ?? new Date().toISOString(),
    level: isLogLevel(level) ? level : "info",
    category: isLogCategory(category) ? category : "system",
    kind,
    message: entry.message ?? "",
    details: entry.details ?? undefined,
  };
}

function compareLogEntries(a: AppLogEntry, b: AppLogEntry): number {
  const timeDelta = getOsTimeMs(b.time) - getOsTimeMs(a.time);
  if (timeDelta !== 0) {
    return timeDelta;
  }
  return b.id.localeCompare(a.id);
}

export function mergeLogs(
  existing: AppLogEntry[],
  incoming: AppLogEntry[],
): AppLogEntry[] {
  const mergedById = new Map<string, AppLogEntry>();
  for (const entry of existing) {
    mergedById.set(entry.id, entry);
  }
  for (const entry of incoming) {
    mergedById.set(entry.id, entry);
  }

  const deduped: AppLogEntry[] = [];
  const seenBySignature = new Map<string, AppLogEntry[]>();

  for (const entry of Array.from(mergedById.values()).sort(compareLogEntries)) {
    const signature = `${entry.level}\n${entry.category}\n${entry.message}\n${entry.details ?? ""}`;
    const similarEntries = seenBySignature.get(signature) ?? [];
    const entryTime = getOsTimeMs(entry.time);
    const isDuplicate = similarEntries.some((candidate) => {
      const candidateTime = getOsTimeMs(candidate.time);
      if (Number.isNaN(entryTime) || Number.isNaN(candidateTime)) {
        return false;
      }
      return Math.abs(candidateTime - entryTime) <= LOG_DEDUP_WINDOW_MS;
    });
    if (isDuplicate) {
      continue;
    }
    deduped.push(entry);
    similarEntries.push(entry);
    seenBySignature.set(signature, similarEntries);
  }

  return deduped.slice(0, MAX_LOG_ENTRIES);
}

export function normalizeAiStatus(value: string): AiEngineStatus {
  if (!value || typeof value !== "string") return "unknown";
  if (value === "available" || value === "unavailable" || value === "unknown") {
    return value;
  }
  return "unknown";
}

export function toActiveAnalysisState(
  source: ActiveAnalysisInput,
  previous?: ActiveAnalysisState | null,
): ActiveAnalysisState {
  if (!source) {
    return {
      taskId: "",
      taskName: "",
      batchId: "",
      messageCount: 0,
      estimatedTokens: 0,
      llmProvider: "",
      llmModel: "",
      startedAt: new Date().toISOString(),
    };
  }
  return {
    taskId: source.taskId ?? "",
    taskName: source.taskName ?? "",
    batchId: source.batchId ?? "",
    messageCount: source.messageCount ?? 0,
    estimatedTokens: source.estimatedTokens ?? 0,
    llmProvider: source.llmProvider ?? "",
    llmModel: source.llmModel ?? "",
    startedAt:
      previous?.batchId === source.batchId && previous?.startedAt
        ? previous.startedAt
        : new Date().toISOString(),
  };
}

function isPythonHttpExceptionDump(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{3}:\s*\{/.test(value) || value.includes("{'error_code'");
}

function localizeAiHealthReason(
  errorCode: string | null | undefined,
  reason: string | null | undefined,
): string | null {
  const fromCode = messageForErrorCode(errorCode);
  if (fromCode) return fromCode;
  const fromReason = messageForErrorCode(reason);
  if (fromReason) return fromReason;
  if (!reason || isPythonHttpExceptionDump(reason)) return null;
  return reason;
}

export function aiHealthPayload(
  health: AiEngineHealthStatus,
): Record<string, unknown> | undefined {
  if (!health) return undefined;
  const errorCode =
    (typeof health.errorCode === "string" && health.errorCode) ||
    (messageForErrorCode(health.reason) ? health.reason : null) ||
    null;
  const reason = localizeAiHealthReason(health.errorCode, health.reason);
  if (!reason && !health.provider && !errorCode) return undefined;
  return {
    errorCode,
    reason: reason ?? null,
    provider: health.provider ?? null,
  };
}

export function buildAiHealthStatusLog(
  status: AiEngineStatus,
  health: AiEngineHealthStatus,
): AppLogInput {
  const safeHealth = health ?? ({} as AiEngineHealthStatus);
  const messageKey =
    status === "available"
      ? "logs:templates.runtimeAiConnected"
      : status === "unavailable"
        ? "logs:templates.runtimeAiUnavailable"
        : "logs:templates.runtimeAiUnknown";
  return {
    level:
      status === "available"
        ? "success"
        : status === "unavailable"
          ? "error"
          : "info",
    category: "collector",
    kind: APP_LOG_KIND.RUNTIME_AI_STATUS,
    message:
      status === "available"
        ? String(i18n.t("common:runtime.aiConnected"))
        : status === "unavailable"
          ? String(i18n.t("common:runtime.aiUnavailable"))
          : String(i18n.t("common:runtime.aiUnknown")),
    messageKey,
    source: "frontend.runtime.ai_status",
    payload: aiHealthPayload(safeHealth),
  };
}

