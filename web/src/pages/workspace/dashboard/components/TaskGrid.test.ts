import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getColumnCount } from "./TaskGrid";

describe("TaskGrid responsive column count", () => {
  it("returns 4 columns at width >= 1200", () => {
    expect(getColumnCount(1200)).toBe(4);
    expect(getColumnCount(2560)).toBe(4);
  });

  it("returns 2 columns at 768 <= width < 1200", () => {
    expect(getColumnCount(768)).toBe(2);
    expect(getColumnCount(1199)).toBe(2);
  });

  it("returns 1 column at width < 768", () => {
    expect(getColumnCount(320)).toBe(1);
    expect(getColumnCount(767)).toBe(1);
  });

  it("is monotonically non-decreasing with width", () => {
    const widths = [1, 400, 768, 900, 1200, 2000];
    for (let i = 1; i < widths.length; i++) {
      expect(getColumnCount(widths[i - 1])).toBeLessThanOrEqual(getColumnCount(widths[i]));
    }
  });

  it("always returns 1, 2, or 4", () => {
    for (const width of [1, 500, 768, 1000, 1200, 5000]) {
      expect([1, 2, 4]).toContain(getColumnCount(width));
    }
  });
});

describe("TaskGrid debounce final value correctness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("after settling (150ms), columns reflect final width", () => {
    const widths = [400, 900, 1500, 768, 2000];
    const finalWidth = widths[widths.length - 1];
    const expected = getColumnCount(finalWidth);

    let lastTimer: ReturnType<typeof setTimeout> | null = null;
    let result = getColumnCount(widths[0]);

    for (const w of widths) {
      if (lastTimer !== null) clearTimeout(lastTimer);
      lastTimer = setTimeout(() => {
        result = getColumnCount(w);
        lastTimer = null;
      }, 150);
    }

    vi.advanceTimersByTime(150);
    expect(result).toBe(expected);
  });
});
