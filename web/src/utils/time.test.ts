import { describe, expect, it } from "vitest";

import { formatOsDateTime, formatOptionalOsDateTime, getOsTimeMs } from "./time";

describe("formatOsDateTime", () => {
  it("formats a valid ISO 8601 timestamp with timezone", () => {
    const result = formatOsDateTime("2026-04-15T03:00:00.000Z");
    // Should produce a locale-dependent string, but must not be the raw input
    expect(result).not.toBe("2026-04-15T03:00:00.000Z");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats a valid ISO 8601 timestamp without timezone (treated as UTC)", () => {
    const result = formatOsDateTime("2026-04-15T03:00:00");
    expect(result).not.toBe("2026-04-15T03:00:00");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats a space-separated datetime string", () => {
    const result = formatOsDateTime("2026-04-15 03:00:00");
    expect(result).not.toBe("2026-04-15 03:00:00");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns the original value for an invalid timestamp", () => {
    expect(formatOsDateTime("not-a-date")).toBe("not-a-date");
  });

  it("returns the original value for an empty string", () => {
    expect(formatOsDateTime("")).toBe("");
  });

  it("accepts Intl.DateTimeFormatOptions", () => {
    const result = formatOsDateTime("2026-04-15T03:00:00.000Z", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // Should contain the year 2026
    expect(result).toContain("2026");
  });
});

describe("formatOptionalOsDateTime", () => {
  it("returns fallback for null", () => {
    expect(formatOptionalOsDateTime(null)).toBe("—");
  });

  it("returns fallback for undefined", () => {
    expect(formatOptionalOsDateTime(undefined)).toBe("—");
  });

  it("returns fallback for empty string", () => {
    expect(formatOptionalOsDateTime("")).toBe("—");
  });

  it("returns custom fallback when provided", () => {
    expect(formatOptionalOsDateTime(null, undefined, "N/A")).toBe("N/A");
  });

  it("formats a valid timestamp", () => {
    const result = formatOptionalOsDateTime("2026-04-15T03:00:00.000Z");
    expect(result).not.toBe("—");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getOsTimeMs", () => {
  it("returns a numeric timestamp for a valid ISO string", () => {
    const ms = getOsTimeMs("2026-04-15T03:00:00.000Z");
    expect(ms).toBe(new Date("2026-04-15T03:00:00.000Z").getTime());
  });

  it("returns NaN for an invalid string", () => {
    expect(getOsTimeMs("not-a-date")).toBeNaN();
  });

  it("normalizes space-separated datetime to UTC", () => {
    const ms = getOsTimeMs("2026-04-15 03:00:00");
    expect(ms).toBe(new Date("2026-04-15T03:00:00Z").getTime());
  });

  it("handles timestamps with positive timezone offset", () => {
    const ms = getOsTimeMs("2026-04-15T03:00:00+08:00");
    expect(ms).toBe(new Date("2026-04-15T03:00:00+08:00").getTime());
  });
});

// Feature: project-audit-optimization, Property 7: 時間戳格式化有效性
describe("formatOsDateTime — validity", () => {
  /**
   * **Validates: Requirements 12.6**
   *
   * For valid ISO 8601 timestamps, output is a localized string;
   * for invalid timestamps, returns the original input.
   */
  it.each([
    "1970-01-01T00:00:00.000Z",
    "2000-06-15T12:30:00.000Z",
    "2026-04-15T03:00:00.000Z",
    "2099-12-31T23:59:59.000Z",
    "2024-02-29T00:00:00.000Z",
  ])("returns a localized string for valid timestamp: %s", (isoStr) => {
    const result = formatOsDateTime(isoStr);
    expect(result).not.toBe(isoStr);
    expect(result.length).toBeGreaterThan(0);
    expect(Number.isNaN(getOsTimeMs(isoStr))).toBe(false);
  });

  it.each([
    "not-a-date",
    "abc123",
    "9999-99-99T99:99:99Z",
    "2026-13-45",
    "xyz abc",
  ])("returns the original value for invalid timestamp: %s", (str) => {
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) {
      expect(formatOsDateTime(str)).toBe(str);
    }
  });
});
