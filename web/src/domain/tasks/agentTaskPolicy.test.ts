import { describe, expect, it } from "vitest";
import {
  CATALOG_AGENT_PRESET_ID,
  agentChannelsRequired,
  agentPresetFormPatch,
  agentPresetPolicy,
  inferAgentPreset,
  normalizeAgentPolicy,
} from "./agentTaskPolicy";

describe("normalizeAgentPolicy", () => {
  it("strips outputAnalysisEvents when trigger is message_cursor", () => {
    const policy = normalizeAgentPolicy(
      {
        triggerMode: "message_cursor",
        outputCalendar: true,
        outputAnalysisEvents: true,
      },
      { hasChannels: true },
    );
    expect(policy.triggerMode).toBe("message_cursor");
    expect(policy.outputAnalysisEvents).toBe(false);
    expect(policy.outputCalendar).toBe(true);
  });

  it("forces calendar output when cursor combo would leave no output", () => {
    const policy = normalizeAgentPolicy(
      {
        triggerMode: "message_cursor",
        outputCalendar: false,
        outputAnalysisEvents: true,
      },
      { hasChannels: true },
    );
    expect(policy.outputAnalysisEvents).toBe(false);
    expect(policy.outputCalendar).toBe(true);
    expect(policy.capCalendarWrites).toBe(true);
  });

  it("allows schedule + outputAnalysisEvents", () => {
    const policy = normalizeAgentPolicy({
      triggerMode: "schedule",
      outputCalendar: false,
      outputAnalysisEvents: true,
    });
    expect(policy.outputAnalysisEvents).toBe(true);
    expect(policy.outputCalendar).toBe(false);
  });
});

describe("agent mode cards", () => {
  it("對帳日曆 requires sources, writes calendar, and disables web search", () => {
    const policy = agentPresetPolicy("project_reconcile", { hasChannels: true });
    expect(policy.triggerMode).toBe("message_cursor");
    expect(policy.outputCalendar).toBe(true);
    expect(policy.outputAnalysisEvents).toBe(false);
    expect(policy.capWebSearch).toBe(false);
    expect(agentChannelsRequired(policy)).toBe(true);
    expect(inferAgentPreset(policy, { hasChannels: true })).toBe("project_reconcile");
  });

  it("來源+網搜 uses threshold, search, and required sources", () => {
    const patch = agentPresetFormPatch("web_scout");
    expect(patch.policy.triggerMode).toBe("message_threshold");
    expect(patch.policy.capForceWebSearch).toBe(true);
    expect(patch.policy.outputAnalysisEvents).toBe(true);
    expect(patch.clearChannels).toBe(false);
    expect(agentChannelsRequired(patch.policy)).toBe(true);
  });

  it("純網搜 stays schedule even if channels exist, and clears them", () => {
    const patch = agentPresetFormPatch("pure_web_search");
    expect(patch.policy.triggerMode).toBe("schedule");
    expect(patch.policy.capForceWebSearch).toBe(true);
    expect(patch.policy.outputCalendar).toBe(false);
    expect(patch.policy.outputAnalysisEvents).toBe(true);
    expect(patch.clearChannels).toBe(true);
    expect(agentChannelsRequired(patch.policy)).toBe(false);
    expect(inferAgentPreset(patch.policy, { hasChannels: false })).toBe("pure_web_search");
  });

  it("maps catalog templates onto the three mode cards", () => {
    expect(CATALOG_AGENT_PRESET_ID).toEqual({
      "agent-work-shift": "project_reconcile",
      "agent-project-schedule": "project_reconcile",
      "agent-source-verify": "web_scout",
      "agent-pure-web-search": "pure_web_search",
    });
  });
});
