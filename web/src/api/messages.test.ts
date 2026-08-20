/**
 * Unit tests for src/api/messages.ts
 * Covers success and error paths for all public API functions.
 *
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "./client";
import {
  queryMessagesPage,
  fetchMessage,
  fetchMessageMediaBlob,
} from "./messages";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    getBlob: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getToken: vi.fn(),
  },
  resolveBaseUrl: () => "http://localhost:18820",
}));

describe("messages API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── queryMessagesPage ─────────────────────────────────────────────

  describe("queryMessagesPage", () => {
    it("fetches first page without cursor", async () => {
      const page = { messages: [], nextCursor: null, totalCount: 0 };
      vi.mocked(apiClient.get).mockResolvedValue(page);

      const result = await queryMessagesPage({
        filters: {
          sourceIds: ["acc-1"],
          channelIds: ["telegram:10001", "rss:https://example.com/feed"],
        },
        limit: 20,
      });

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/messages/page", {
        sourceIds: "acc-1",
        channelIds: "telegram:10001,rss:https://example.com/feed",
        limit: "20",
      });
      expect(result).toEqual(page);
    });

    it("passes cursor parameters when provided", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ messages: [], nextCursor: null });

      await queryMessagesPage({
        filters: {},
        cursor: { timestamp: "2024-01-01T00:00:00Z", id: "msg-100" },
        limit: 50,
        includeTotal: false,
      });

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/messages/page", {
        limit: "50",
        includeTotal: "false",
        cursorTime: "2024-01-01T00:00:00Z",
        cursorId: "msg-100",
      });
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Server error"));

      await expect(
        queryMessagesPage({ filters: {}, limit: 20 }),
      ).rejects.toThrow("Server error");
    });
  });

  describe("fetchMessage", () => {
    it("gets a message by id", async () => {
      const message = { id: "msg-1", content: "hello" };
      vi.mocked(apiClient.get).mockResolvedValue(message);
      await expect(fetchMessage("msg-1")).resolves.toEqual(message);
      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/messages/msg-1");
    });
  });

  // ─── fetchMessageMediaBlob ─────────────────────────────────────────

  describe("fetchMessageMediaBlob", () => {
    it("routes through apiClient.getBlob with signal and no timeout", async () => {
      const blob = new Blob(["x"], { type: "image/jpeg" });
      vi.mocked(apiClient.getBlob).mockResolvedValue(blob);
      const controller = new AbortController();

      const result = await fetchMessageMediaBlob("msg-1", controller.signal);

      expect(apiClient.getBlob).toHaveBeenCalledWith("/api/v1/messages/msg-1/media", {
        signal: controller.signal,
        timeoutMs: 0,
      });
      expect(result).toBe(blob);
    });

    it("propagates errors from apiClient", async () => {
      vi.mocked(apiClient.getBlob).mockRejectedValue(new Error("HTTP 404"));

      await expect(fetchMessageMediaBlob("missing")).rejects.toThrow("HTTP 404");
    });
  });
});
