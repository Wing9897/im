import { describe, it, expect } from "vitest";
import {
  ANALYSIS_MODE_ORDER,
  ANALYSIS_MODE_CAPABILITIES,
  analysisModeRequiresChannels,
  analysisModeShowsOptionalChannels,
} from "./analysisModeCapabilities";
import { getTaskModeFieldVisibility } from "./taskFormUtils";

describe("Task mode field visibility", () => {
  it("follows analysisModeCapabilities for every registered mode", () => {
    for (const mode of ANALYSIS_MODE_ORDER) {
      const caps = ANALYSIS_MODE_CAPABILITIES[mode];
      const visibility = getTaskModeFieldVisibility(mode);
      expect(visibility.rruleFieldsVisible).toBe(caps.pipeline === "rrule_expand");
      expect(visibility.promptFieldsVisible).toBe(caps.schedulable);
      expect(visibility.channelFieldsVisible).toBe(
        caps.schedulable &&
          (analysisModeRequiresChannels(mode) || analysisModeShowsOptionalChannels(mode)),
      );
      expect(visibility.channelsRequired).toBe(analysisModeRequiresChannels(mode));
      expect(visibility.channelsOptional).toBe(analysisModeShowsOptionalChannels(mode));
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

  it("web_intel shows prompt and optional channels without messageBatch", () => {
    expect(ANALYSIS_MODE_CAPABILITIES.web_intel.messageBatch).toBe(false);
    expect(analysisModeRequiresChannels("web_intel")).toBe(false);
    expect(analysisModeShowsOptionalChannels("web_intel")).toBe(true);
    expect(getTaskModeFieldVisibility("web_intel")).toEqual({
      rruleFieldsVisible: false,
      promptFieldsVisible: true,
      channelFieldsVisible: true,
      channelsOptional: true,
      channelsRequired: false,
      analysisTimeRangeVisible: false,
      timelineToggleVisible: true,
      promptRequired: true,
      isWebIntel: true,
      isProject: false,
      isRecurring: false,
    });
  });

  it("hides analysis time range for web_intel but keeps it for intel_event", () => {
    expect(getTaskModeFieldVisibility("web_intel").analysisTimeRangeVisible).toBe(false);
    expect(getTaskModeFieldVisibility("intel_event").analysisTimeRangeVisible).toBe(true);
  });
});
