import { describe, expect, it } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  filterAssignableTimelineTasks,
  getGeneralWorksetLabel,
  isNullProvenanceTaskId,
  isTimelineAssignableAnalysisMode,
  normalizeOptionalWorksetId,
  resolveUserEventTaskName,
  toUserEventFormWorksetId,
} from "./userEvents";

describe("userEvents helpers", () => {
  it("treats null/empty/__user__ as missing provenance; normalizes workset ids", () => {
    expect(isNullProvenanceTaskId(null)).toBe(true);
    expect(isNullProvenanceTaskId("")).toBe(true);
    expect(isNullProvenanceTaskId(SYSTEM_WORKSET_ID)).toBe(true);
    expect(isNullProvenanceTaskId("ct-1")).toBe(false);

    expect(toUserEventFormWorksetId(null)).toBe(SYSTEM_WORKSET_ID);
    expect(toUserEventFormWorksetId("")).toBe(SYSTEM_WORKSET_ID);
    expect(toUserEventFormWorksetId("ws-1")).toBe("ws-1");

    // Optional create preselect: non-strings must not call .trim (click events).
    expect(normalizeOptionalWorksetId(undefined)).toBeNull();
    expect(normalizeOptionalWorksetId(null)).toBeNull();
    expect(normalizeOptionalWorksetId("")).toBeNull();
    expect(normalizeOptionalWorksetId("   ")).toBeNull();
    expect(normalizeOptionalWorksetId("ws-1")).toBe("ws-1");
    expect(normalizeOptionalWorksetId("  ws-1  ")).toBe("ws-1");
    expect(normalizeOptionalWorksetId(42)).toBeNull();
    expect(normalizeOptionalWorksetId({ type: "click" })).toBeNull();
  });

  it("filters assignable analysis modes and optional active-only", () => {
    expect(isTimelineAssignableAnalysisMode("recurring")).toBe(true);
    expect(isTimelineAssignableAnalysisMode("agent")).toBe(true);
    expect(isTimelineAssignableAnalysisMode("summary")).toBe(false);
    expect(isTimelineAssignableAnalysisMode("leaderboard")).toBe(false);

    const tasks = [
      { id: "a", name: "A", analysisMode: "intel_event", isActive: true },
      { id: "b", name: "B", analysisMode: "recurring", isActive: false },
      { id: "c", name: "C", analysisMode: "summary", isActive: true },
      {
        id: "d",
        name: "Child",
        analysisMode: "recurring",
        isActive: true,
        parentTaskId: "proj-1",
      },
      { id: "e", name: "Project", analysisMode: "agent", isActive: true },
      { id: "w", name: "Web", analysisMode: "agent", isActive: true },
      { id: "lb", name: "LB", analysisMode: "leaderboard", isActive: true },
    ];
    expect(filterAssignableTimelineTasks(tasks).map((t) => t.id)).toEqual(["a", "b", "e", "w"]);
    expect(filterAssignableTimelineTasks(tasks, { activeOnly: true }).map((t) => t.id)).toEqual([
      "a",
      "e",
      "w",
    ]);
  });

  it("resolves provenance task names, else ownership workset names", () => {
    const tasks = new Map([["ct-1", "日曆任務"]]);
    const worksets = new Map([["ws-ops", "Ops"]]);
    expect(resolveUserEventTaskName(null)).toBe(getGeneralWorksetLabel());
    expect(resolveUserEventTaskName("ct-1", tasks)).toBe("日曆任務");
    expect(resolveUserEventTaskName("missing", tasks)).toBe("missing");
    expect(
      resolveUserEventTaskName(null, tasks, getGeneralWorksetLabel(), "ws-ops", worksets),
    ).toBe("Ops");
    expect(
      resolveUserEventTaskName(null, tasks, getGeneralWorksetLabel(), SYSTEM_WORKSET_ID, worksets),
    ).toBe(getGeneralWorksetLabel());
  });
});
