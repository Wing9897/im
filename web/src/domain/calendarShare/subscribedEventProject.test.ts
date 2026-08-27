import { describe, expect, it } from "vitest";

import type { CalendarShareEvent } from "../../api/calendarShare";
import {
  calendarShareEventToTimelineItem,
  projectSubscribedTimelineItems,
} from "./subscribedEventProject";

function shareEvent(overrides: Partial<CalendarShareEvent> = {}): CalendarShareEvent {
  return {
    id: "Alice/Work:evt-1",
    source: "subscribed:Alice/Work",
    title: "Busy",
    startTime: "2025-01-15T09:00:00Z",
    endTime: "2025-01-15T10:00:00Z",
    handle: "Alice",
    slug: "Work",
    ...overrides,
  };
}

describe("calendarShareEventToTimelineItem", () => {
  it("copies seriesId from expanded subscribed occurrences onto the timeline item", () => {
    const item = calendarShareEventToTimelineItem(
      shareEvent({
        id: "Alice/Work:series-weekly:20250115T090000Z",
        title: "Weekly standup",
        seriesId: "series-weekly",
      }),
    );
    expect(item).not.toBeNull();
    expect(item!.source).toBe("subscribed:Alice/Work");
    expect(item!.seriesId).toBe("series-weekly");
    expect(item!.taskId).toBeNull();
  });

  it("builds source from handle/slug via subscribedTimelineSource", () => {
    const item = calendarShareEventToTimelineItem(shareEvent({ source: "other" }));
    expect(item).not.toBeNull();
    expect(item!.source).toBe("subscribed:Alice/Work");
  });

  it("leaves seriesId null for one-off subscribed events", () => {
    const item = calendarShareEventToTimelineItem(shareEvent());
    expect(item).not.toBeNull();
    expect(item!.seriesId).toBeNull();
  });

  it("copies timezone and isLastOccurrence without remapping source to recurring", () => {
    const item = calendarShareEventToTimelineItem(
      shareEvent({
        id: "Alice/Work:series-weekly:20250122T090000Z",
        seriesId: "series-weekly",
        timezone: "Asia/Taipei",
        isLastOccurrence: true,
      }),
    );
    expect(item).not.toBeNull();
    expect(item!.source).toBe("subscribed:Alice/Work");
    expect(item!.timezone).toBe("Asia/Taipei");
    expect(item!.isLastOccurrence).toBe(true);
  });

  it("treats blank seriesId as null so Gantt does not fake-group one-offs", () => {
    const item = calendarShareEventToTimelineItem(shareEvent({ seriesId: "  " }));
    expect(item!.seriesId).toBeNull();
  });
});

describe("projectSubscribedTimelineItems", () => {
  it("keeps seriesId only on occurrences that carry it", () => {
    const items = projectSubscribedTimelineItems([
      shareEvent({ id: "Alice/Work:one-off" }),
      shareEvent({
        id: "Alice/Work:series-weekly:20250115T090000Z",
        seriesId: "series-weekly",
        title: "Weekly standup",
      }),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]!.seriesId).toBeNull();
    expect(items[1]!.seriesId).toBe("series-weekly");
  });
});
