/**
 * Unit tests for src/api/actions.ts
 * Covers success and error paths for all public API functions.
 *
 * Validates: Requirements 7.1, 7.3
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "./client";
import {
  createAction,
  listActions,
  updateAction,
  deleteAction,
  toggleAction,
  testAction,
} from "./actions";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("actions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createAction ──────────────────────────────────────────────────

  describe("createAction", () => {
    it("posts action config and returns created action", async () => {
      const params = {
        name: "Alert",
        actionType: "webhook",
        configuration: "{}",
        triggerConditions: null,
      };
      const response = { id: "act-1", ...params };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await createAction(params);

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/actions", params);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Validation failed"));

      await expect(
        createAction({ name: "", actionType: "", configuration: "", triggerConditions: null }),
      ).rejects.toThrow("Validation failed");
    });
  });

  // ─── listActions ───────────────────────────────────────────────────

  describe("listActions", () => {
    it("fetches all actions", async () => {
      const actions = [{ id: "act-1", name: "Alert" }];
      vi.mocked(apiClient.get).mockResolvedValue(actions);

      const result = await listActions();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/actions");
      expect(result).toEqual(actions);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Server error"));

      await expect(listActions()).rejects.toThrow("Server error");
    });
  });

  // ─── updateAction ──────────────────────────────────────────────────

  describe("updateAction", () => {
    it("puts updated action config", async () => {
      const params = {
        name: "Updated",
        actionType: "webhook",
        configuration: "{}",
        triggerConditions: "x > 5",
      };
      const response = { id: "act-1", ...params };
      vi.mocked(apiClient.put).mockResolvedValue(response);

      const result = await updateAction("act-1", params);

      expect(apiClient.put).toHaveBeenCalledWith("/api/v1/actions/act-1", params);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error("Not found"));

      await expect(
        updateAction("bad", { name: "", actionType: "", configuration: "", triggerConditions: null }),
      ).rejects.toThrow("Not found");
    });
  });

  // ─── deleteAction ──────────────────────────────────────────────────

  describe("deleteAction", () => {
    it("deletes action by ID", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await deleteAction("act-1");

      expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/actions/act-1");
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error("Forbidden"));

      await expect(deleteAction("act-1")).rejects.toThrow("Forbidden");
    });
  });

  // ─── toggleAction ──────────────────────────────────────────────────

  describe("toggleAction", () => {
    it("patches toggle and returns new state", async () => {
      const response = { id: "act-1", isEnabled: true };
      vi.mocked(apiClient.patch).mockResolvedValue(response);

      const result = await toggleAction("act-1");

      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/actions/act-1/toggle");
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error("Conflict"));

      await expect(toggleAction("act-1")).rejects.toThrow("Conflict");
    });
  });

  // ─── testAction ────────────────────────────────────────────────────

  describe("testAction", () => {
    it("posts test execution and returns result", async () => {
      const response = { success: true, output: "OK" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await testAction("act-1");

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/actions/act-1/test");
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Execution failed"));

      await expect(testAction("act-1")).rejects.toThrow("Execution failed");
    });
  });
});
