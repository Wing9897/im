/**
 * Unit tests for src/api/tasks.ts
 * Covers success and error paths for all public API functions.
 *
 * Validates: Requirements 7.1, 7.3
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AnalysisTask } from "../types";
import { apiClient } from "./client";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskActive,
  listTaskTemplatePresets,
  fetchTaskActivitySpans,
  chatTaskAssistant,
} from "./tasks";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("tasks API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── listTasks ─────────────────────────────────────────────────────

  describe("listTasks", () => {
    it("fetches all tasks", async () => {
      const tasks = [{ id: "t-1", name: "Monitor" }];
      vi.mocked(apiClient.get).mockResolvedValue(tasks);

      const result = await listTasks();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/tasks");
      expect(result).toEqual(tasks);
    });

    it("serializes list filters as query strings", async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await listTasks({ topLevelOnly: true, analysisMode: "project" });

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/tasks", {
        top_level_only: "true",
        analysis_mode: "project",
      });
    });

    it("preserves the stamp-5 task response shape (schedule fields are a subresource)", async () => {
      const task: AnalysisTask = {
        id: "t-1",
        name: "Existing analysis task",
        description: null,
        promptTemplate: "Analyze",
        analysisMode: "leaderboard",
        analysisTimeRange: "24h",
        version: 3,
        isActive: true,
        channelIds: [{ platform: "telegram", platformId: "42", id: "telegram:42" }],
        scheduleType: "daily",
        scheduleValue: "09:30",
        includeInTimeline: true,
        parentTaskId: null,
        worksetId: null,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-02T00:00:00Z",
      };
      vi.mocked(apiClient.get).mockResolvedValue([task]);

      const result = await listTasks();

      expect(result).toEqual([task]);
      expect(Object.keys(result[0]).sort()).toEqual([
        "analysisMode",
        "analysisTimeRange",
        "channelIds",
        "createdAt",
        "description",
        "id",
        "includeInTimeline",
        "isActive",
        "name",
        "parentTaskId",
        "promptTemplate",
        "scheduleType",
        "scheduleValue",
        "updatedAt",
        "version",
        "worksetId",
      ].sort());
      expect(result[0]).toMatchObject({
        id: "t-1",
        analysisMode: "leaderboard",
        scheduleType: "daily",
        scheduleValue: "09:30",
        version: 3,
      });
      expect(result[0]).not.toHaveProperty("rrule");
      expect(result[0]).not.toHaveProperty("eventLocation");
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Server error"));

      await expect(listTasks()).rejects.toThrow("Server error");
    });
  });

  // ─── createTask ────────────────────────────────────────────────────

  describe("createTask", () => {
    it("posts task config and returns mutation result", async () => {
      const config = { name: "New Task", prompt: "Analyze" } as any;
      const response = { id: "t-2", status: "created" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await createTask(config);

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/tasks", config);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Validation error"));

      await expect(createTask({} as any)).rejects.toThrow("Validation error");
    });
  });

  // ─── updateTask ────────────────────────────────────────────────────

  describe("updateTask", () => {
    it("puts updated task config", async () => {
      const config = { name: "Updated", prompt: "New prompt" } as any;
      const response = { id: "t-1", status: "updated" };
      vi.mocked(apiClient.put).mockResolvedValue(response);

      const result = await updateTask("t-1", config);

      expect(apiClient.put).toHaveBeenCalledWith("/api/v1/tasks/t-1", config);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error("Not found"));

      await expect(updateTask("bad", {} as any)).rejects.toThrow("Not found");
    });
  });

  // ─── deleteTask ────────────────────────────────────────────────────

  describe("deleteTask", () => {
    it("deletes task by ID", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await deleteTask("t-1");

      expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/tasks/t-1");
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error("Forbidden"));

      await expect(deleteTask("t-1")).rejects.toThrow("Forbidden");
    });
  });

  // ─── toggleTaskActive ──────────────────────────────────────────────

  describe("toggleTaskActive", () => {
    it("patches task active state", async () => {
      const response = { id: "t-1", isActive: false, name: "Task" };
      vi.mocked(apiClient.patch).mockResolvedValue(response);

      const result = await toggleTaskActive("t-1");

      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/tasks/t-1/active");
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error("Conflict"));

      await expect(toggleTaskActive("t-1")).rejects.toThrow("Conflict");
    });
  });

  // ─── listTaskTemplatePresets ───────────────────────────────────────

  describe("listTaskTemplatePresets", () => {
    it("fetches template presets", async () => {
      const presets = [{ id: "p-1", name: "Default" }];
      vi.mocked(apiClient.get).mockResolvedValue(presets);

      const result = await listTaskTemplatePresets();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/tasks/templates");
      expect(result).toEqual(presets);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Offline"));

      await expect(listTaskTemplatePresets()).rejects.toThrow("Offline");
    });
  });

  // ─── fetchTaskActivitySpans ────────────────────────────────────────

  describe("fetchTaskActivitySpans", () => {
    it("fetches activity spans", async () => {
      const spans = [{ taskId: "t-1", start: "2024-01-01", end: "2024-01-02" }];
      vi.mocked(apiClient.get).mockResolvedValue(spans);

      const result = await fetchTaskActivitySpans();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/tasks/activity-spans");
      expect(result).toEqual(spans);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Timeout"));

      await expect(fetchTaskActivitySpans()).rejects.toThrow("Timeout");
    });
  });

  // ─── chatTaskAssistant ─────────────────────────────────────────────

  describe("chatTaskAssistant", () => {
    it("posts chat messages and returns response", async () => {
      const params = {
        messages: [{ role: "user", content: "Help me configure" }],
        currentTask: { name: "Test" },
      };
      const response = { role: "assistant", content: "Sure!" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await chatTaskAssistant(params);

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/tasks/chat-assistant", params);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("AI error"));

      await expect(
        chatTaskAssistant({ messages: [], currentTask: null }),
      ).rejects.toThrow("AI error");
    });
  });
});
