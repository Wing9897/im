/**
 * Unit tests for src/api/worksets.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "./client";
import {
  listWorksets,
  createWorkset,
  getWorkset,
  renameWorkset,
  deleteWorkset,
} from "./worksets";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("worksets API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listWorksets", () => {
    it("fetches all worksets", async () => {
      const worksets = [{ id: "w-1", name: "Ops" }];
      vi.mocked(apiClient.get).mockResolvedValue(worksets);

      const result = await listWorksets();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/worksets");
      expect(result).toEqual(worksets);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Server error"));

      await expect(listWorksets()).rejects.toThrow("Server error");
    });
  });

  describe("createWorkset", () => {
    it("posts a new workset name", async () => {
      const response = { id: "w-2", name: "New" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await createWorkset("New");

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/worksets", { name: "New" });
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Validation error"));

      await expect(createWorkset("")).rejects.toThrow("Validation error");
    });
  });

  describe("getWorkset", () => {
    it("fetches a workset by id (url-encoded)", async () => {
      const response = { id: "w-1", name: "Ops" };
      vi.mocked(apiClient.get).mockResolvedValue(response);

      const result = await getWorkset("w 1");

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/worksets/w%201");
      expect(result).toEqual(response);
    });
  });

  describe("renameWorkset", () => {
    it("puts the new name", async () => {
      const response = { id: "w-1", name: "Renamed" };
      vi.mocked(apiClient.put).mockResolvedValue(response);

      const result = await renameWorkset("w-1", "Renamed");

      expect(apiClient.put).toHaveBeenCalledWith("/api/v1/worksets/w-1", { name: "Renamed" });
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error("Not found"));

      await expect(renameWorkset("bad", "x")).rejects.toThrow("Not found");
    });
  });

  describe("deleteWorkset", () => {
    it("deletes workset by id", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ ok: true });

      const result = await deleteWorkset("w-1");

      expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/worksets/w-1");
      expect(result).toEqual({ ok: true });
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error("Forbidden"));

      await expect(deleteWorkset("w-1")).rejects.toThrow("Forbidden");
    });
  });
});
