import { beforeEach, describe, expect, it } from "vitest";

import i18n from "../i18n";
import { setAppLocale } from "../i18n/locale";
import {
  formatAnalysisMode,
  formatAnalysisTimeRange,
  formatAnalysisTimeRangeNullable,
  formatBatchMessageCount,
} from "./analysis";

describe("formatAnalysisMode", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it('returns task-type name for "intel_event"', () => {
    expect(formatAnalysisMode("intel_event")).toBe("情報任務");
  });

  it('returns task-type name for "leaderboard"', () => {
    expect(formatAnalysisMode("leaderboard")).toBe("排行榜任務");
  });

  it('returns task-type name for "agent"', () => {
    expect(formatAnalysisMode("agent")).toBe("Agent 任務");
    expect(formatAnalysisMode("recurring")).toBe("未知");
  });

  it('returns "未知" for unrecognized values', () => {
    expect(formatAnalysisMode("unknown")).toBe("未知");
    expect(formatAnalysisMode("")).toBe("未知");
    // Legacy mode label — cumulative was rewritten to intel_event in schema v1→v2.
    expect(formatAnalysisMode("cumulative")).toBe("未知");
    expect(formatAnalysisMode("project")).toBe("未知");
    expect(formatAnalysisMode("web_intel")).toBe("未知");
  });

  it("switches to English under en locale", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    expect(formatAnalysisMode("intel_event")).toBe("Intel task");
    expect(formatAnalysisMode("leaderboard")).toBe("Leaderboard task");
    expect(formatAnalysisMode("agent")).toBe("Agent task");
    expect(formatAnalysisMode("unknown")).toBe("Unknown");
  });
});

describe("formatAnalysisTimeRange", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("returns correct labels for every task-legal range", () => {
    expect(formatAnalysisTimeRange("all")).toBe("不限時間");
    expect(formatAnalysisTimeRange("today")).toBe("今天");
    expect(formatAnalysisTimeRange("1h")).toBe("最近 1 小時");
    expect(formatAnalysisTimeRange("6h")).toBe("最近 6 小時");
    expect(formatAnalysisTimeRange("48h")).toBe("最近 48 小時");
    expect(formatAnalysisTimeRange("1d")).toBe("最近 1 天");
    expect(formatAnalysisTimeRange("7d")).toBe("最近 7 天");
    expect(formatAnalysisTimeRange("30d")).toBe("最近 30 天");
  });

  it("does not map unknown or monitor-only tokens to unlimited", () => {
    expect(formatAnalysisTimeRange("unknown")).toBe("unknown");
    expect(formatAnalysisTimeRange("12h")).toBe("12h");
    expect(formatAnalysisTimeRange("24h")).toBe("24h");
  });

  it("treats empty input as unlimited", () => {
    expect(formatAnalysisTimeRange("")).toBe("不限時間");
    expect(formatAnalysisTimeRange(null)).toBe("不限時間");
    expect(formatAnalysisTimeRange(undefined)).toBe("不限時間");
  });

  it("handles Object.prototype property names without prototype pollution", () => {
    // Regression: inherited Object.prototype keys must not resolve as labels.
    expect(formatAnalysisTimeRange("toString")).toBe("toString");
    expect(formatAnalysisTimeRange("valueOf")).toBe("valueOf");
    expect(formatAnalysisTimeRange("constructor")).toBe("constructor");
    expect(formatAnalysisTimeRange("hasOwnProperty")).toBe("hasOwnProperty");
  });
});

describe("formatAnalysisTimeRangeNullable", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("returns null for null input", () => {
    expect(formatAnalysisTimeRangeNullable(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(formatAnalysisTimeRangeNullable("")).toBeNull();
  });

  it("returns null for unrecognized values", () => {
    expect(formatAnalysisTimeRangeNullable("2d")).toBeNull();
    expect(formatAnalysisTimeRangeNullable("unknown")).toBeNull();
    expect(formatAnalysisTimeRangeNullable("12h")).toBeNull();
    expect(formatAnalysisTimeRangeNullable("24h")).toBeNull();
  });

  it("returns formatted label for valid task values", () => {
    expect(formatAnalysisTimeRangeNullable("1d")).toBe("最近 1 天");
    expect(formatAnalysisTimeRangeNullable("7d")).toBe("最近 7 天");
    expect(formatAnalysisTimeRangeNullable("30d")).toBe("最近 30 天");
    expect(formatAnalysisTimeRangeNullable("48h")).toBe("最近 48 小時");
    expect(formatAnalysisTimeRangeNullable("today")).toBe("今天");
    expect(formatAnalysisTimeRangeNullable("all")).toBe("不限時間");
  });
});

describe("formatBatchMessageCount", () => {
  it("formats positive integers", () => {
    expect(formatBatchMessageCount(42)).toBe("42");
    expect(formatBatchMessageCount(0)).toBe("0");
  });

  it("truncates decimal values", () => {
    expect(formatBatchMessageCount(3.7)).toBe("3");
    expect(formatBatchMessageCount(9.99)).toBe("9");
  });

  it("clamps negative values to 0", () => {
    expect(formatBatchMessageCount(-5)).toBe("0");
  });

  it('returns "0" for null', () => {
    expect(formatBatchMessageCount(null)).toBe("0");
  });

  it('returns "0" for undefined', () => {
    expect(formatBatchMessageCount(undefined)).toBe("0");
  });

  it('returns "0" for NaN', () => {
    expect(formatBatchMessageCount(NaN)).toBe("0");
  });

  it('returns "0" for Infinity', () => {
    expect(formatBatchMessageCount(Infinity)).toBe("0");
    expect(formatBatchMessageCount(-Infinity)).toBe("0");
  });
});
