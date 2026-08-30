import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetCalendarShareRateLimitForTests } from "../domain/calendarShare/calendarShareRateLimit";

vi.mock("./client", () => ({
  apiClient: {
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

describe("calendarShare publish rate limit", () => {
  beforeEach(() => {
    resetCalendarShareRateLimitForTests();
    vi.resetModules();
  });

  it("manual sync consumes the publish family budget", async () => {
    const { syncCalendarSharePublish } = await import("./calendarShare");
    const { consumeCalendarShareRateLimit, CalendarShareRateLimitError } = await import(
      "../domain/calendarShare/calendarShareRateLimit"
    );
    const row = {
      worksetId: "ws-1",
      slug: "Ops",
      publicVisibility: "public" as const,
      grants: [],
    };
    await syncCalendarSharePublish(row);
    await syncCalendarSharePublish(row);
    expect(() => consumeCalendarShareRateLimit("publish", 1_000)).toThrow(CalendarShareRateLimitError);
  });

  it("patches household auto-sync on /publish/auto-sync, not a workset path", async () => {
    const { apiClient } = await import("./client");
    const { patchCalendarSharePublishAutoSync } = await import("./calendarShare");
    await patchCalendarSharePublishAutoSync({ autoSync: true });
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/v1/calendar-share/publish/auto-sync",
      { autoSync: true },
    );
  });
});
