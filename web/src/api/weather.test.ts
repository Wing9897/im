import { describe, expect, it, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("./client", () => ({
  apiClient: { get: mockGet },
}));

const { fetchWeatherForecast } = await import("./weather");

describe("weather API", () => {
  it("sends the forecast range and cancellation signal to the backend", async () => {
    mockGet.mockResolvedValue({ daily: {} });
    const controller = new AbortController();

    await fetchWeatherForecast(
      "臺北",
      "2026-07-01",
      "2026-07-16",
      controller.signal,
    );

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/weather/forecast",
      {
        location: "臺北",
        start_date: "2026-07-01",
        end_date: "2026-07-16",
      },
      { signal: controller.signal },
    );
  });
});
