import { describe, expect, it, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("../api/client", () => ({
  apiClient: { get: mockGet },
}));

const { fetchWeatherForecast } = await import("../api/weather");
const { systemLocationFromTimezone } = await import("./useMonthWeather");

describe("month weather", () => {
  it("maps the default Taiwan system timezone to a geocodable city", () => {
    expect(systemLocationFromTimezone("Asia/Taipei")).toBe("臺北");
    expect(systemLocationFromTimezone("UTC")).toBe("臺北");
  });

  it("requests forecasts through the backend proxy instead of Open-Meteo from the renderer", async () => {
    mockGet.mockResolvedValue({ daily: {} });

    await fetchWeatherForecast("臺北", "2026-07-01", "2026-07-31");

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/weather/forecast?"),
    );
    expect(mockGet.mock.calls[0][0]).toContain("location=%E8%87%BA%E5%8C%97");
    expect(mockGet.mock.calls[0][0]).toContain("start_date=2026-07-01");
    expect(mockGet.mock.calls[0][0]).toContain("end_date=2026-07-31");
  });
});
