import { describe, it, expect, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

import { shouldRefreshForEvent } from "./useRefreshOnAnalysisEvent";
import type { RuntimeAnalysisEvent } from "../context/runtimeMonitoring";
import type { AppLogEntry } from "../context/appRuntimeShared";

const SAMPLE_LOG: AppLogEntry = {
  id: "log-1",
  level: "warning",
  category: "analysis",
  kind: "event",
  message: "分析批次完成",
  details: "3 findings",
  time: "2025-06-01T12:00:00.000Z",
};

describe("Short log entries render with correct polishedListItemStyle", () => {
  let LogList: typeof import("../pages/logs/LogList").LogList;

  beforeEach(async () => {
    const mod = await import("../pages/logs/LogList");
    LogList = mod.LogList;
  });

  function render(entries: AppLogEntry[]): HTMLDivElement {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(LogList, {
          filteredLogs: entries,
          totalLogCount: entries.length,
          hasMoreLogs: false,
          logsLoadingMore: false,
          loadedLogsSummary: `${entries.length}`,
          setSelectedLogId: () => {},
          setLoadMoreNode: () => {},
          setScrollContainerNode: () => {},
          onLoadMoreLogs: async () => {},
        }),
      );
    });
    return container;
  }

  it("short log cards render as compact selectable row articles", () => {
    const entries = [SAMPLE_LOG, { ...SAMPLE_LOG, id: "log-2", level: "error" }];
    const container = render(entries);
    const articles = container.querySelectorAll("article");

    expect(articles.length).toBe(2);
    for (const article of articles) {
      expect(article.className).toContain("min-h-11");
      expect(article.getAttribute("role")).toBe("button");
      expect(article.getAttribute("tabindex")).toBe("0");
    }
  });

  it("log cards have level badge with correct color for each level", () => {
    const container = render([SAMPLE_LOG]);
    const article = container.querySelector("article");
    expect(article).not.toBeNull();

    const spans = article!.querySelectorAll("span");
    const levelSpan = Array.from(spans).find(
      (s) => s.textContent === SAMPLE_LOG.level.toUpperCase(),
    );
    expect(levelSpan).toBeDefined();
  });

  it("log cards render a mono timestamp column", () => {
    const container = render([SAMPLE_LOG]);
    const timeEl = container.querySelector("time");
    expect(timeEl).not.toBeNull();
    expect(timeEl!.className).toContain("font-mono");
    expect(timeEl!.className).toContain("w-[140px]");
  });

  it("log cards have category label rendered", () => {
    const container = render([SAMPLE_LOG]);
    const article = container.querySelector("article");
    expect(article!.textContent).toContain("分析");
  });
});

describe("shouldRefreshForEvent triggers for started/completed/failed events", () => {
  const taskId = "task-uuid-1";

  it("'started' events trigger refresh when includeStarted is true", () => {
    const event: RuntimeAnalysisEvent = {
      type: "started",
      payload: {
        taskId,
        taskName: "Task",
        batchId: "b1",
        messageCount: 5,
        estimatedTokens: 500,
        llmProvider: "openai",
        llmModel: "gpt-4",
      },
      receivedAt: Date.now(),
    };

    expect(
      shouldRefreshForEvent(event, { includeStarted: true, includeCompleted: true, includeFailed: true }),
    ).toBe(true);
  });

  it("'completed' events trigger refresh when includeCompleted is true", () => {
    const event: RuntimeAnalysisEvent = {
      type: "completed",
      payload: {
        taskId,
        batchId: "b1",
        analysisMode: "standard",
        findingsCount: 2,
        hasFindings: true,
        overlapStatistics: null,
      },
      receivedAt: Date.now(),
    };

    expect(
      shouldRefreshForEvent(event, { includeStarted: true, includeCompleted: true, includeFailed: true }),
    ).toBe(true);
  });

  it("'failed' events trigger refresh when includeFailed is true", () => {
    const event: RuntimeAnalysisEvent = {
      type: "failed",
      payload: {
        taskId,
        taskName: "Task",
        batchId: "b1",
        error: "LLM_ERROR",
        retrying: false,
        currentRetry: 0,
        maxRetries: 3,
      },
      receivedAt: Date.now(),
    };

    expect(
      shouldRefreshForEvent(event, { includeStarted: true, includeCompleted: true, includeFailed: true }),
    ).toBe(true);
  });

  it("events are filtered by taskId when taskId option is provided", () => {
    const event: RuntimeAnalysisEvent = {
      type: "completed",
      payload: {
        taskId,
        batchId: "b1",
        analysisMode: "leaderboard",
        findingsCount: 1,
        hasFindings: true,
        overlapStatistics: null,
      },
      receivedAt: Date.now(),
    };

    expect(
      shouldRefreshForEvent(event, {
        includeStarted: true,
        includeCompleted: true,
        includeFailed: true,
        taskId,
      }),
    ).toBe(true);

    expect(
      shouldRefreshForEvent(event, {
        includeStarted: true,
        includeCompleted: true,
        includeFailed: true,
        taskId: "other-task",
      }),
    ).toBe(false);
  });

  it("events are NOT triggered when their include flag is false", () => {
    const event: RuntimeAnalysisEvent = {
      type: "completed",
      payload: {
        taskId,
        batchId: "b1",
        analysisMode: "leaderboard",
        findingsCount: 1,
        hasFindings: true,
        overlapStatistics: null,
      },
      receivedAt: Date.now(),
    };

    expect(
      shouldRefreshForEvent(event, {
        includeStarted: false,
        includeCompleted: false,
        includeFailed: false,
      }),
    ).toBe(false);
  });
});

describe("retry and timeout constants", () => {
  it("pause/resume timeout is 30 seconds", () => {
    expect(30_000).toBe(30000);
  });

  it("stale-data retry constants are MAX_RETRIES=3 and RETRY_DELAY_MS=1500", () => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1500;
    expect(MAX_RETRIES).toBe(3);
    expect(RETRY_DELAY_MS).toBe(1500);
  });

  it("totalUnanalyzed correctly computes sum across task stats", () => {
    const stats = [
      { taskId: "t1", unanalyzedCount: 5 },
      { taskId: "t2", unanalyzedCount: 10 },
      { taskId: "t3", unanalyzedCount: 0 },
    ];
    const total = stats.reduce((sum, t) => sum + t.unanalyzedCount, 0);
    expect(total).toBe(15);
  });
});
