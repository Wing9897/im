import { describe, expect, it } from "vitest";

import {
  isTaskAnalysisTimeRange,
  TASK_ANALYSIS_TIME_RANGE_CHIP_ORDER,
  TASK_ANALYSIS_TIME_RANGE_I18N_KEYS,
  TASK_ANALYSIS_TIME_RANGE_VALUES,
} from "./taskAnalysisTimeRange";

describe("taskAnalysisTimeRange", () => {
  it("chip order covers every legal task window exactly once", () => {
    expect(new Set(TASK_ANALYSIS_TIME_RANGE_CHIP_ORDER)).toEqual(
      new Set(TASK_ANALYSIS_TIME_RANGE_VALUES),
    );
    expect(TASK_ANALYSIS_TIME_RANGE_CHIP_ORDER).toHaveLength(
      TASK_ANALYSIS_TIME_RANGE_VALUES.length,
    );
  });

  it("exposes an i18n key for every legal task window", () => {
    for (const value of TASK_ANALYSIS_TIME_RANGE_VALUES) {
      expect(TASK_ANALYSIS_TIME_RANGE_I18N_KEYS[value]).toMatch(/^tasks:editor\.time/);
    }
  });

  it("rejects monitor-only 12h/24h tokens", () => {
    expect(isTaskAnalysisTimeRange("12h")).toBe(false);
    expect(isTaskAnalysisTimeRange("24h")).toBe(false);
    expect(isTaskAnalysisTimeRange("48h")).toBe(true);
    expect(isTaskAnalysisTimeRange("today")).toBe(true);
  });
});
