import { describe, expect, it } from "vitest";

import type { RecurrenceConfig } from "../../types/calendar";
import {
  dateInputToUntil,
  deriveMonthlyMode,
  sortMonthDays,
  toConfig,
  untilToDateInput,
  valueKey,
} from "./recurrenceRuleUtils";

const baseConfig = (): RecurrenceConfig => ({
  freq: "daily",
  interval: 1,
  byDay: [],
  byMonthDay: [],
  byMonth: [],
  ordinal: null,
  end: { type: "never", until: null, count: null },
});

describe("recurrenceRuleUtils", () => {
  it("toConfig parses RRULE strings and returns defaults for empty", () => {
    expect(toConfig("").freq).toBe("daily");
    expect(toConfig("FREQ=WEEKLY;INTERVAL=2").freq).toBe("weekly");
    const cfg = baseConfig();
    expect(toConfig(cfg)).toBe(cfg);
  });

  it("valueKey is stable for string and config forms", () => {
    expect(valueKey("FREQ=DAILY;INTERVAL=1")).toBe("FREQ=DAILY;INTERVAL=1");
    expect(valueKey(baseConfig())).toContain("FREQ=DAILY");
  });

  it("until date helpers round-trip YYYY-MM-DD", () => {
    expect(untilToDateInput("2026-08-09T23:59:59Z")).toBe("2026-08-09");
    expect(untilToDateInput(null)).toBe("");
    expect(dateInputToUntil("2026-08-09")).toBe("2026-08-09T23:59:59Z");
    expect(dateInputToUntil("")).toBeNull();
  });

  it("sortMonthDays puts negatives after positives", () => {
    expect(sortMonthDays([15, -1, 1, -2, 10])).toEqual([1, 10, 15, -1, -2]);
  });

  it("deriveMonthlyMode prefers weekday when ordinal + byDay set", () => {
    expect(deriveMonthlyMode(baseConfig())).toBe("monthday");
    expect(
      deriveMonthlyMode({
        ...baseConfig(),
        ordinal: 1,
        byDay: ["MO"],
      }),
    ).toBe("weekday");
  });
});
