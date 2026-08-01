import { describe, expect, it, beforeEach } from "vitest";

import type { RecurrenceConfig } from "../types/calendar";
import { buildRRule, parseRRule } from "./rrule";
import { validateRRuleConfig } from "./rruleValidation";
import i18n from "../i18n";
import { setAppLocale } from "../i18n/locale";

const base: RecurrenceConfig = {
  freq: "weekly",
  interval: 1,
  byDay: [],
  byMonthDay: [],
  byMonth: [],
  ordinal: null,
  end: { type: "never", until: null, count: null },
};

describe("validateRRuleConfig", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("accepts valid daily config", () => {
    const result = validateRRuleConfig({ ...base, freq: "daily" });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.rruleString).toBe("FREQ=DAILY");
  });

  it("rejects weekly config with empty byDay", () => {
    const result = validateRRuleConfig({ ...base, freq: "weekly", byDay: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.byDay).toBe(String(i18n.t("tasks.recurrence.errors.byDay")));
    expect(result.rruleString).toBeNull();
  });
});

describe("buildRRule", () => {
  it("emits uppercase FREQ and omits INTERVAL when 1", () => {
    expect(buildRRule({ ...base, freq: "daily" })).toBe("FREQ=DAILY");
  });

  it("includes INTERVAL and BYDAY in order", () => {
    expect(
      buildRRule({ ...base, freq: "weekly", interval: 2, byDay: ["MO", "WE"] }),
    ).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE");
  });

  it("prefixes BYDAY entries with the ordinal", () => {
    expect(
      buildRRule({ ...base, freq: "monthly", ordinal: -1, byDay: ["FR"] }),
    ).toBe("FREQ=MONTHLY;BYDAY=-1FR");
  });

  it("emits BYMONTHDAY and BYMONTH", () => {
    expect(
      buildRRule({
        ...base,
        freq: "yearly",
        byMonthDay: [15, -1],
        byMonth: [1, 12],
      }),
    ).toBe("FREQ=YEARLY;BYMONTHDAY=15,-1;BYMONTH=1,12");
  });

  it("emits COUNT for a count end condition", () => {
    expect(
      buildRRule({ ...base, end: { type: "count", count: 5 } }),
    ).toBe("FREQ=WEEKLY;COUNT=5");
  });

  it("emits UNTIL in RFC 5545 basic UTC format", () => {
    expect(
      buildRRule({
        ...base,
        end: { type: "until", until: "2025-12-31T23:59:59Z" },
      }),
    ).toBe("FREQ=WEEKLY;UNTIL=20251231T235959Z");
  });
});

describe("parseRRule", () => {
  it("parses FREQ, INTERVAL and BYDAY", () => {
    expect(parseRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE")).toEqual({
      freq: "weekly",
      interval: 2,
      byDay: ["MO", "WE"],
      byMonthDay: [],
      byMonth: [],
      ordinal: null,
      end: { type: "never", until: null, count: null },
    });
  });

  it("extracts the ordinal from prefixed BYDAY entries", () => {
    const cfg = parseRRule("FREQ=MONTHLY;BYDAY=-1FR");
    expect(cfg.ordinal).toBe(-1);
    expect(cfg.byDay).toEqual(["FR"]);
  });

  it("defaults INTERVAL to 1 when absent", () => {
    expect(parseRRule("FREQ=DAILY").interval).toBe(1);
  });

  it("parses UNTIL back into RFC 3339", () => {
    const cfg = parseRRule("FREQ=WEEKLY;UNTIL=20251231T235959Z");
    expect(cfg.end).toEqual({
      type: "until",
      until: "2025-12-31T23:59:59Z",
      count: null,
    });
  });

  it("rejects an RRULE: prefix", () => {
    expect(() => parseRRule("RRULE:freq=daily;count=3")).toThrow(/RRULE:/);
  });

  it("parses lowercase keys without a prefix", () => {
    expect(parseRRule("freq=daily;count=3").end).toEqual({
      type: "count",
      until: null,
      count: 3,
    });
  });
});

const roundTripCases: RecurrenceConfig[] = [
  base,
  { ...base, freq: "daily", interval: 1 },
  { ...base, freq: "weekly", interval: 2, byDay: ["MO", "WE"] },
  { ...base, freq: "monthly", ordinal: -1, byDay: ["FR"] },
  {
    ...base,
    freq: "yearly",
    byMonthDay: [15, -1],
    byMonth: [1, 12],
  },
  { ...base, end: { type: "count", until: null, count: 5 } },
  {
    ...base,
    end: { type: "until", until: "2025-12-31T23:59:59Z", count: null },
  },
  { ...base, freq: "daily", interval: 999 },
];

describe("buildRRule / parseRRule — round-trip validity", () => {
  it.each(roundTripCases)(
    "buildRRule produces a non-empty RRULE the parser accepts",
    (config) => {
      const rrule = buildRRule(config);

      expect(rrule.length).toBeGreaterThan(0);
      expect(rrule.startsWith("FREQ=")).toBe(true);
      for (const segment of rrule.split(";")) {
        expect(segment.length).toBeGreaterThan(0);
        expect(segment).toContain("=");
      }

      const parsed = parseRRule(rrule);
      expect(parsed.freq).toBe(config.freq);
      expect(buildRRule(parsed)).toBe(rrule);
    },
  );

  it.each(roundTripCases)(
    "parseRRule(buildRRule(config)) is equivalent to the original config",
    (config) => {
      const parsed = parseRRule(buildRRule(config));

      expect(parsed.freq).toBe(config.freq);
      expect(parsed.interval).toBe(config.interval);
      expect(parsed.byDay).toEqual(config.byDay);
      expect(parsed.byMonthDay).toEqual(config.byMonthDay);
      expect(parsed.byMonth).toEqual(config.byMonth);

      if (config.byDay.length > 0 && config.ordinal != null) {
        expect(parsed.ordinal).toBe(config.ordinal);
      } else {
        expect(parsed.ordinal).toBeNull();
      }

      expect(parsed.end.type).toBe(config.end.type);
      if (config.end.type === "until" && config.end.until != null) {
        expect(new Date(parsed.end.until!).getTime()).toBe(
          new Date(config.end.until).getTime(),
        );
      } else if (config.end.type === "count") {
        expect(parsed.end.count).toBe(config.end.count);
      } else {
        expect(parsed.end.until).toBeNull();
        expect(parsed.end.count).toBeNull();
      }
    },
  );
});
