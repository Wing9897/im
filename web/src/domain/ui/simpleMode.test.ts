import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  homePathForMode,
  isSimpleModeHiddenAiTab,
  isSimpleModeHiddenPath,
  readSimpleMode,
  SIMPLE_MODE_STORAGE_KEY,
  writeSimpleMode,
} from "./simpleMode";

describe("simpleMode", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults to off and round-trips localStorage", () => {
    expect(readSimpleMode()).toBe(false);
    writeSimpleMode(true);
    expect(readSimpleMode()).toBe(true);
    expect(window.localStorage.getItem(SIMPLE_MODE_STORAGE_KEY)).toBe("true");
  });

  it("picks home by mode", () => {
    expect(homePathForMode(true)).toBe("/timeline");
    expect(homePathForMode(false)).toBe("/monitor");
  });

  it("hides collect/analyze paths", () => {
    expect(isSimpleModeHiddenPath("/monitor")).toBe(true);
    expect(isSimpleModeHiddenPath("/accounts")).toBe(true);
    expect(isSimpleModeHiddenPath("/actions")).toBe(false);
    expect(isSimpleModeHiddenPath("/intelligence")).toBe(true);
    expect(isSimpleModeHiddenPath("/leaderboard")).toBe(true);
    expect(isSimpleModeHiddenPath("/timeline")).toBe(false);
    expect(isSimpleModeHiddenPath("/tasks")).toBe(false);
    expect(isSimpleModeHiddenPath("/assistant")).toBe(false);
    expect(isSimpleModeHiddenPath("/settings/general")).toBe(false);
  });

  it("hides analysis-strategy AI tab only", () => {
    expect(isSimpleModeHiddenAiTab("/ai/analysis-strategy")).toBe(true);
    expect(isSimpleModeHiddenAiTab("/ai/provider")).toBe(false);
    expect(isSimpleModeHiddenAiTab("/ai/staff")).toBe(false);
  });
});
