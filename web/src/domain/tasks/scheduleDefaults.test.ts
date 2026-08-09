import { describe, expect, it } from "vitest";
import {
  DEFAULT_BATCH_OVERLAP_COUNT,
  DEFAULT_AGENT_WAVE_INTERVAL_SECONDS,
} from "./scheduleDefaults";

describe("scheduleDefaults", () => {
  it("uses 20s wave cool-down and 0 overlap for task-owned NULLs", () => {
    expect(DEFAULT_AGENT_WAVE_INTERVAL_SECONDS).toBe(20);
    expect(DEFAULT_BATCH_OVERLAP_COUNT).toBe(0);
  });
});
