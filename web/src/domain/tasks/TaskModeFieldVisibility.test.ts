import { describe, it, expect } from "vitest";
import {
  ANALYSIS_MODE_ORDER,
  ANALYSIS_MODE_CAPABILITIES,
} from "./analysisModeCapabilities";
import { getTaskModeFieldVisibility } from "./taskFormUtils";

describe("Task mode field visibility", () => {
  it("follows analysisModeCapabilities for every registered mode", () => {
    for (const mode of ANALYSIS_MODE_ORDER) {
      const caps = ANALYSIS_MODE_CAPABILITIES[mode];
      const visibility = getTaskModeFieldVisibility(mode);
      expect(visibility.rruleFieldsVisible).toBe(caps.pipeline === "rrule_expand");
      expect(visibility.promptFieldsVisible).toBe(caps.schedulable);
      expect(visibility.channelFieldsVisible).toBe(caps.schedulable);
    }
  });

  it("AI／schedulable modes share the same field visibility", () => {
    const schedulable = ANALYSIS_MODE_ORDER.filter(
      (mode) => ANALYSIS_MODE_CAPABILITIES[mode].schedulable,
    );
    const baseline = getTaskModeFieldVisibility(schedulable[0]!);
    for (const mode of schedulable) {
      expect(getTaskModeFieldVisibility(mode)).toEqual(baseline);
    }
  });
});
