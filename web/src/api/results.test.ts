/**
 * Unit tests for src/api/results.ts
 * Covers success and error paths for all public API functions.
 *
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "./client";
import {
  fetchTrendingTopics,
  fetchEvents,
  fetchTopicMessages,
  fetchTimelineEvents,
  fetchQueueStatus,
  fetchTaskAnalysisStats,
} from "./results";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("results API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── fetchTrendingTopics ───────────────────────────────────────────

  describe("fetchTrendingTopics", () => {
    it("fetches trending topics without filter", async () => {
      const topics = [{ id: "t-1", name: "AI" }];
      vi.mocked(apiClient.get).mockResolvedValue(topics);

      const result = await fetchTrendingTopics();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/results/trending", undefined);
      expect(result).toEqual(topics);
    });

    it("passes task_id filter", async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await fetchTrendingTopics("task-1");

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/results/trending", { taskId: "task-1" });
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Server error"));

      await expect(fetchTrendingTopics()).rejects.toThrow("Server error");
    });
  });

  // ─── fetchEvents ───────────────────────────────────────────────────

  describe("fetchEvents", () => {
    it("fetches unified events with all params", async () => {
      const page = { items: [], totalCount: 0, hasMore: false };
      vi.mocked(apiClient.get).mockResolvedValue(page);

      const result = await fetchEvents({
        taskId: "task-1",
        search: "keyword",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        sort: "event_time",
        limit: 10,
        offset: 0,
        hasTime: true,
        hasCoords: false,
      });

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/results/events", {
        taskId: "task-1",
        search: "keyword",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        sort: "event_time",
        limit: "10",
        offset: "0",
        hasTime: "1",
        hasCoords: "0",
      });
      expect(result).toEqual(page);
    });

    it("sends repeated task_ids when taskIds is provided", async () => {
      const page = { items: [], totalCount: 0, hasMore: false };
      vi.mocked(apiClient.get).mockResolvedValue(page);

      await fetchEvents({ taskIds: ["a", "b"], limit: 5 });

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/results/events", {
        taskIds: ["a", "b"],
        limit: "5",
      });
    });

    it("short-circuits empty taskIds without a network call", async () => {
      const result = await fetchEvents({ taskIds: [] });
      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result).toEqual({
        items: [],
        totalCount: 0,
        hasMore: false,
        sort: "event_time",
      });
    });
  });

  // ─── fetchTopicMessages ────────────────────────────────────────────

  describe("fetchTopicMessages", () => {
    it("fetches messages for a topic", async () => {
      const messages = [{ id: "m-1", content: "Hello" }];
      vi.mocked(apiClient.get).mockResolvedValue(messages);

      const result = await fetchTopicMessages("topic-1");

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/results/trending/topic-1/messages");
      expect(result).toEqual(messages);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Not found"));

      await expect(fetchTopicMessages("bad")).rejects.toThrow("Not found");
    });
  });

  // ─── fetchTimelineEvents ───────────────────────────────────────────

  describe("fetchTimelineEvents", () => {
    const window = {
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-02-01T00:00:00Z",
    };

    it("fetches timeline events without filter", async () => {
      const page = {
        items: [
          {
            id: "e-1",
            taskId: null,
            version: 1,
            batchId: "b-1",
            title: "Meeting",
            body: "sync",
            startTime: "2024-01-02T10:00:00Z",
            endTime: null,
            location: null,
            latitude: null,
            longitude: null,
            participants: [],
            sourceMessageId: null,
            sourcePlatform: null,
            sourceChannelName: null,
            sourceMessageTime: null,
            analysisTimeRange: null,
            batchSourceChannelNames: [],
            taskName: null,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
        totalCount: 1,
        hasMore: false,
      };
      vi.mocked(apiClient.get).mockResolvedValue(page);

      const result = await fetchTimelineEvents(window);

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/results/events", {
        startDate: window.startDate,
        endDate: window.endDate,
        hasTime: "1",
        includeInTimeline: "1",
        limit: "200",
        offset: "0",
        sort: "event_time",
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Meeting");
      expect(result[0].body).toBe("sync");
      expect(result[0].startTime).toBe("2024-01-02T10:00:00Z");
    });

    it("passes task_id filter", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ items: [], totalCount: 0, hasMore: false });

      await fetchTimelineEvents({ ...window, taskId: "task-1" });

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/results/events", {
        taskId: "task-1",
        startDate: window.startDate,
        endDate: window.endDate,
        hasTime: "1",
        includeInTimeline: "1",
        limit: "200",
        offset: "0",
        sort: "event_time",
      });
    });

    it("reads every page in the date window and returns sorted timed rows", async () => {
      const makeItem = (id: string, startTime: string) => ({
        id,
        taskId: "task-1",
        version: 1,
        batchId: "batch-1",
        title: id,
        body: "",
        startTime,
        endTime: null,
        location: null,
        latitude: null,
        longitude: null,
        participants: [],
        sourceMessageId: null,
        sourcePlatform: null,
        sourceChannelName: null,
        sourceMessageTime: null,
        analysisTimeRange: null,
        batchSourceChannelNames: [],
        taskName: "Task",
        createdAt: startTime,
        updatedAt: startTime,
      });
      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({
          items: [makeItem("later", "2024-01-03T00:00:00Z")],
          totalCount: 2,
          hasMore: true,
        })
        .mockResolvedValueOnce({
          items: [makeItem("earlier", "2024-01-02T00:00:00Z")],
          totalCount: 2,
          hasMore: false,
        });

      const result = await fetchTimelineEvents(window);

      expect(apiClient.get).toHaveBeenNthCalledWith(2, "/api/v1/results/events", {
        startDate: window.startDate,
        endDate: window.endDate,
        hasTime: "1",
        includeInTimeline: "1",
        limit: "200",
        offset: "1",
        sort: "event_time",
      });
      expect(result.map((item) => item.id)).toEqual(["earlier", "later"]);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Timeout"));

      await expect(fetchTimelineEvents(window)).rejects.toThrow("Timeout");
    });
  });

  // ─── fetchQueueStatus ──────────────────────────────────────────────

  describe("fetchQueueStatus", () => {
    it("fetches queue status", async () => {
      const status = {
        pendingCount: 5,
        processingBatches: [],
        attentionBatches: [],
        analysisPaused: false,
      };
      vi.mocked(apiClient.get).mockResolvedValue(status);

      const result = await fetchQueueStatus();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/results/queue");
      expect(result).toEqual(status);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Offline"));

      await expect(fetchQueueStatus()).rejects.toThrow("Offline");
    });
  });

  // ─── fetchTaskAnalysisStats ────────────────────────────────────────

  describe("fetchTaskAnalysisStats", () => {
    it("fetches stats for a time range", async () => {
      const stats = [
        {
          taskId: "t-1",
          analyzedCount: 10,
          unanalyzedCount: 3,
          queuedMessageCount: 2,
          triggerThreshold: 50,
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValue(stats);

      const result = await fetchTaskAnalysisStats("7d");

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/results/stats", { time_range: "7d" });
      expect(result).toEqual(stats);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Bad request"));

      await expect(fetchTaskAnalysisStats("invalid")).rejects.toThrow("Bad request");
    });
  });
});
