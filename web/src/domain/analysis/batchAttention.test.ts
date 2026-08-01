import { describe, expect, it } from "vitest";

import type { ProcessingBatchInfo, QueueStatus } from "../../types";
import { pickLatestBatchAttention } from "./batchAttention";

function batch(partial: Partial<ProcessingBatchInfo>): ProcessingBatchInfo {
  return {
    batchId: "b1",
    taskId: "t1",
    taskName: "任務",
    messageCount: 1,
    status: "pending",
    retryCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    ...partial,
  };
}

function queue(
  attention: ProcessingBatchInfo[] = [],
  processing: ProcessingBatchInfo[] = [],
): QueueStatus {
  return {
    pendingCount: 0,
    analysisPaused: false,
    attentionBatches: attention,
    processingBatches: processing,
  };
}

describe("pickLatestBatchAttention", () => {
  it("returns null when queue or task has no matching batches", () => {
    expect(pickLatestBatchAttention(null, "t1")).toBeNull();
    expect(pickLatestBatchAttention(queue(), "t1")).toBeNull();
    expect(
      pickLatestBatchAttention(
        queue([batch({ taskId: "other", errorMessage: "x" })]),
        "t1",
      ),
    ).toBeNull();
  });

  it("prefers attentionBatches with errorMessage over older processing rows", () => {
    const result = pickLatestBatchAttention(
      queue(
        [
          batch({
            batchId: "attn",
            errorMessage: "rate limit",
            retryCount: 3,
            updatedAt: "2026-01-02T00:00:00.000Z",
          }),
        ],
        [
          batch({
            batchId: "proc",
            errorMessage: "older",
            retryCount: 1,
            updatedAt: "2026-01-03T00:00:00.000Z",
          }),
        ],
      ),
      "t1",
    );
    expect(result?.batch.batchId).toBe("attn");
    expect(result?.errorMessage).toBe("rate limit");
    expect(result?.retryCount).toBe(3);
  });

  it("picks newest by updatedAt when both have errors", () => {
    const result = pickLatestBatchAttention(
      queue([
        batch({
          batchId: "old",
          errorMessage: "old err",
          retryCount: 1,
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        batch({
          batchId: "new",
          errorMessage: "new err",
          retryCount: 2,
          updatedAt: "2026-01-02T00:00:00.000Z",
        }),
      ]),
      "t1",
    );
    expect(result?.batch.batchId).toBe("new");
    expect(result?.retryCount).toBe(2);
  });

  it("falls back to processingBatches without inventing failed status", () => {
    const result = pickLatestBatchAttention(
      queue([], [
        batch({
          batchId: "p1",
          status: "processing",
          retryCount: 1,
          errorMessage: "transient",
        }),
      ]),
      "t1",
    );
    expect(result?.batch.status).toBe("processing");
    expect(result?.errorMessage).toBe("transient");
    expect(result?.retryCount).toBe(1);
  });
});
