import { describe, expect, it, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("./client", () => ({
  apiClient: { get: mockGet },
}));

const { fetchCalendarWindow } = await import("./calendarWindow");

describe("fetchCalendarWindow pagination abort", () => {
  it("stops the next-page loop when the signal aborts after the first page", async () => {
    const controller = new AbortController();
    let calls = 0;
    mockGet.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        controller.abort();
        return { items: [{ id: "p1" }], nextCursor: "page-2" };
      }
      throw new Error("must not fetch page 2 after abort");
    });

    await expect(
      fetchCalendarWindow(
        { startTime: "2025-01-01T00:00:00.000Z", endTime: "2025-02-01T00:00:00.000Z" },
        controller.signal,
      ),
    ).rejects.toSatisfy(
      (error: unknown) =>
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError"),
    );
    expect(calls).toBe(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
