import { describe, it, expect } from "vitest";
import { applyActiveAnalysisEvent, type ActiveAnalysisEvent } from "./activeAnalysesReducer";
import type { ActiveAnalysisState } from "./appRuntimeShared";

function applyEvent(
  state: Map<string, ActiveAnalysisState>,
  event: ActiveAnalysisEvent,
): Map<string, ActiveAnalysisState> {
  return applyActiveAnalysisEvent(state, event);
}

function expectedActiveBatchIds(events: ActiveAnalysisEvent[]): Set<string> {
  const expectedActive = new Set<string>();
  for (const event of events) {
    if (event.type === "started") {
      expectedActive.add(event.batchId);
    } else {
      expectedActive.delete(event.batchId);
    }
  }
  return expectedActive;
}

describe("activeAnalyses state machine correctness", () => {
  it("map contains exactly the started-but-not-completed/failed batchIds", () => {
    const events: ActiveAnalysisEvent[] = [
      { type: "started", batchId: "a", taskName: "T1", messageCount: 5 },
      { type: "started", batchId: "b", taskName: "T2", messageCount: 3 },
      { type: "completed", batchId: "a" },
      { type: "failed", batchId: "c" },
      { type: "started", batchId: "c", taskName: "T3", messageCount: 10 },
    ];

    let state = new Map<string, ActiveAnalysisState>();
    for (const event of events) {
      state = applyEvent(state, event);
    }

    expect(new Set(state.keys())).toEqual(expectedActiveBatchIds(events));
  });

  it("duplicate started events update rather than duplicate entries", () => {
    let state = new Map<string, ActiveAnalysisState>();
    state = applyEvent(state, {
      type: "started",
      batchId: "x",
      taskName: "First",
      messageCount: 3,
    });
    state = applyEvent(state, {
      type: "started",
      batchId: "x",
      taskName: "Second",
      messageCount: 7,
    });

    expect(state.size).toBe(1);
    expect(state.get("x")!.taskName).toBe("Second");
    expect(state.get("x")!.messageCount).toBe(7);
  });

  it("completed/failed events for non-existent batchIds are no-ops", () => {
    const state = new Map<string, ActiveAnalysisState>();
    expect(applyEvent(state, { type: "completed", batchId: "missing" }).size).toBe(0);
    expect(applyEvent(state, { type: "failed", batchId: "missing" }).size).toBe(0);
  });

  it("backward-compatible getter returns first entry or null", () => {
    const events: ActiveAnalysisEvent[] = [
      { type: "started", batchId: "a", taskName: "T1", messageCount: 1 },
      { type: "completed", batchId: "a" },
    ];

    let state = new Map<string, ActiveAnalysisState>();
    for (const event of events) {
      state = applyEvent(state, event);
    }

    const firstRunningBatch = state.size > 0 ? state.values().next().value ?? null : null;
    expect(firstRunningBatch).toBeNull();
  });
});
