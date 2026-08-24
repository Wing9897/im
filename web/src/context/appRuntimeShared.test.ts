import { describe, expect, it, vi } from "vitest";

import {
  mergeLogs,
  toActiveAnalysisState,
  toAppLogEntry,
  MAX_LOG_ENTRIES,
  type AppLogEntry,
} from "./appRuntimeShared";

function log(partial: Partial<AppLogEntry> & Pick<AppLogEntry, "id" | "message">): AppLogEntry {
  return {
    time: "2026-04-15T03:10:00.000Z",
    level: "info",
    category: "analysis",
    kind: "event",
    ...partial,
  };
}

function analysisInput(
  partial: Partial<Parameters<typeof toActiveAnalysisState>[0]> &
    Pick<Parameters<typeof toActiveAnalysisState>[0], "batchId" | "messageCount">,
): Parameters<typeof toActiveAnalysisState>[0] {
  return {
    taskId: "",
    taskName: "",
    estimatedTokens: 0,
    llmProvider: "",
    llmModel: "",
    ...partial,
  };
}

describe("appRuntimeShared", () => {
  it("preserves startedAt when updating the same active batch", () => {
    const previous = analysisInput({
      batchId: "batch-1",
      messageCount: 3,
    });
    const previousState = { ...previous, startedAt: "2026-04-15T03:00:00.000Z" };

    const next = toActiveAnalysisState(
      analysisInput({
        batchId: "batch-1",
        messageCount: 4,
      }),
      previousState,
    );

    expect(next.startedAt).toBe(previousState.startedAt);
    expect(next.messageCount).toBe(4);
  });

  it("copies llmProvider from the SSE start payload", () => {
    const next = toActiveAnalysisState(
      analysisInput({
        batchId: "batch-3",
        messageCount: 1,
        taskId: "t1",
        taskName: "Watch",
        llmProvider: "ollama",
        llmModel: "qwen3",
        estimatedTokens: 120,
      }),
    );
    expect(next.llmProvider).toBe("ollama");
    expect(next.llmModel).toBe("qwen3");
    expect(next.taskId).toBe("t1");
  });

  it("assigns a fresh startedAt when the batch changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T03:14:08.000Z"));

    const next = toActiveAnalysisState(
      analysisInput({
        batchId: "batch-2",
        messageCount: 2,
      }),
    );

    expect(next.startedAt).toBe("2026-04-15T03:14:08.000Z");
    vi.useRealTimers();
  });

  it("deduplicates logs by id and keeps newest entries first", () => {
    const merged = mergeLogs(
      [
        log({
          id: "1",
          time: "2026-04-15T03:10:00.000Z",
          message: "old",
        }),
      ],
      [
        log({
          id: "1",
          time: "2026-04-15T03:11:00.000Z",
          level: "success",
          message: "updated",
        }),
        log({
          id: "2",
          time: "2026-04-15T03:12:00.000Z",
          level: "warning",
          category: "collector",
          message: "newest",
        }),
      ],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["2", "1"]);
    expect(merged[1].message).toBe("updated");
  });

  it("deduplicates near-identical log entries from local and persisted sources", () => {
    const merged = mergeLogs(
      [
        log({
          id: "local-1",
          time: "2026-04-15T03:10:00.000Z",
          level: "success",
          category: "collector",
          message: "收集器已運行",
        }),
      ],
      [
        log({
          id: "db-1",
          time: "2026-04-15T03:10:02.000Z",
          level: "success",
          category: "collector",
          message: "收集器已運行",
        }),
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("db-1");
  });

  it("maps frontend category and defaults missing kind to event", () => {
    const entry = toAppLogEntry({
      id: "fe-1",
      time: "2026-04-15T03:10:00.000Z",
      level: "error",
      category: "frontend",
      message: "boom",
      details: null,
    });
    expect(entry.category).toBe("frontend");
    expect(entry.kind).toBe("event");
  });

  it("preserves kind from the wire payload", () => {
    const entry = toAppLogEntry({
      id: "fe-2",
      time: "2026-04-15T03:10:00.000Z",
      level: "error",
      category: "frontend",
      kind: "frontend.critical",
      message: "boom",
      details: null,
    });
    expect(entry.kind).toBe("frontend.critical");
  });

  it("buildAiHealthStatusLog includes messageKey for re-translate", async () => {
    const { buildAiHealthStatusLog } = await import("./appRuntimeShared");
    const entry = buildAiHealthStatusLog("available", {
      status: "available",
      reason: null,
      provider: "ollama",
    });
    expect(entry.kind).toBe("runtime.ai_status");
    expect(entry.messageKey).toBe("logs:templates.runtimeAiConnected");
  });

  it("maps NO_LLM_PROFILE to i18n and never dumps HTTPException JSON", async () => {
    const { ensureZhHantLocale } = await import("../test/i18nHarness");
    await ensureZhHantLocale();
    const { buildAiHealthStatusLog } = await import("./appRuntimeShared");
    const dump =
      "400: {'error_code': 'VALIDATION_ERROR', 'message': 'No LLM profile configured; create an AI profile first', 'details': None}";
    const entry = buildAiHealthStatusLog("unavailable", {
      status: "unavailable",
      reason: dump,
      provider: null,
      errorCode: "NO_LLM_PROFILE",
    });
    const payload = JSON.stringify(entry.payload ?? {});
    expect(payload).not.toContain("400:");
    expect(payload).not.toContain("VALIDATION_ERROR");
    expect(payload).not.toContain("{'error_code'");
    expect(entry.payload).toMatchObject({
      errorCode: "NO_LLM_PROFILE",
      provider: null,
    });
    expect(String(entry.payload?.reason)).toContain("設定檔");
  });

  it("maps a reason token without errorCode and drops exception dumps", async () => {
    const { ensureZhHantLocale } = await import("../test/i18nHarness");
    await ensureZhHantLocale();
    const { aiHealthPayload } = await import("./appRuntimeShared");
    const fromToken = aiHealthPayload({
      status: "unavailable",
      reason: "NO_LLM_PROFILE",
      provider: null,
    });
    expect(fromToken?.errorCode).toBe("NO_LLM_PROFILE");
    expect(String(fromToken?.reason)).toContain("設定檔");

    const fromDump = aiHealthPayload({
      status: "unavailable",
      reason:
        "400: {'error_code': 'VALIDATION_ERROR', 'message': 'No LLM profile configured; create an AI profile first', 'details': None}",
      provider: null,
    });
    expect(fromDump).toBeUndefined();
  });
});


describe("mergeLogs invariants", () => {
  const existing: AppLogEntry[] = [
    log({
      id: "entry-0",
      time: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      message: "msg-0-abc",
    }),
    log({
      id: "entry-1",
      time: new Date(Date.UTC(2026, 0, 1) + 10_000).toISOString(),
      level: "success",
      category: "collector",
      message: "msg-1-def",
    }),
  ];

  const incoming: AppLogEntry[] = [
    log({
      id: "entry-1",
      time: new Date(Date.UTC(2026, 0, 1) + 20_000).toISOString(),
      level: "warning",
      category: "collector",
      message: "msg-1-updated",
    }),
    log({
      id: "entry-2",
      time: new Date(Date.UTC(2026, 0, 1) + 30_000).toISOString(),
      level: "error",
      category: "system",
      message: "msg-2-ghi",
    }),
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
