import { describe, expect, it } from "vitest";

import { formatDateTime, formatDateOnly, formatTickLabel } from "./dateFormat";

describe("formatDateTime", () => {
  it("formats a known timestamp as YYYY-MM-DD HH:MM in local time", () => {
    // Use a fixed date and verify the format pattern
    const ts = new Date(2024, 0, 15, 9, 5).getTime(); // Jan 15, 2024 09:05 local
    const result = formatDateTime(ts);
    expect(result).toBe("2024-01-15 09:05");
  });

  it("pads single-digit months and days", () => {
    const ts = new Date(2024, 2, 3, 14, 30).getTime(); // Mar 3, 2024 14:30
    const result = formatDateTime(ts);
    expect(result).toBe("2024-03-03 14:30");
  });

  it("handles midnight correctly", () => {
    const ts = new Date(2024, 11, 31, 0, 0).getTime(); // Dec 31, 2024 00:00
    const result = formatDateTime(ts);
    expect(result).toBe("2024-12-31 00:00");
  });
});

describe("formatDateOnly", () => {
  it("formats a timestamp as YYYY-MM-DD", () => {
    const ts = new Date(2024, 5, 7, 15, 30).getTime(); // Jun 7, 2024
    const result = formatDateOnly(ts);
    expect(result).toBe("2024-06-07");
  });

  it("pads single-digit month and day", () => {
    const ts = new Date(2024, 0, 1).getTime(); // Jan 1
    expect(formatDateOnly(ts)).toBe("2024-01-01");
  });
});

describe("formatTickLabel", () => {
  it("returns only date part when time is midnight", () => {
    const ts = new Date(2024, 3, 10, 0, 0, 0).getTime(); // Apr 10, midnight
    expect(formatTickLabel(ts)).toBe("4/10");
  });

  it("includes HH:MM when seconds are zero but time is not midnight", () => {
    const ts = new Date(2024, 3, 10, 14, 30, 0).getTime();
    expect(formatTickLabel(ts)).toBe("4/10 14:30");
  });

  it("includes HH:MM:SS when seconds are non-zero", () => {
    const ts = new Date(2024, 3, 10, 8, 5, 45).getTime();
    expect(formatTickLabel(ts)).toBe("4/10 08:05:45");
  });

  it("does not pad month or day in the date part", () => {
    const ts = new Date(2024, 0, 5, 3, 7, 0).getTime(); // Jan 5, 03:07
    expect(formatTickLabel(ts)).toBe("1/5 03:07");
  });
});
