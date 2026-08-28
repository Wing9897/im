import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  monthDayHeaderClass,
  monthDayHolidayWatermarkClass,
  monthDayNumberClass,
  monthDaySurfaceClass,
  monthDayWatermarkClass,
  monthDayWatermarkStackClass,
  monthDayWeekdayFillerClass,
  monthGridContainerClass,
  monthGridRootClass,
} from "../timelineCalendarClasses";

const here = dirname(fileURLToPath(import.meta.url));
const timelineCss = readFileSync(resolve(here, "../../../css/timeline-page.css"), "utf8");

describe("month cell CSS contract", () => {
  it("pairs semantic class names with timeline-page.css reveal / header rules", () => {
    expect(monthGridContainerClass).toContain("im-timeline-month-grid");
    expect(monthGridRootClass(false)).toBe(monthGridContainerClass);
    expect(monthGridRootClass(true)).toBe(`${monthGridContainerClass} is-revealed`);
    expect(monthDayHeaderClass).toBe("im-month-day-header");
    expect(
      monthDayNumberClass({ isCurrentMonth: true, today: false, activeDay: false }),
    ).toContain("im-month-day-number");
    expect(
      monthDayNumberClass({ isCurrentMonth: true, today: false, activeDay: false }),
    ).toContain("text-text-primary");
    expect(
      monthDayNumberClass({ isCurrentMonth: false, today: false, activeDay: false }),
    ).toContain("text-text-muted");
    expect(
      monthDayNumberClass({ isCurrentMonth: true, today: true, activeDay: false }),
    ).toContain("rounded-full");
    expect(monthDayWatermarkStackClass()).toBe("im-month-day-watermark-stack");
    expect(monthDayWatermarkStackClass(true)).toBe("im-month-day-watermark-stack is-holiday");
    expect(monthDayHolidayWatermarkClass).toBe("im-month-day-holiday-watermark");
    expect(
      monthDayWatermarkClass({ isCurrentMonth: true, today: false, activeDay: false }),
    ).toBe("im-month-day-watermark");
    expect(monthDaySurfaceClass).toContain("im-month-day-surface");

    expect(timelineCss).toContain("--im-month-day-header-h:");
    expect(timelineCss).toMatch(/\.im-month-day-header\s*\{[^}]*min-height:\s*var\(--im-month-day-header-h\)/s);
    expect(timelineCss).toMatch(
      /\.im-month-day-watermark-stack\s*\{[^}]*top:\s*calc\(var\(--im-month-day-pad-y\) \+ var\(--im-month-day-header-h\)\)/s,
    );
    expect(timelineCss).toContain(".im-timeline-month-grid.is-revealed .im-month-day-watermark");
    expect(timelineCss).toContain(".im-timeline-month-grid.is-revealed .im-month-day-events");
    expect(timelineCss).not.toContain('[data-dates-revealed="true"]');
    expect(timelineCss).toMatch(
      /\.im-timeline-month-grid\.is-revealed \.im-month-day-watermark\s*\{[\s\S]*opacity:\s*0\.4/s,
    );
    expect(timelineCss).toMatch(
      /\.im-timeline-month-grid\.is-revealed \.im-month-day-watermark\.is-today[\s\S]*color:\s*var\(--text-primary\)/s,
    );
    expect(timelineCss).not.toMatch(
      /\.im-timeline-month-grid\.is-revealed \.im-month-day-watermark\.is-today[\s\S]{0,80}color:\s*var\(--accent\)/,
    );
    expect(timelineCss).toMatch(
      /\.im-timeline-month-grid\.is-revealed \.im-month-day-events[\s\S]*visibility:\s*hidden/s,
    );
    expect(timelineCss).not.toContain(".im-timeline-month-grid.is-revealed .im-month-span-indicators");
    expect(timelineCss).not.toMatch(
      /\.im-timeline-month-grid\.is-revealed \.im-month-day-number/,
    );
    expect(timelineCss).not.toMatch(
      /\.im-timeline-month-grid\.is-revealed \.im-weather-chip/,
    );
    expect(timelineCss).not.toMatch(
      /\.im-timeline-month-grid\.is-revealed \.im-month-day-header[\s\S]{0,80}visibility:\s*hidden/,
    );
    expect(timelineCss).not.toMatch(
      /\.im-timeline-month-grid\.is-revealed \.im-month-day-surface[\s\S]{0,80}visibility:\s*hidden/,
    );
    expect(monthDayWeekdayFillerClass).toBe("im-month-day-weekday-filler");
    expect(timelineCss).toMatch(/\.im-month-day-weekday-filler\s*\{[^}]*color:\s*var\(--text-muted\)/s);
    expect(timelineCss).toMatch(/\.im-holiday-chip\s*\{[^}]*color:\s*#ef4444/s);
    expect(timelineCss).toMatch(
      /\.im-month-day-watermark-stack\.is-holiday \.im-month-day-watermark\s*\{[^}]*color:\s*var\(--im-holiday-ink\)/s,
    );
    expect(timelineCss).toMatch(
      /\.im-month-day-holiday-watermark\s*\{[\s\S]*color:\s*var\(--im-holiday-ink\)/s,
    );
    expect(timelineCss).toMatch(
      /\.im-timeline-month-grid\.is-revealed \.im-month-day-watermark-stack\.is-holiday \.im-month-day-watermark[\s\S]*color:\s*var\(--im-holiday-ink\)/s,
    );
    expect(timelineCss).toMatch(/text-overflow:\s*ellipsis/);
  });
});
