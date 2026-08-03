import { describe, it, expect } from "vitest";
import {
  ANALYSIS_MODE_ORDER,
  ANALYSIS_MODE_CAPABILITIES,
  analysisModeRequiresChannels,
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
        caps.schedulable && analysisModeRequiresChannels(mode),
      );
    }
  });

  it("channel-bound schedulable modes share the same field visibility", () => {
    const channelModes = ANALYSIS_MODE_ORDER.filter(
      (mode) =>
        ANALYSIS_MODE_CAPABILITIES[mode].schedulable &&
        analysisModeRequiresChannels(mode),
    );
    const baseline = getTaskModeFieldVisibility(channelModes[0]!);
    for (const mode of channelModes) {
      expect(getTaskModeFieldVisibility(mode)).toEqual(baseline);
    }
  });

  it("web_intel shows prompt but hides channels", () => {
    expect(getTaskModeFieldVisibility("web_intel")).toEqual({
      rruleFieldsVisible: false,
      promptFieldsVisible: true,
      channelFieldsVisible: false,
    });
  });
});
