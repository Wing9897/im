import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  homePathForMode,
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

  it("hides collect/analyze paths and task editors, not the workset catalog", () => {
    expect(isSimpleModeHiddenPath("/monitor")).toBe(true);
    expect(isSimpleModeHiddenPath("/sources")).toBe(true);
    expect(isSimpleModeHiddenPath("/notify")).toBe(false);
    expect(isSimpleModeHiddenPath("/intelligence")).toBe(true);
    expect(isSimpleModeHiddenPath("/leaderboard")).toBe(true);
    expect(isSimpleModeHiddenPath("/timeline")).toBe(false);
    expect(isSimpleModeHiddenPath("/schedule")).toBe(false);
    expect(isSimpleModeHiddenPath("/items")).toBe(false);
    expect(isSimpleModeHiddenPath("/worksets")).toBe(false);
    expect(isSimpleModeHiddenPath("/tasks")).toBe(true);
    expect(isSimpleModeHiddenPath("/tasks/new")).toBe(true);
    expect(isSimpleModeHiddenPath("/tasks/abc/edit")).toBe(true);
    expect(isSimpleModeHiddenPath("/tasks/abc/agent")).toBe(true);
    expect(isSimpleModeHiddenPath("/assistant")).toBe(false);
    expect(isSimpleModeHiddenPath("/settings/general")).toBe(false);
  });

  it("does not hide leftover /worksets?tab=tasks — catalog owns that URL", () => {
    expect(isSimpleModeHiddenPath("/worksets")).toBe(false);
    expect(isSimpleModeHiddenPath("/ai/analysis-strategy")).toBe(false);
    expect(isSimpleModeHiddenPath("/ai/provider")).toBe(false);
    expect(isSimpleModeHiddenPath("/settings/ai/provider")).toBe(false);
  });
});
