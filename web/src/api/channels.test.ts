/**
 * Unit tests for src/api/channels.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "./client";
import { listChannelsWithSources, fetchLatestByChannels } from "./channels";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getToken: vi.fn(),
  },
  resolveBaseUrl: () => "http://localhost:18820",
}));

describe("channels API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listChannelsWithSources", () => {
    it("fetches channels with source metadata", async () => {
      const data = [{ id: "ch-1", name: "General", sourceName: "Bot1" }];
      vi.mocked(apiClient.get).mockResolvedValue(data);

      const result = await listChannelsWithSources();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/channels/with-sources");
      expect(result).toEqual(data);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Network error"));

      await expect(listChannelsWithSources()).rejects.toThrow("Network error");
    });
  });

  describe("fetchLatestByChannels", () => {
    it("returns empty object for no channel ids", async () => {
      const result = await fetchLatestByChannels([], 5);
      expect(result).toEqual({});
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("requests latest messages for selected channels", async () => {
      const payload = { "telegram:10001": [{ id: "m1" }] };
      vi.mocked(apiClient.get).mockResolvedValue(payload);

      const result = await fetchLatestByChannels(["telegram:10001", "discord:20002"], 5);

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/channels/latest-messages", {
        channels: "telegram:10001,discord:20002",
        limit: "5",
      });
      expect(result).toEqual(payload);
    });
  });
});
