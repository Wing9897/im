import { describe, expect, it } from "vitest";
import {
  LEGACY_UNMAPPED_SCHEDULE_TYPE,
  presetToTriggerRrule,
  triggerRruleToPreset,
} from "./triggerSchedule";

describe("triggerSchedule", () => {
  it("maps presets to trigger RRULE", () => {
    expect(presetToTriggerRrule("seconds_10", null)).toBe("FREQ=SECONDLY;INTERVAL=10");
    expect(presetToTriggerRrule("hourly", null)).toBe("FREQ=HOURLY");
    expect(presetToTriggerRrule("custom_seconds", "7")).toBe("FREQ=SECONDLY;INTERVAL=7");
    expect(presetToTriggerRrule("daily", "09:30")).toBe("FREQ=DAILY;BYHOUR=9;BYMINUTE=30");
    expect(presetToTriggerRrule("weekly", "1:14:45")).toBe(
      "FREQ=WEEKLY;BYDAY=MO;BYHOUR=14;BYMINUTE=45",
    );
  });

  it("round-trips common presets", () => {
    for (const [type, value] of [
      ["seconds_10", null],
      ["hourly", null],
      ["custom_seconds", "42"],
      ["daily", "09:30"],
      ["weekly", "1:14:45"],
    ] as const) {
      const rrule = presetToTriggerRrule(type, value);
      expect(triggerRruleToPreset(rrule)).toEqual({
        scheduleType: type,
        scheduleValue: value,
      });
    }
  });

  it("does not map minutely / non-preset RRULEs", () => {
    expect(triggerRruleToPreset("FREQ=MINUTELY;INTERVAL=1")).toBeNull();
    expect(LEGACY_UNMAPPED_SCHEDULE_TYPE).toBe("hourly");
  });
});
