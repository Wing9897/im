import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { CalendarShareRateLimitError, resetCalendarShareRateLimitForTests } from "./calendarShareRateLimit";
import { runCalendarSharePublishPut } from "./publishWorkset";
import { resetCalendarShareCatalogForTests } from "./useCalendarShareCatalog";

const STATE = {
  worksetId: "ws-general",
  slug: "general",
  publicVisibility: "public" as const,
  grants: [],
  lastSyncAt: "2026-08-27T12:00:00Z",
  lastError: null,
  isSystemWorkset: true,
};

const LISTED = {
  ...STATE,
  worksetName: "一般",
  worksetMissing: false,
  emoji: "",
  description: "",
};

const BODY = {
  slug: "general",
  publicVisibility: "public" as const,
  grants: [],
  syncNow: true,
};

describe("runCalendarSharePublishPut", () => {
  beforeEach(() => {
    resetCalendarShareApiMocks();
    resetCalendarShareCatalogForTests();
    resetCalendarShareRateLimitForTests();
    calendarShareApiMocks.fetchCalendarShareSession.mockResolvedValue({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "wing",
      status: "connected",
    });
    calendarShareApiMocks.fetchCalendarShareSubscriptions.mockResolvedValue({
      items: [],
      ownHandle: "wing",
    });
    calendarShareApiMocks.putCalendarSharePublish.mockResolvedValue(STATE);
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({ items: [LISTED] });
  });

  it("treats IC write success as published even when the list GET fails", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockRejectedValue(
      new Error("Calendar share request failed"),
    );
    const result = await runCalendarSharePublishPut("ws-general", BODY, { worksetName: "一般" });
    expect(result.published).toBe(true);
    expect(result.listSynced).toBe(false);
    expect(result.state.lastSyncAt).toBe("2026-08-27T12:00:00Z");
    expect(result.items).toEqual([
      expect.objectContaining({ worksetId: "ws-general", slug: "general", worksetName: "一般" }),
    ]);
    expect(calendarShareApiMocks.putCalendarSharePublish).toHaveBeenCalledTimes(1);
  });

  it("treats RATE_LIMITED list GET after a successful PUT as list-not-synced, not a write failure", async () => {
    calendarShareApiMocks.fetchCalendarSharePublishList.mockRejectedValue(
      new CalendarShareRateLimitError("publishList"),
    );
    const result = await runCalendarSharePublishPut("ws-general", BODY, { worksetName: "一般" });
    expect(result.published).toBe(true);
    expect(result.listSynced).toBe(false);
    expect(result.items.some((row) => row.slug === "general")).toBe(true);
  });

  it("invalidates the catalog cache so the published card can show handle/slug without a full reload", async () => {
    await runCalendarSharePublishPut("ws-general", BODY, { worksetName: "一般" });
    expect(calendarShareApiMocks.fetchCalendarShareSession).toHaveBeenCalled();
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptions).toHaveBeenCalled();
  });

  it("marks listSynced when GET /publish includes the new slug", async () => {
    const result = await runCalendarSharePublishPut("ws-general", BODY, { worksetName: "一般" });
    expect(result.published).toBe(true);
    expect(result.listSynced).toBe(true);
    expect(result.items).toEqual([LISTED]);
  });

  it("recovers a timed-out PUT when GET publish already has lastSyncAt and no lastError", async () => {
    calendarShareApiMocks.putCalendarSharePublish.mockRejectedValue(new Error("Request timed out"));
    calendarShareApiMocks.fetchCalendarSharePublish.mockResolvedValue(STATE);
    const result = await runCalendarSharePublishPut("ws-general", BODY, { worksetName: "一般" });
    expect(result.published).toBe(true);
    expect(calendarShareApiMocks.fetchCalendarSharePublish).toHaveBeenCalledWith("ws-general");
  });

  it("rethrows a real write failure when GET publish has lastError and no lastSyncAt", async () => {
    calendarShareApiMocks.putCalendarSharePublish.mockRejectedValue(new Error("Calendar share request failed"));
    calendarShareApiMocks.fetchCalendarSharePublish.mockResolvedValue({
      ...STATE,
      lastSyncAt: null,
      lastError: "Calendar share request failed",
    });
    await expect(runCalendarSharePublishPut("ws-general", BODY)).rejects.toThrow("Calendar share request failed");
  });
});
