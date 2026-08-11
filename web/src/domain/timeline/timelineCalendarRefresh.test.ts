import { describe, expect, it } from "vitest";

import {
  shouldTimelineRefreshForResource,
  TIMELINE_CALENDAR_RESOURCE_TYPES,
} from "./timelineCalendarRefresh";

describe("timelineCalendarRefresh", () => {
  it("lists the resource types timeline merges", () => {
    expect(TIMELINE_CALENDAR_RESOURCE_TYPES).toEqual([
      "task",
      "recurring",
      "user_event",
      "item",
      "item_category",
    ]);
  });

  it("matches calendar-affecting SSE resource types", () => {
    expect(shouldTimelineRefreshForResource("task")).toBe(true);
    expect(shouldTimelineRefreshForResource("recurring")).toBe(true);
    expect(shouldTimelineRefreshForResource("user_event")).toBe(true);
    expect(shouldTimelineRefreshForResource("item")).toBe(true);
    expect(shouldTimelineRefreshForResource("item_category")).toBe(true);
    expect(shouldTimelineRefreshForResource("workset")).toBe(false);
    expect(shouldTimelineRefreshForResource("action")).toBe(false);
  });
});
