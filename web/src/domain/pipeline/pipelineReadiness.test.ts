import { describe, expect, it } from "vitest";
import {
  countActiveAnalysisTasks,
  nextPipelineEverCompleted,
  pipelineReadiness,
} from "./pipelineReadiness";

const base = {
  sourceCount: 0,
  activeAnalysisTaskCount: 0,
  analysisEventCount: 0,
  everCompleted: false,
};

describe("pipelineReadiness", () => {
  it("is no_sources when there are no sources", () => {
    expect(pipelineReadiness(base)).toEqual({
      state: "no_sources",
      showChecklist: true,
    });
    expect(
      pipelineReadiness({
        ...base,
        activeAnalysisTaskCount: 2,
        analysisEventCount: 5,
        everCompleted: true,
      }),
    ).toEqual({ state: "no_sources", showChecklist: true });
  });

  it("is no_active_task when sources exist but no active analysis task", () => {
    expect(
      pipelineReadiness({ ...base, sourceCount: 1, activeAnalysisTaskCount: 0 }),
    ).toEqual({ state: "no_active_task", showChecklist: true });
  });

  it("is no_events when an active task exists but nothing has been analyzed yet", () => {
    expect(
      pipelineReadiness({
        ...base,
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        analysisEventCount: 0,
      }),
    ).toEqual({ state: "no_events", showChecklist: true });
  });

  it("is complete once analysis events exist", () => {
    expect(
      pipelineReadiness({
        ...base,
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        analysisEventCount: 3,
      }),
    ).toEqual({ state: "complete", showChecklist: false });
  });

  it("stays complete after events are gone if the pipeline was completed before", () => {
    expect(
      pipelineReadiness({
        sourceCount: 1,
        activeAnalysisTaskCount: 1,
        analysisEventCount: 0,
        everCompleted: true,
      }),
    ).toEqual({ state: "complete", showChecklist: false });
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
