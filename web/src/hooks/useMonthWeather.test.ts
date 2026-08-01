import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchSettings, mockFetchForecast } = vi.hoisted(() => ({
  mockFetchSettings: vi.fn(),
  mockFetchForecast: vi.fn(),
}));

vi.mock("../api/config", () => ({
  fetchSystemSettings: mockFetchSettings,
}));

vi.mock("../api/weather", () => ({
  fetchWeatherForecast: mockFetchForecast,
}));

const {
  forecastIntersection,
  systemLocationFromTimezone,
  useMonthWeather,
} = await import("./useMonthWeather");

function daysFrom(start: Date, count: number): Date[] {
  return Array.from(
    { length: count },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}

function WeatherHarness({ enabled = true, days }: { enabled?: boolean; days: Date[] }) {
  const { weatherByDate, error } = useMonthWeather(enabled, days);
  return createElement(
    "output",
    { "data-error": error ?? "" },
    JSON.stringify(weatherByDate),
  );
}

function renderWeather(days: Date[]): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(createElement(WeatherHarness, { days }));
  });
  return { container, root };
}

async function settleEffects() {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
  });
}

describe("month weather", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 31, 12));
    mockFetchSettings.mockReset();
    mockFetchForecast.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps the default Taiwan system timezone to a geocodable city", () => {
    expect(systemLocationFromTimezone("Asia/Taipei")).toBe("臺北");
    expect(systemLocationFromTimezone("UTC")).toBe("臺北");
  });

  it("intersects visible days with the 16-day forecast window", () => {
    expect(
      forecastIntersection(
        daysFrom(new Date(2026, 6, 1), 62),
        new Date(2026, 6, 31, 18),
      ),
    ).toEqual({ startDate: "2026-07-31", endDate: "2026-08-15" });
    expect(
      forecastIntersection(
        daysFrom(new Date(2026, 5, 1), 30),
        new Date(2026, 6, 31),
      ),
    ).toBeNull();
  });

  it("does not request settings or weather when the month misses the forecast window", async () => {
    const rendered = renderWeather(daysFrom(new Date(2026, 5, 1), 30));

    await settleEffects();

    expect(mockFetchSettings).not.toHaveBeenCalled();
    expect(mockFetchForecast).not.toHaveBeenCalled();
    expect(rendered.container.textContent).toBe("{}");
    act(() => rendered.root.unmount());
  });

  it("deduplicates concurrent requests and reuses successful results", async () => {
    mockFetchSettings.mockResolvedValue({ weatherLocation: "Dedup City" });
    let resolveForecast!: (value: unknown) => void;
    mockFetchForecast.mockImplementation(
      () => new Promise((resolve) => { resolveForecast = resolve; }),
    );
    const days = daysFrom(new Date(2026, 6, 31), 3);
    const first = renderWeather(days);
    const second = renderWeather(days);
    await settleEffects();

    expect(mockFetchForecast).toHaveBeenCalledTimes(1);
    resolveForecast({
      daily: {
        time: ["2026-07-31"],
        weather_code: [1],
        temperature_2m_max: [31.6],
        temperature_2m_min: [25.4],
      },
    });
    await settleEffects();

    expect(first.container.textContent).toContain('"high":32');
    expect(second.container.textContent).toContain('"low":25');
    act(() => {
      first.root.unmount();
      second.root.unmount();
    });

    const cached = renderWeather(days);
    await settleEffects();

    expect(mockFetchForecast).toHaveBeenCalledTimes(1);
    expect(cached.container.textContent).toContain('"code":1');
    act(() => cached.root.unmount());
  });

  it("cancels an orphaned request", async () => {
    mockFetchSettings.mockResolvedValue({ weatherLocation: "Cancel City" });
    mockFetchForecast.mockImplementation(() => new Promise(() => {}));
    const rendered = renderWeather(daysFrom(new Date(2026, 6, 31), 2));
    await settleEffects();
    const signal = mockFetchForecast.mock.calls[0][3] as AbortSignal;

    act(() => rendered.root.unmount());

    expect(signal.aborted).toBe(true);
  });

  it("short-circuits repeated failures without surfacing UI state beyond the hook", async () => {
    mockFetchSettings.mockResolvedValue({ weatherLocation: "Failure City" });
    mockFetchForecast.mockRejectedValue(new Error("offline"));
    const days = daysFrom(new Date(2026, 6, 31), 2);
    const first = renderWeather(days);
    await settleEffects();

    expect(first.container.querySelector("output")?.getAttribute("data-error")).toBe("offline");
    act(() => first.root.unmount());

    const second = renderWeather(days);
    await settleEffects();

    expect(mockFetchForecast).toHaveBeenCalledTimes(1);
    expect(second.container.querySelector("output")?.getAttribute("data-error")).toBe("offline");
    act(() => second.root.unmount());
  });
});
