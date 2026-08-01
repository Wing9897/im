import { describe, expect, it } from "vitest";

import { analysisModeSupportsTaskPresets } from "./taskPresetModes";

describe("analysisModeSupportsTaskPresets", () => {
  it("allows AI and project modes", () => {
    expect(analysisModeSupportsTaskPresets("leaderboard")).toBe(true);
    expect(analysisModeSupportsTaskPresets("event")).toBe(true);
    expect(analysisModeSupportsTaskPresets("project")).toBe(true);
  });

  it("hides recurring", () => {
    expect(analysisModeSupportsTaskPresets("recurring")).toBe(false);
  });
});
