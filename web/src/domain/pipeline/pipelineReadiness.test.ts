import { describe, expect, it } from "vitest";
import {
  countActiveAnalysisTasks,
  isAssistantOnboardingDone,
  nextPipelineEverCompleted,
  pipelineReadiness,
} from "./pipelineReadiness";

const base = {
  sourceCount: 0,
  activeAnalysisTaskCount: 0,
  analysisEventCount: 0,
  taskCount: 0,
  everCompleted: false,
};

describe("pipelineReadiness", () => {
  it("shows the checklist when the catalog is empty", () => {
    expect(pipelineReadiness(base)).toEqual({
      state: "no_sources",
      showChecklist: true,
      assistantSlotReady: false,
    });
    expect(
      pipelineReadiness({ ...base, sourceCount: 1, activeAnalysisTaskCount: 0 }),
    ).toEqual({
      state: "no_active_task",
      showChecklist: true,
      assistantSlotReady: false,
    });
  });

  it("hides the checklist when any task exists, including inactive or demo", () => {
    expect(
      pipelineReadiness({
        ...base,
        sourceCount: 1,
        activeAnalysisTaskCount: 0,
        taskCount: 1,
      }),
    ).toEqual({
      state: "no_active_task",
      showChecklist: false,
      assistantSlotReady: false,
    });
    expect(
      pipelineReadiness({
        ...base,
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        taskCount: 2,
        analysisEventCount: 0,
      }),
    ).toEqual({
      state: "no_events",
      showChecklist: false,
      assistantSlotReady: false,
    });
  });

  it("is no_sources when there are no sources", () => {
    expect(pipelineReadiness(base)).toEqual({
      state: "no_sources",
      showChecklist: true,
      assistantSlotReady: false,
    });
    expect(
      pipelineReadiness({
        ...base,
        taskCount: 2,
        activeAnalysisTaskCount: 2,
        analysisEventCount: 5,
        everCompleted: true,
      }),
    ).toEqual({
      state: "no_sources",
      showChecklist: false,
      assistantSlotReady: false,
    });
  });

  it("is no_active_task when sources exist but no active analysis task", () => {
    expect(
      pipelineReadiness({ ...base, sourceCount: 1, activeAnalysisTaskCount: 0 }),
    ).toEqual({
      state: "no_active_task",
      showChecklist: true,
      assistantSlotReady: false,
    });
  });

  it("is no_events when an active task exists but nothing has been analyzed yet", () => {
    expect(
      pipelineReadiness({
        ...base,
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        taskCount: 1,
        analysisEventCount: 0,
      }),
    ).toEqual({
      state: "no_events",
      showChecklist: false,
      assistantSlotReady: false,
    });
  });

  it("is complete once analysis events exist", () => {
    expect(
      pipelineReadiness({
        ...base,
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        taskCount: 1,
        analysisEventCount: 3,
      }),
    ).toEqual({
      state: "complete",
      showChecklist: false,
      assistantSlotReady: false,
    });
  });

  it("stays complete after events are gone if the pipeline was completed before", () => {
    expect(
      pipelineReadiness({
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        taskCount: 1,
        analysisEventCount: 0,
        everCompleted: true,
      }),
    ).toEqual({
      state: "complete",
      showChecklist: false,
      assistantSlotReady: false,
    });
  });

  it("does not block complete when the optional assistant slot is unbound", () => {
    expect(
      pipelineReadiness({
        ...base,
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        taskCount: 1,
        analysisEventCount: 3,
        assistantSlotReady: false,
      }),
    ).toEqual({
      state: "complete",
      showChecklist: false,
      assistantSlotReady: false,
    });
  });

  it("echoes assistantSlotReady without changing the sources → tasks → events machine", () => {
    expect(
      pipelineReadiness({
        ...base,
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        taskCount: 1,
        analysisEventCount: 0,
        assistantSlotReady: true,
      }),
    ).toEqual({
      state: "no_events",
      showChecklist: false,
      assistantSlotReady: true,
    });
  });
});

describe("isAssistantOnboardingDone", () => {
  const completeDefault = { id: "__default__", complete: true };

  it("is false when the assistant slot is unbound, even if __default__ exists", () => {
    expect(
      isAssistantOnboardingDone({
        slots: [{ slot: "assistant", profileId: "" }],
        profiles: [completeDefault],
      }),
    ).toBe(false);
    expect(
      isAssistantOnboardingDone({
        slots: [],
        profiles: [completeDefault],
      }),
    ).toBe(false);
  });

  it("is false when the bound profile is missing or incomplete", () => {
    expect(
      isAssistantOnboardingDone({
        slots: [{ slot: "assistant", profileId: "p1" }],
        profiles: [{ id: "p1", complete: false }],
      }),
    ).toBe(false);
    expect(
      isAssistantOnboardingDone({
        slots: [{ slot: "assistant", profileId: "p1" }],
        profiles: [{ id: "other", complete: true }],
      }),
    ).toBe(false);
  });

  it("is true only when the assistant slot points at a complete profile", () => {
    expect(
      isAssistantOnboardingDone({
        slots: [{ slot: "assistant", profileId: "  p1  " }],
        profiles: [{ id: "p1", complete: true }],
      }),
    ).toBe(true);
  });
});

describe("nextPipelineEverCompleted", () => {
  it("sets true when the live pipeline is complete", () => {
    expect(
      nextPipelineEverCompleted({
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        analysisEventCount: 2,
        everCompleted: false,
      }),
    ).toBe(true);
  });

  it("clears when sources or active tasks are wiped", () => {
    expect(
      nextPipelineEverCompleted({
        sourceCount: 0,
        activeAnalysisTaskCount: 1,
        analysisEventCount: 2,
        everCompleted: true,
      }),
    ).toBe(false);
    expect(
      nextPipelineEverCompleted({
        sourceCount: 1,
        activeAnalysisTaskCount: 0,
        analysisEventCount: 2,
        everCompleted: true,
      }),
    ).toBe(false);
  });

  it("keeps the flag when events are later empty but sources and tasks remain", () => {
    expect(
      nextPipelineEverCompleted({
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        analysisEventCount: 0,
        everCompleted: true,
      }),
    ).toBe(true);
  });
});

describe("countActiveAnalysisTasks", () => {
  it("counts active leaderboard / intel_event / agent tasks only", () => {
    expect(
      countActiveAnalysisTasks([
        { isActive: true, analysisMode: "intel_event" },
        { isActive: false, analysisMode: "intel_event" },
        { isActive: true, analysisMode: "leaderboard" },
        { isActive: true, analysisMode: "agent" },
        { isActive: true, analysisMode: "unknown" },
      ]),
    ).toBe(3);
  });
});
