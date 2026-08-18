import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import type { DailyHoliday } from "../../../hooks/useMonthHolidays";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";
import { TimelineHolidayChip } from "./TimelineHolidayChip";

const DAY = new Date(2025, 0, 1);

function holiday(overrides: Partial<DailyHoliday> = {}): DailyHoliday {
  return {
    date: "2025-01-01",
    localName: "元旦",
    name: "New Year's Day",
    countryCode: "TW",
    isGlobal: true,
    types: ["Public"],
    ...overrides,
  };
}

function renderChip(
  overrides: Partial<Parameters<typeof TimelineHolidayChip>[0]> = {},
): HTMLDivElement {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      wrapWithI18n(
        createElement(TimelineHolidayChip, {
          day: DAY,
          holidaysByDate: { "2025-01-01": [holiday()] },
          ...overrides,
        }),
      ),
    );
  });
  return container;
}

describe("TimelineHolidayChip", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("shows full joined names in day/week headers", () => {
    const container = renderChip({
      holidaysByDate: {
        "2025-01-01": [
          holiday({ localName: "元旦" }),
          holiday({ localName: "開國紀念日", name: "Founding Day" }),
        ],
      },
    });
    const chip = container.querySelector('[data-testid="timeline-holiday-chip"]');
    expect(chip?.textContent).toBe("元旦、開國紀念日");
    expect(chip?.getAttribute("title")).toBe("節日：元旦、開國紀念日");
    expect(chip?.getAttribute("aria-label")).toBe("節日 元旦、開國紀念日");
    expect(chip?.className).toContain("im-holiday-chip");
    expect(chip?.className).not.toContain("text-accent");
  });

  it("renders nothing when the day has no holidays", () => {
    expect(
      renderChip({ holidaysByDate: {} }).querySelector('[data-testid="timeline-holiday-chip"]'),
    ).toBeNull();
  });
});
