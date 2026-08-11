import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./client";
import {
  dismissTimelineEvent,
  listTimelineDismissals,
  restoreTimelineEvent,
  timelineItemDismissalSource,
} from "./timelineDismissals";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("timeline dismissals API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps timeline item sources to dismissal sources", () => {
    expect(timelineItemDismissalSource("user")).toBe("user");
    expect(timelineItemDismissalSource("recurring")).toBe("recurring");
    expect(timelineItemDismissalSource("item_remind")).toBe("item_remind");
    expect(timelineItemDismissalSource(undefined)).toBe("analysis");
    expect(timelineItemDismissalSource("analysis")).toBe("analysis");
    expect(timelineItemDismissalSource("rrule")).toBe("analysis");
  });

  it("puts a dismissal marker", async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      source: "recurring",
      eventId: "t1:20260723T100000Z",
      dismissedAt: "2026-07-23T00:00:00Z",
    });
    await dismissTimelineEvent("recurring", "t1:20260723T100000Z");
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/calendar/dismissals", {
      source: "recurring",
      eventId: "t1:20260723T100000Z",
    });
  });

  it("restores via DELETE with query params", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    await restoreTimelineEvent("user", "evt-1");
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/api/v1/calendar/dismissals?source=user&eventId=evt-1",
    );
  });

  it("lists dismissals with optional source filter", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);
    await listTimelineDismissals("analysis");
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar/dismissals", {
      source: "analysis",
    });
  });
});
