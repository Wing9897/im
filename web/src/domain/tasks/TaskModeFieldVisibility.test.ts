import { describe, it, expect } from "vitest";
import {
  ANALYSIS_MODE_ORDER,
  ANALYSIS_MODE_CAPABILITIES,
  analysisModeRequiresChannels,
  analysisModeShowsOptionalChannels,
} from "./analysisModeCapabilities";
import { getTaskModeFieldVisibility } from "./taskFormUtils";
import { agentPresetPolicy } from "./agentTaskPolicy";

describe("Task mode field visibility", () => {
  it("follows analysisModeCapabilities for every registered mode", () => {
    for (const mode of ANALYSIS_MODE_ORDER) {
      const caps = ANALYSIS_MODE_CAPABILITIES[mode];
      const policy = mode === "agent" ? agentPresetPolicy("web_scout") : null;
      const visibility = getTaskModeFieldVisibility(mode, policy);
      expect(visibility.promptFieldsVisible).toBe(caps.schedulable);
      expect(visibility.channelFieldsVisible).toBe(
        caps.schedulable &&
          (visibility.channelsRequired || visibility.channelsOptional),
      );
      expect(visibility.promptRequired).toBe(caps.schedulable);
    }
  });

  it("channel-required modes share core channel/prompt visibility", () => {
    const channelModes = ANALYSIS_MODE_ORDER.filter(
      (mode) =>
        ANALYSIS_MODE_CAPABILITIES[mode].schedulable &&
        analysisModeRequiresChannels(mode),
    );
    for (const mode of channelModes) {
      const visibility = getTaskModeFieldVisibility(mode);
      expect(visibility.promptFieldsVisible).toBe(true);
      expect(visibility.channelFieldsVisible).toBe(true);
      expect(visibility.channelsRequired).toBe(true);
      expect(visibility.channelsOptional).toBe(false);
    }
  });

  it("agent web_scout shows prompt and optional channels without messageBatch", () => {
    const policy = agentPresetPolicy("web_scout");
    expect(ANALYSIS_MODE_CAPABILITIES.agent.messageBatch).toBe(false);
    expect(analysisModeRequiresChannels("agent")).toBe(false);
    expect(analysisModeShowsOptionalChannels("agent")).toBe(true);
    expect(getTaskModeFieldVisibility("agent", policy)).toEqual({
      promptFieldsVisible: true,
      channelFieldsVisible: true,
      channelsOptional: true,
      channelsRequired: false,
      analysisTimeRangeVisible: false,
      timelineToggleVisible: true,
      promptRequired: true,
      isAgent: true,
      showAgentPolicy: true,
      showWaveInterval: false,
      showMessageGateOverrides: false,
    });
  });

  it("hides analysis time range for agent but keeps it for intel_event", () => {
    expect(getTaskModeFieldVisibility("agent", agentPresetPolicy("web_scout")).analysisTimeRangeVisible).toBe(false);
    expect(getTaskModeFieldVisibility("intel_event").analysisTimeRangeVisible).toBe(true);
  });
});
