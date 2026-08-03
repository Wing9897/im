import { describe, expect, it, vi } from "vitest";

import {
  mergeLogs,
  toActiveAnalysisState,
  MAX_LOG_ENTRIES,
  type AppLogEntry,
} from "./appRuntimeShared";

describe("appRuntimeShared", () => {
  it("preserves startedAt when updating the same active batch", () => {
    const previous = {
      batchId: "batch-1",
      messageCount: 3,
      startedAt: "2026-04-15T03:00:00.000Z",
    };

    const next = toActiveAnalysisState(
      {
        batchId: "batch-1",
        messageCount: 4,
      },
      previous,
    );

    expect(next.startedAt).toBe(previous.startedAt);
    expect(next.messageCount).toBe(4);
  });

  it("assigns a fresh startedAt when the batch changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T03:14:08.000Z"));

    const next = toActiveAnalysisState({
      batchId: "batch-2",
      messageCount: 2,
    });

    expect(next.startedAt).toBe("2026-04-15T03:14:08.000Z");
    vi.useRealTimers();
  });

  it("deduplicates logs by id and keeps newest entries first", () => {
    const merged = mergeLogs(
      [
        {
          id: "1",
          time: "2026-04-15T03:10:00.000Z",
          level: "info",
          category: "analysis",
          message: "old",
        },
      ],
      [
        {
          id: "1",
          time: "2026-04-15T03:11:00.000Z",
          level: "success",
          category: "analysis",
          message: "updated",
        },
        {
          id: "2",
          time: "2026-04-15T03:12:00.000Z",
          level: "warning",
          category: "collector",
          message: "newest",
        },
      ],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["2", "1"]);
    expect(merged[1].message).toBe("updated");
  });

  it("deduplicates near-identical log entries from local and persisted sources", () => {
    const merged = mergeLogs(
      [
        {
          id: "local-1",
          time: "2026-04-15T03:10:00.000Z",
          level: "success",
          category: "collector",
          message: "收集器已運行",
        },
      ],
      [
        {
          id: "db-1",
          time: "2026-04-15T03:10:02.000Z",
          level: "success",
          category: "collector",
          message: "收集器已運行",
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("db-1");
  });
});


describe("mergeLogs invariants", () => {
  const existing: AppLogEntry[] = [
    {
      id: "entry-0",
      time: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      level: "info",
      category: "analysis",
      message: "msg-0-abc",
    },
    {
      id: "entry-1",
      time: new Date(Date.UTC(2026, 0, 1) + 10_000).toISOString(),
      level: "success",
      category: "collector",
      message: "msg-1-def",
    },
  ];

  const incoming: AppLogEntry[] = [
    {
      id: "entry-1",
      time: new Date(Date.UTC(2026, 0, 1) + 20_000).toISOString(),
      level: "warning",
      category: "collector",
      message: "msg-1-updated",
    },
    {
      id: "entry-2",
      time: new Date(Date.UTC(2026, 0, 1) + 30_000).toISOString(),
      level: "error",
      category: "system",
      message: "msg-2-ghi",
    },
  ];

  it("(a) no duplicate IDs in merged result", () => {
    const result = mergeLogs(existing, incoming);
    const ids = result.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("(b) result is sorted by time descending", () => {
    const result = mergeLogs(existing, incoming);
    for (let i = 1; i < result.length; i++) {
      const prevTime = new Date(result[i - 1].time).getTime();
      const currTime = new Date(result[i].time).getTime();
      expect(prevTime).toBeGreaterThanOrEqual(currTime);
    }
  });

  it("(c) length <= MAX_LOG_ENTRIES", () => {
    const result = mergeLogs(existing, incoming);
    expect(result.length).toBeLessThanOrEqual(MAX_LOG_ENTRIES);
  });

  it("(d) entries with unique signatures are preserved", () => {
    const result = mergeLogs(existing, incoming);
    expect(result.some((r) => r.id === "entry-0")).toBe(true);
    expect(result.some((r) => r.id === "entry-2")).toBe(true);
  });
});
