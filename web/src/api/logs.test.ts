/**
 * Unit tests for src/api/logs.ts
 * Covers success and error paths for all public API functions.
 *
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "./client";
import { queryAppLogsPage, clearAppLogs } from "./logs";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("logs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── queryAppLogsPage ──────────────────────────────────────────────

  describe("queryAppLogsPage", () => {
    it("fetches first page without cursor", async () => {
      const page = { entries: [{ id: "log-1" }], nextCursor: null };
      vi.mocked(apiClient.get).mockResolvedValue(page);

      const result = await queryAppLogsPage({ cursor: null, limit: 50 });

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/logs", { limit: "50" });
      expect(result).toEqual(page);
    });

    it("passes cursor parameters when provided", async () => {
      const page = { entries: [], nextCursor: null };
      vi.mocked(apiClient.get).mockResolvedValue(page);

      await queryAppLogsPage({
        cursor: { time: "2024-01-01T00:00:00Z", id: "cursor-id" },
        limit: 25,
      });

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/logs", {
        limit: "25",
        cursor_time: "2024-01-01T00:00:00Z",
        cursor_id: "cursor-id",
      });
    });

    it("passes kind filter params when provided", async () => {
      const page = { entries: [], nextCursor: null };
      vi.mocked(apiClient.get).mockResolvedValue(page);

      await queryAppLogsPage({
        cursor: null,
        limit: 20,
        excludeKind: "analysis.trace",
      });

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/logs", {
        limit: "20",
        excludeKind: "analysis.trace",
      });
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Database error"));

      await expect(queryAppLogsPage({ cursor: null, limit: 50 })).rejects.toThrow("Database error");
    });
  });

  // ─── clearAppLogs ──────────────────────────────────────────────────

  describe("clearAppLogs", () => {
    it("deletes all logs", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await clearAppLogs();

      expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/logs");
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error("Permission denied"));

      await expect(clearAppLogs()).rejects.toThrow("Permission denied");
    });
  });
});
