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
  WEATHER_CACHE_MS,
  forecastIntersection,
  resetWeatherCachesForTests,
  resolveWeatherLocation,
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
  const { weatherByDate, error, loading, refresh } = useMonthWeather(enabled, days);
  return createElement(
    "output",
    {
      "data-error": error ?? "",
      "data-loading": loading ? "1" : "0",
      "data-testid": "weather-probe",
      onClick: () => refresh(),
    },
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
    resetWeatherCachesForTests();
    mockFetchSettings.mockReset();
    mockFetchForecast.mockReset();
  });

  afterEach(() => {
    resetWeatherCachesForTests();
    vi.useRealTimers();
  });

  it("maps the default Taiwan system timezone to a geocodable city", () => {
    expect(systemLocationFromTimezone("Asia/Taipei")).toBe("臺北");
    expect(systemLocationFromTimezone("UTC")).toBe("臺北");
  });

  it("resolves follow-system to the mapped city and keeps an explicit region", () => {
    expect(resolveWeatherLocation("system", "Asia/Tokyo")).toBe("東京");
    expect(resolveWeatherLocation("system", "America/New_York")).toBe("New York");
    expect(resolveWeatherLocation("Hong Kong")).toBe("Hong Kong");
    expect(resolveWeatherLocation("  臺北  ")).toBe("臺北");
    expect(resolveWeatherLocation("")).toBe("");
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

  it("deduplicates concurrent requests and reuses successful results within TTL", async () => {
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

  it("refetches after the success TTL expires", async () => {
    mockFetchSettings.mockResolvedValue({ weatherLocation: "TTL City" });
    mockFetchForecast.mockResolvedValue({
      daily: {
        time: ["2026-07-31"],
        weather_code: [1],
        temperature_2m_max: [30],
        temperature_2m_min: [22],
      },
    });
    const days = daysFrom(new Date(2026, 6, 31), 2);
    const first = renderWeather(days);
    await settleEffects();
    expect(mockFetchForecast).toHaveBeenCalledTimes(1);
    act(() => first.root.unmount());

    vi.setSystemTime(new Date(Date.now() + WEATHER_CACHE_MS + 1));
    const second = renderWeather(days);
    await settleEffects();

    expect(mockFetchForecast).toHaveBeenCalledTimes(2);
    act(() => second.root.unmount());
  });

  it("cancels an orphaned request", async () => {
    mockFetchSettings.mockResolvedValue({ weatherLocation: "Cancel City" });
    mockFetchForecast.mockImplementation(() => new Promise(() => {}));
    const rendered = renderWeather(daysFrom(new Date(2026, 6, 31), 2));
    await settleEffects();
    const options = mockFetchForecast.mock.calls[0][3] as { signal: AbortSignal };
    const signal = options.signal;

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

  it("manual refresh bypasses the success cache and forces a provider refetch", async () => {
    mockFetchSettings.mockResolvedValue({ weatherLocation: "Refresh City" });
    mockFetchForecast.mockResolvedValue({
      daily: {
        time: ["2026-07-31"],
        weather_code: [1],
        temperature_2m_max: [30],
        temperature_2m_min: [22],
      },
    });
    const days = daysFrom(new Date(2026, 6, 31), 2);
    const rendered = renderWeather(days);
    await settleEffects();
    expect(mockFetchForecast).toHaveBeenCalledTimes(1);
    expect(mockFetchForecast.mock.calls[0][3]).toMatchObject({ force: false });

    act(() => {
      rendered.container.querySelector("output")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await settleEffects();

    expect(mockFetchForecast).toHaveBeenCalledTimes(2);
    expect(mockFetchForecast.mock.calls[1][3]).toMatchObject({ force: true });
    act(() => rendered.root.unmount());
  });
});
