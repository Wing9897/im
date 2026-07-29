/**
 * Unit tests for src/api/config.ts
 * Covers success and error paths for all public API functions.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "./client";
import { fetchSystemSettings, saveSystemSettings } from "./config";
import type { SystemSettingsSnapshot } from "../types";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("config API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── fetchSystemSettings ───────────────────────────────────────────

  describe("fetchSystemSettings", () => {
    it("fetches the settings snapshot", async () => {
      const snapshot = { llmProvider: "openai" } as unknown as SystemSettingsSnapshot;
      vi.mocked(apiClient.get).mockResolvedValue(snapshot);

      const result = await fetchSystemSettings();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/config/settings");
      expect(result).toBe(snapshot);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Unreachable"));

      await expect(fetchSystemSettings()).rejects.toThrow("Unreachable");
    });
  });

  // ─── saveSystemSettings ────────────────────────────────────────────

  describe("saveSystemSettings", () => {
    it("puts the snapshot and returns the persisted copy", async () => {
      const snapshot = { llmProvider: "gemini" } as unknown as SystemSettingsSnapshot;
      vi.mocked(apiClient.put).mockResolvedValue(snapshot);

      const result = await saveSystemSettings(snapshot);

      expect(apiClient.put).toHaveBeenCalledWith("/api/v1/config/settings", snapshot);
      expect(result).toBe(snapshot);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error("Validation failed"));

      await expect(
        saveSystemSettings({} as unknown as SystemSettingsSnapshot),
      ).rejects.toThrow("Validation failed");
    });
  });
});
