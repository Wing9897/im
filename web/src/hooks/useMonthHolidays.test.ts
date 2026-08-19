import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchSettings, mockFetchHolidays } = vi.hoisted(() => ({
  mockFetchSettings: vi.fn(),
  mockFetchHolidays: vi.fn(),
}));

vi.mock("../api/config", () => ({
  fetchSystemSettings: mockFetchSettings,
}));

vi.mock("../api/holidays", () => ({
  fetchCalendarHolidays: mockFetchHolidays,
}));

const { resetHolidayCachesForTests, useMonthHolidays } = await import("./useMonthHolidays");

function daysFrom(start: Date, count: number): Date[] {
  return Array.from(
    { length: count },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}

function HolidayHarness({ enabled = true, days }: { enabled?: boolean; days: Date[] }) {
  const { holidaysByDate, error, loading } = useMonthHolidays(enabled, days);
  return createElement(
    "output",
    {
      "data-error": error ?? "",
      "data-loading": loading ? "1" : "0",
      "data-testid": "holiday-probe",
    },
    JSON.stringify(holidaysByDate),
  );
}

function renderHolidays(days: Date[]): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(createElement(HolidayHarness, { days }));
  });
  return { container, root };
}

async function settleEffects() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

describe("month holidays", () => {
  beforeEach(() => {
    resetHolidayCachesForTests();
    mockFetchSettings.mockReset();
    mockFetchHolidays.mockReset();
  });

  afterEach(() => {
    resetHolidayCachesForTests();
  });

  it("indexes Nager holidays by date using the weather location", async () => {
    mockFetchSettings.mockResolvedValue({ weatherLocation: "臺北" });
    mockFetchHolidays.mockResolvedValue({
      year: 2026,
      location: "臺北",
      country: "TW",
      holidays: [
        {
          date: "2026-01-01",
          localName: "元旦",
          name: "New Year's Day",
          countryCode: "TW",
          isGlobal: true,
          types: ["Public"],
        },
      ],
    });

    const { container, root } = renderHolidays(daysFrom(new Date(2026, 0, 1), 3));
    await settleEffects();

    expect(mockFetchHolidays).toHaveBeenCalledWith(2026, "臺北");
    const probe = container.querySelector('[data-testid="holiday-probe"]');
    expect(JSON.parse(probe?.textContent ?? "{}")["2026-01-01"][0].localName).toBe("元旦");
    act(() => root.unmount());
  });

  it("uses the settings city for Hong Kong holidays (same SoT as weather)", async () => {
    mockFetchSettings.mockResolvedValue({ weatherLocation: "香港" });
    mockFetchHolidays.mockResolvedValue({
      year: 2026,
      location: "香港",
      country: "HK",
      holidays: [
        {
          date: "2026-09-26",
          localName: "中秋節翌日",
          name: "The day following the Chinese Mid-Autumn Festival",
          countryCode: "HK",
          isGlobal: true,
          types: ["Public"],
        },
      ],
    });

    const { container, root } = renderHolidays(daysFrom(new Date(2026, 8, 1), 30));
    await settleEffects();

    expect(mockFetchHolidays).toHaveBeenCalledWith(2026, "香港");
    const probe = container.querySelector('[data-testid="holiday-probe"]');
    expect(JSON.parse(probe?.textContent ?? "{}")["2026-09-26"][0].localName).toBe("中秋節翌日");
    act(() => root.unmount());
  });

  it("fails soft to an empty overlay when the holidays request errors", async () => {
    mockFetchSettings.mockResolvedValue({ weatherLocation: "臺北" });
    mockFetchHolidays.mockRejectedValue(new Error("nager down"));

    const { container, root } = renderHolidays(daysFrom(new Date(2026, 0, 1), 2));
    await settleEffects();

    const probe = container.querySelector('[data-testid="holiday-probe"]');
    expect(probe?.getAttribute("data-error")).toContain("nager down");
    expect(probe?.textContent).toBe("{}");
    act(() => root.unmount());
  });
});
