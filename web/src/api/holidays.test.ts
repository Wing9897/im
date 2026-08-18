import { describe, expect, it, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("./client", () => ({
  apiClient: { get: mockGet },
}));

const { fetchCalendarHolidays } = await import("./holidays");

describe("calendar holidays API", () => {
  it("sends the weather location and year to the backend", async () => {
    mockGet.mockResolvedValue({ year: 2026, location: "臺北", country: "TW", holidays: [] });
    const controller = new AbortController();

    await fetchCalendarHolidays(2026, "臺北", { signal: controller.signal });

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/calendar/holidays",
      { year: "2026", location: "臺北" },
      { signal: controller.signal },
    );
  });
});
