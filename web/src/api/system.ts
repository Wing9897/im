/** REST API client functions for system control operations. */

import { apiClient } from "./client";
import { publicFetchJson } from "./publicFetch";
import type { components } from "./generated/schema";
import type { AiEngineHealthStatus, AiEngineTestDraft, AiEngineTestResult } from "../types";

export type HealthStatus = components["schemas"]["HealthResponse"];

/** Public health probe (backend version + runtime readiness). */
export function fetchHealth(): Promise<HealthStatus> {
  return apiClient.get<HealthStatus>("/api/v1/health");
}

/** Fetches the current collector process status. */
export async function fetchCollectorStatus(): Promise<string> {
  const response = await apiClient.get<{ status: string }>("/api/v1/system/collector/status");
  return response.status;
}

/** Restarts the message collector (adapters reconnect; no data wipe). */
export function restartCollector(): Promise<{ message: string; previousStatus: string }> {
  return apiClient.post<{ message: string; previousStatus: string }>(
    "/api/v1/system/collector/restart",
  );
}

/** Checks the AI engine health status (LLM provider connectivity). */
export function checkAiEngineStatus(): Promise<AiEngineHealthStatus> {
  return apiClient.get<AiEngineHealthStatus>("/api/v1/system/ai-engine/status");
}

/** Runs a minimal-token generation probe (about one completion token). */
export function testAiEngine(draft: AiEngineTestDraft): Promise<AiEngineTestResult> {
  return apiClient.post<AiEngineTestResult>("/api/v1/system/ai-engine/test", draft);
}

/** Immediately aborts all in-progress analysis and pauses the analysis engine. */
export function emergencyAbortAnalysis(): Promise<{ analysisPaused: boolean; abortedBatchIds: string[] }> {
  return apiClient.post<{ analysisPaused: boolean; abortedBatchIds: string[] }>("/api/v1/system/analysis/abort");
}

/** Pauses or resumes the analysis scheduler. */
export function setAnalysisPaused(paused: boolean): Promise<{ analysisPaused: boolean }> {
  return apiClient.post<{ analysisPaused: boolean }>("/api/v1/system/analysis/pause", { paused });
}

/** Full reset: wipe DB (admin/sessions), clear Telegram tokens, restart collector. */
export function requestDatabaseReset(): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>("/api/v1/system/reset/database");
}

export interface RotateSecretsBody {
  username: string;
  password: string;
}

export interface RotateSecretsResult {
  message: string;
  secretsReady: boolean;
  scrubbed: {
    system_config: number;
    accounts: number;
    stale_connected?: number;
    actions: number;
  };
}

/**
 * Admin-password rotate: new secret.key + scrub enc:v1 fields; keep business data.
 * Public (no Bearer) — only succeeds while secretsReady is false.
 */
export function rotateSecretsPublic(body: RotateSecretsBody): Promise<RotateSecretsResult> {
  return publicFetchJson<RotateSecretsResult>("/api/v1/system/rotate-secrets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

type RetentionRunResult = {
  message: string;
  deleted: {
    messages: number;
    analysis: number;
    leaderboard: number;
    action_trigger_history: number;
    app_logs: number;
    user_events: number;
    timeline_dismissals: number;
    device_access_tokens: number;
    device_sessions: number;
  };
};

/** Run one retention cleanup pass immediately. */
export function runRetentionCleanup(): Promise<RetentionRunResult> {
  return apiClient.post<RetentionRunResult>("/api/v1/system/retention/run");
}

/** Restarts the entire application process. */
export function restartApplication(): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>("/api/v1/system/restart");
}
