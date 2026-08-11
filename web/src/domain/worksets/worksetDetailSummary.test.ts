import { describe, expect, it } from "vitest";
import type { TrackableItem } from "../../api/items";
import type { UserEvent } from "../../api/userEvents";
import {
  selectSummaryExpiringItems,
  selectSummaryUserEvents,
  WORKSET_SUMMARY_LIMIT,
  worksetEventsQueryWindow,
} from "./worksetDetailSummary";

function isoDaysFromNow(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function item(partial: Partial<TrackableItem> & { id: string; title: string }): TrackableItem {
  return {
    worksetId: "ws-1",
    categoryId: null,
    expiresAt: null,
    remindBeforeDays: 7,
    notes: "",
    status: "active",
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

function event(
  partial: Partial<UserEvent> & { id: string; title: string; startTime: string },
): UserEvent {
  return {
    body: "",
    endTime: null,
    location: null,
    origin: "manual",
    isAllDay: false,
    taskId: "",
    worksetId: "ws-1",
    source: "user",
    dismissed: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

describe("selectSummaryExpiringItems", () => {
  it("keeps overdue + remind-window actives, sorts soonest first, caps N", () => {
    const rows = [
      item({ id: "far", title: "Far", expiresAt: isoDaysFromNow(40), remindBeforeDays: 7 }),
      item({ id: "soon", title: "Soon", expiresAt: isoDaysFromNow(2), remindBeforeDays: 7 }),
      item({ id: "over", title: "Over", expiresAt: isoDaysFromNow(-3), remindBeforeDays: 7 }),
      item({
        id: "arch",
        title: "Arch",
        expiresAt: isoDaysFromNow(1),
        status: "archived",
      }),
      item({ id: "mid", title: "Mid", expiresAt: isoDaysFromNow(5), remindBeforeDays: 7 }),
    ];
    const picked = selectSummaryExpiringItems(rows, 2);
    expect(picked.map((r) => r.id)).toEqual(["over", "soon"]);
  });

  it("respects WORKSET_SUMMARY_LIMIT default", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      item({
        id: `i${i}`,
        title: `I${i}`,
        expiresAt: isoDaysFromNow(i),
        remindBeforeDays: 14,
      }),
    );
    expect(selectSummaryExpiringItems(rows)).toHaveLength(WORKSET_SUMMARY_LIMIT);
  });
});

describe("selectSummaryUserEvents", () => {
  it("filters dismissed / out-of-window and sorts chronologically", () => {
    const now = new Date();
    const { start, end } = worksetEventsQueryWindow(now);
    const startMs = Date.parse(start);
    const mid = new Date(startMs + 3 * 86_400_000).toISOString();
    const later = new Date(startMs + 10 * 86_400_000).toISOString();
    const pastWindow = new Date(startMs - 86_400_000).toISOString();
    const futureWindow = new Date(Date.parse(end) + 86_400_000).toISOString();

    const picked = selectSummaryUserEvents(
      [
        event({ id: "b", title: "B", startTime: later }),
        event({ id: "a", title: "A", startTime: mid }),
        event({ id: "d", title: "D", startTime: mid, dismissed: true }),
        event({ id: "past", title: "Past", startTime: pastWindow }),
        event({ id: "far", title: "Far", startTime: futureWindow }),
      ],
      { now },
    );
    expect(picked.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("caps at limit", () => {
    const now = new Date();
    const { start } = worksetEventsQueryWindow(now);
    const base = Date.parse(start);
    const rows = Array.from({ length: 8 }, (_, i) =>
      event({
        id: `e${i}`,
        title: `E${i}`,
        startTime: new Date(base + (i + 1) * 86_400_000).toISOString(),
      }),
    );
    expect(selectSummaryUserEvents(rows, { now, limit: 3 })).toHaveLength(3);
  });
});
