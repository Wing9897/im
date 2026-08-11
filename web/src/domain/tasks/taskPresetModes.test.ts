import { describe, expect, it } from "vitest";

import { analysisModeSupportsTaskPresets } from "./taskPresetModes";

describe("analysisModeSupportsTaskPresets", () => {
  it("allows AI and agent modes", () => {
    expect(analysisModeSupportsTaskPresets("leaderboard")).toBe(true);
    expect(analysisModeSupportsTaskPresets("intel_event")).toBe(true);
    expect(analysisModeSupportsTaskPresets("agent")).toBe(true);
  });
});
