import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetch, mockPut } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("../../api/uiPrefs", () => ({
  fetchTimelineAnnotations: (...args: unknown[]) => mockFetch(...args),
  putTimelineAnnotations: (...args: unknown[]) => mockPut(...args),
}));

const {
  hydrateTimelineAnnotations,
  resetTimelineAnnotationsCacheForTests,
  saveTimelineAnnotations,
} = await import("./timelineAnnotationsStore");

describe("timelineAnnotationsStore", () => {
  beforeEach(() => {
    resetTimelineAnnotationsCacheForTests();
    localStorage.clear();
    mockFetch.mockReset();
    mockPut.mockReset();
  });

  afterEach(() => {
    resetTimelineAnnotationsCacheForTests();
    localStorage.clear();
  });

  it("hydrates from server", async () => {
    mockFetch.mockResolvedValue({
      configured: true,
      eventStatuses: { evt: "confirmed" },
      eventTimeOverrides: {
        evt: { startTime: "2026-07-24T10:00:00Z", endTime: null },
      },
    });

    const data = await hydrateTimelineAnnotations();
    expect(data.eventStatuses).toEqual({ evt: "confirmed" });
    expect(data.eventTimeOverrides.evt?.startTime).toBe("2026-07-24T10:00:00Z");
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("uses empty defaults when server is unset", async () => {
    mockFetch.mockResolvedValue({
      configured: false,
      eventStatuses: null,
      eventTimeOverrides: null,
    });

    const data = await hydrateTimelineAnnotations();
    expect(data.eventStatuses).toEqual({});
    expect(data.eventTimeOverrides).toEqual({});
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("saveTimelineAnnotations writes to the API", async () => {
    mockPut.mockResolvedValue({
      configured: true,
      eventStatuses: { a: "pending" },
      eventTimeOverrides: {},
    });
    const ok = await saveTimelineAnnotations({
      eventStatuses: { a: "pending" },
      eventTimeOverrides: {},
    });
    expect(ok).toBe(true);
    expect(mockPut).toHaveBeenCalledWith({
      eventStatuses: { a: "pending" },
      eventTimeOverrides: {},
    });
  });
});
