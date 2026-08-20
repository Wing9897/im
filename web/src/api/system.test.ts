/**
 * Unit tests for src/api/system.ts
 * Covers success and error paths for all public API functions.
 *
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "./client";
import {
  fetchCollectorStatus,
  fetchHealth,
  restartCollector,
  checkAiEngineStatus,
  testAiEngine,
  emergencyAbortAnalysis,
  setAnalysisPaused,
  requestDatabaseReset,
  restartApplication,
  runRetentionCleanup,
} from "./system";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("system API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── fetchHealth ───────────────────────────────────────────────────

  describe("fetchHealth", () => {
    it("fetches public health status", async () => {
      const response = {
        status: "ok",
        version: "1.0.0",
        runtimeReady: true,
        schemaVersion: 1,
        schemaSemver: "1.0.0",
        secretsReady: true,
        bindHost: "0.0.0.0",
      };
      vi.mocked(apiClient.get).mockResolvedValue(response);

      const result = await fetchHealth();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/health");
      expect(result).toEqual(response);
    });
  });

  // ─── fetchCollectorStatus ────────────────────────────────────────────

  describe("fetchCollectorStatus", () => {
    it("fetches collector status and extracts status string", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ status: "running" });

      const result = await fetchCollectorStatus();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/system/collector/status");
      expect(result).toBe("running");
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Unreachable"));

      await expect(fetchCollectorStatus()).rejects.toThrow("Unreachable");
    });
  });

  // ─── restartCollector ──────────────────────────────────────────────

  describe("restartCollector", () => {
    it("posts collector restart and returns message + previousStatus", async () => {
      const response = { message: "Collector restarted", previousStatus: "running" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await restartCollector();

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/system/collector/restart");
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Collector busy"));

      await expect(restartCollector()).rejects.toThrow("Collector busy");
    });
  });

  // ─── checkAiEngineStatus ───────────────────────────────────────────

  describe("checkAiEngineStatus", () => {
    it("fetches AI engine health status", async () => {
      const status = { healthy: true, provider: "openai", latencyMs: 120 };
      vi.mocked(apiClient.get).mockResolvedValue(status);

      const result = await checkAiEngineStatus();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/system/ai-engine/status");
      expect(result).toEqual(status);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Provider unreachable"));

      await expect(checkAiEngineStatus()).rejects.toThrow("Provider unreachable");
    });
  });

  // ─── testAiEngine ──────────────────────────────────────────────────

  describe("testAiEngine", () => {
    it("posts draft settings for a minimal generation probe", async () => {
      const draft = {
        provider: "gemini_compatible" as const,
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-3.1-flash-lite",
        apiKey: "test-key",
      };
      const response = {
        success: true,
        provider: "gemini",
        model: "gemini-3.1-flash-lite",
        latencyMs: 420,
        promptTokens: 6,
        completionTokens: 1,
        preview: "ok",
        error: null,
      };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await testAiEngine(draft);

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/system/ai-engine/test", draft);
      expect(result).toEqual(response);
    });
  });

  // ─── emergencyAbortAnalysis ────────────────────────────────────────

  describe("emergencyAbortAnalysis", () => {
    it("posts abort command and returns result", async () => {
      const response = { analysisPaused: true, abortedBatchIds: ["b-1", "b-2"] };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await emergencyAbortAnalysis();

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/system/analysis/abort");
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Already paused"));

      await expect(emergencyAbortAnalysis()).rejects.toThrow("Already paused");
    });
  });

  // ─── setAnalysisPaused ─────────────────────────────────────────────

  describe("setAnalysisPaused", () => {
    it("posts pause state to the analysis pause endpoint", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ analysisPaused: true });

      const result = await setAnalysisPaused(true);

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/system/analysis/pause", {
        paused: true,
      });
      expect(result).toEqual({ analysisPaused: true });
    });
  });

  // ─── requestDatabaseReset ──────────────────────────────────────────

  describe("requestDatabaseReset", () => {
    it("posts database reset and returns message", async () => {
      const response = { message: "Database reset complete" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await requestDatabaseReset();

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/system/reset/database");
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Reset in progress"));

      await expect(requestDatabaseReset()).rejects.toThrow("Reset in progress");
    });
  });

  // ─── runRetentionCleanup ───────────────────────────────────────────

  describe("runRetentionCleanup", () => {
    it("posts retention run and returns delete summary", async () => {
      const response = {
        message: "Retention cleanup complete (1 rows deleted)",
        deleted: {
          messages: 0,
          analysis: 0,
          leaderboard: 0,
          action_trigger_history: 0,
          app_logs: 1,
          user_events: 0,
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await runRetentionCleanup();

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/system/retention/run");
      expect(result).toEqual(response);
    });
  });

  // ─── restartApplication ────────────────────────────────────────────

  describe("restartApplication", () => {
    it("posts restart command and returns message", async () => {
      const response = { message: "Application restarting" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await restartApplication();

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/system/restart");
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Permission denied"));

      await expect(restartApplication()).rejects.toThrow("Permission denied");
    });
  });
});
