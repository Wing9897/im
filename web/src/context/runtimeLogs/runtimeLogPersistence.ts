import { queryAppLogsPage } from "../../api/logs";
import i18n from "../../i18n";
import type { AppLogCursorPayload, AppLogPagePayload } from "../../types";
import { withRetry } from "../../utils/retry";
import type { AppLogEntry } from "../appRuntimeShared";
import { RUNTIME_LOG_CACHE_STORAGE_KEY } from "./runtimeLogsPersistedKeys";

const LOG_PAGE_SIZE = 80;
const LOG_LOAD_TIMEOUT_MS = 8_000;
const LOG_LOAD_RETRY_DELAYS_MS = [1_250];
const LOG_CACHE_STORAGE_KEY = RUNTIME_LOG_CACHE_STORAGE_KEY;
const MAX_CACHED_LOG_ENTRIES = 120;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function isRetryableLogLoadError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("逾時") ||
    message.includes("逾时") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("database is locked") ||
    message.includes("busy")
  );
}

function isLogEntry(value: unknown): value is AppLogEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<AppLogEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.time === "string" &&
    typeof entry.level === "string" &&
    typeof entry.category === "string" &&
    typeof entry.message === "string" &&
    (entry.details === undefined || typeof entry.details === "string")
  );
}

export function readCachedStoredLogs(): AppLogEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOG_CACHE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(LOG_CACHE_STORAGE_KEY);
      return [];
    }
    return parsed.filter(isLogEntry).slice(0, MAX_CACHED_LOG_ENTRIES);
  } catch {
    window.localStorage.removeItem(LOG_CACHE_STORAGE_KEY);
    return [];
  }
}

export function writeCachedStoredLogs(logs: AppLogEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LOG_CACHE_STORAGE_KEY,
      JSON.stringify(logs.slice(0, MAX_CACHED_LOG_ENTRIES)),
    );
  } catch {
    // Ignore cache write failures and keep runtime log flow working.
  }
}

export function toLogCursor(
  entry: { id: string; time: string } | null,
): AppLogCursorPayload | null {
  if (!entry) {
    return null;
  }
  return {
    time: entry.time,
    id: entry.id,
  };
}

export async function loadStoredLogPageWithRetry(
  cursor: AppLogCursorPayload | null,
): Promise<AppLogPagePayload> {
  return withRetry(
    () =>
      withTimeout(
        queryAppLogsPage({
          cursor,
          limit: LOG_PAGE_SIZE,
        }),
        LOG_LOAD_TIMEOUT_MS,
        String(i18n.t("logs:section.loadTimeout")),
      ),
    {
      delays: LOG_LOAD_RETRY_DELAYS_MS,
      shouldRetry: (error) => isRetryableLogLoadError(error),
      fallbackErrorMessage: "unknown log load error",
    },
  );
}
