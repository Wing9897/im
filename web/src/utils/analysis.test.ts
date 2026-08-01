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

  it('returns "關鍵事件" for "event"', () => {
    expect(formatAnalysisMode("event")).toBe("關鍵事件");
  });

  it('returns "排行榜" for "leaderboard"', () => {
    expect(formatAnalysisMode("leaderboard")).toBe("排行榜");
  });

  it('returns "未知" for unrecognized values', () => {
    expect(formatAnalysisMode("unknown")).toBe("未知");
    expect(formatAnalysisMode("")).toBe("未知");
    // Legacy mode label — cumulative was rewritten to event in schema v1→v2.
    expect(formatAnalysisMode("cumulative")).toBe("未知");
  });

  it("switches to English under en locale", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    expect(formatAnalysisMode("event")).toBe("Key Events");
    expect(formatAnalysisMode("unknown")).toBe("Unknown");
  });
});

describe("formatAnalysisTimeRange", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("returns correct labels for known ranges", () => {
    expect(formatAnalysisTimeRange("1d")).toBe("最近 1 天");
    expect(formatAnalysisTimeRange("7d")).toBe("最近 7 天");
    expect(formatAnalysisTimeRange("30d")).toBe("最近 30 天");
  });

  it('returns "不限時間" for unknown values including "all"', () => {
    expect(formatAnalysisTimeRange("all")).toBe("不限時間");
    expect(formatAnalysisTimeRange("unknown")).toBe("不限時間");
  });

  it("normalizes historical window tokens 12h/24h onto last-1-day label", () => {
    expect(formatAnalysisTimeRange("24h")).toBe("最近 1 天");
    expect(formatAnalysisTimeRange("12h")).toBe("最近 1 天");
  });

  it("handles Object.prototype property names without prototype pollution", () => {
    // Regression: these previously returned the inherited prototype function
    // instead of the fallback string, because the lookup used `value in obj`
    // which traverses the prototype chain.
    expect(formatAnalysisTimeRange("toString")).toBe("不限時間");
    expect(formatAnalysisTimeRange("valueOf")).toBe("不限時間");
    expect(formatAnalysisTimeRange("constructor")).toBe("不限時間");
    expect(formatAnalysisTimeRange("hasOwnProperty")).toBe("不限時間");
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
  });

  it("returns formatted label for valid values", () => {
    expect(formatAnalysisTimeRangeNullable("1d")).toBe("最近 1 天");
    expect(formatAnalysisTimeRangeNullable("7d")).toBe("最近 7 天");
    expect(formatAnalysisTimeRangeNullable("30d")).toBe("最近 30 天");
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
