import type { ScheduleType } from "../../types";

/**
 * FE preset ↔ trigger-purpose RRULE mapping (mirrors server/domain/schedule.py).
 * ScheduleInput still edits presets; the API persists scheduleRrule.
 * Trigger RRULEs must never be sent to calendar expand.
 */

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export function presetToTriggerRrule(
  scheduleType: ScheduleType,
  scheduleValue: string | null,
): string {
  switch (scheduleType) {
    case "seconds_10":
      return "FREQ=SECONDLY;INTERVAL=10";
    case "hourly":
      return "FREQ=HOURLY";
    case "custom_seconds": {
      const seconds = Math.max(1, Number.parseInt(scheduleValue || "60", 10) || 60);
      return `FREQ=SECONDLY;INTERVAL=${seconds}`;
    }
    case "daily": {
      const [hh = "00", mm = "00"] = (scheduleValue || "00:00").split(":");
      return `FREQ=DAILY;BYHOUR=${Number.parseInt(hh, 10)};BYMINUTE=${Number.parseInt(mm, 10)}`;
    }
    case "weekly": {
      const [day = "0", hh = "00", mm = "00"] = (scheduleValue || "0:00:00").split(":");
      const byday = BYDAY[Number.parseInt(day, 10)] ?? "SU";
      return `FREQ=WEEKLY;BYDAY=${byday};BYHOUR=${Number.parseInt(hh, 10)};BYMINUTE=${Number.parseInt(mm, 10)}`;
    }
    default:
      return "FREQ=SECONDLY;INTERVAL=10";
  }
}

export function triggerRruleToPreset(
  rrule: string | null | undefined,
): { scheduleType: ScheduleType; scheduleValue: string | null } | null {
  if (!rrule?.trim()) return null;
  const parts = Object.fromEntries(
    rrule
      .split(";")
      .filter(Boolean)
      .map((chunk) => {
        const [key, value] = chunk.split("=", 2);
        return [key.toUpperCase(), value];
      }),
  ) as Record<string, string>;
  const freq = (parts.FREQ || "").toUpperCase();
  const interval = Number.parseInt(parts.INTERVAL || "1", 10);
  if (freq === "SECONDLY") {
    if (interval === 10) return { scheduleType: "seconds_10", scheduleValue: null };
    return { scheduleType: "custom_seconds", scheduleValue: String(interval) };
  }
  if (freq === "HOURLY" && interval === 1) {
    return { scheduleType: "hourly", scheduleValue: null };
  }
  if (freq === "DAILY" && parts.BYHOUR != null && parts.BYMINUTE != null) {
    return {
      scheduleType: "daily",
      scheduleValue: `${Number(parts.BYHOUR).toString().padStart(2, "0")}:${Number(parts.BYMINUTE).toString().padStart(2, "0")}`,
    };
  }
  if (freq === "WEEKLY" && parts.BYDAY && parts.BYHOUR != null && parts.BYMINUTE != null) {
    const day = BYDAY.indexOf(parts.BYDAY.toUpperCase() as (typeof BYDAY)[number]);
    if (day < 0) return null;
    return {
      scheduleType: "weekly",
      scheduleValue: `${day}:${Number(parts.BYHOUR).toString().padStart(2, "0")}:${Number(parts.BYMINUTE).toString().padStart(2, "0")}`,
    };
  }
  return null;
}

/** True when wire RRULE is not represented by the current FE preset fields. */
export function isUnmappedTriggerSchedule(
  scheduleType: ScheduleType,
  scheduleValue: string | null,
  scheduleRrule: string | null | undefined,
): boolean {
  const wire = scheduleRrule?.trim() || "";
  if (!wire) return false;
  return presetToTriggerRrule(scheduleType, scheduleValue) !== wire;
}
