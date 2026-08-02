import { describe, expect, it } from "vitest";
import { legacyToTriggerRrule, triggerRruleToLegacy } from "./triggerSchedule";

describe("triggerSchedule", () => {
  it("maps presets to trigger RRULE", () => {
    expect(legacyToTriggerRrule("seconds_10", null)).toBe("FREQ=SECONDLY;INTERVAL=10");
    expect(legacyToTriggerRrule("hourly", null)).toBe("FREQ=HOURLY");
    expect(legacyToTriggerRrule("custom_seconds", "7")).toBe("FREQ=SECONDLY;INTERVAL=7");
    expect(legacyToTriggerRrule("daily", "09:30")).toBe("FREQ=DAILY;BYHOUR=9;BYMINUTE=30");
    expect(legacyToTriggerRrule("weekly", "1:14:45")).toBe(
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
      const rrule = legacyToTriggerRrule(type, value);
      expect(triggerRruleToLegacy(rrule)).toEqual({
        scheduleType: type,
        scheduleValue: value,
      });
    }
  });
});
