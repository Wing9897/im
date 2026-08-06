import { describe, expect, it } from "vitest";

import {
  buildLinkedCalendarCreateInitial,
  buildLinkedCalendarEditInitial,
  linkedCalendarQuickIsAllDay,
  linkedCalendarQuickLabelKey,
  LINKED_CALENDAR_QUICK_KINDS,
} from "./linkedCalendarQuickCreate";

describe("linkedCalendarQuickCreate", () => {
  it("exposes start / expires / purchased presets", () => {
    expect(LINKED_CALENDAR_QUICK_KINDS).toEqual(["start", "expires", "purchased"]);
  });

  it("maps label keys and all-day only for expires", () => {
    expect(linkedCalendarQuickLabelKey("start")).toBe("quickLinkedCalendar.start");
    expect(linkedCalendarQuickLabelKey("expires")).toBe("quickLinkedCalendar.expires");
    expect(linkedCalendarQuickLabelKey("purchased")).toBe("quickLinkedCalendar.purchased");
    expect(linkedCalendarQuickIsAllDay("start")).toBe(false);
    expect(linkedCalendarQuickIsAllDay("expires")).toBe(true);
    expect(linkedCalendarQuickIsAllDay("purchased")).toBe(false);
  });

  it("prefills timed create defaults without a quick kind", () => {
    const now = new Date(2026, 7, 6, 14, 30, 0);
    const initial = buildLinkedCalendarCreateInitial({
      itemId: "item-1",
      worksetId: "ws-1",
      now,
    });
    expect(initial).toEqual(
      expect.objectContaining({
        title: "",
        itemId: "item-1",
        worksetId: "ws-1",
        isAllDay: false,
        remindBeforeDays: "",
      }),
    );
    expect(initial.startTime).toContain("2026-08-06");
    expect(initial.endTime).toBeTruthy();
  });

  it("prefills title and all-day range for expires", () => {
    const now = new Date(2026, 7, 6, 14, 30, 0);
    const initial = buildLinkedCalendarCreateInitial({
      itemId: "item-1",
      worksetId: "ws-1",
      title: "到期",
      kind: "expires",
      now,
    });
    expect(initial).toEqual({
      title: "到期",
      worksetId: "ws-1",
      itemId: "item-1",
      remindBeforeDays: "",
      startTime: "2026-08-06",
      isAllDay: true,
    });
    expect(initial).not.toHaveProperty("endTime");
  });

  it("prefills title as timed for start and purchased", () => {
    const now = new Date(2026, 7, 6, 9, 0, 0);
    for (const kind of ["start", "purchased"] as const) {
      const initial = buildLinkedCalendarCreateInitial({
        itemId: "item-9",
        worksetId: "__user__",
        title: kind === "start" ? "開始" : "購入",
        kind,
        now,
      });
      expect(initial.isAllDay).toBe(false);
      expect(initial.title).toBe(kind === "start" ? "開始" : "購入");
      expect(initial.itemId).toBe("item-9");
      expect(initial.endTime).toBeTruthy();
    }
  });

  it("maps a linked one-off event into edit initial", () => {
    const initial = buildLinkedCalendarEditInitial({
      event: {
        id: "ue-1",
        title: "Passport renew",
        startTime: "2026-09-01T09:00:00Z",
        endTime: "2026-09-01T10:00:00Z",
        body: "notes",
        location: "office",
        origin: "manual",
        isAllDay: false,
        remindBeforeDays: 2,
        taskId: "",
        worksetId: "ws-owned",
        itemId: "item-42",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "",
        updatedAt: "",
      },
      itemId: "item-42",
      fallbackWorksetId: "ws-fallback",
    });
    expect(initial).toEqual({
      title: "Passport renew",
      startTime: "2026-09-01T09:00:00Z",
      endTime: "2026-09-01T10:00:00Z",
      location: "office",
      body: "notes",
      worksetId: "ws-owned",
      isAllDay: false,
      remindBeforeDays: "2",
      itemId: "item-42",
    });
  });

  it("falls back workset and clears remind when unset on edit", () => {
    const initial = buildLinkedCalendarEditInitial({
      event: {
        id: "ue-2",
        title: "All day",
        startTime: "2026-08-06",
        endTime: null,
        body: "",
        location: null,
        origin: "manual",
        isAllDay: true,
        remindBeforeDays: null,
        taskId: "",
        worksetId: "",
        itemId: "item-1",
        source: "user",
        dismissed: false,
        important: false,
        createdAt: "",
        updatedAt: "",
      },
      itemId: "item-1",
      fallbackWorksetId: "ws-fallback",
    });
    expect(initial.worksetId).toBe("ws-fallback");
    expect(initial.remindBeforeDays).toBe("");
    expect(initial.isAllDay).toBe(true);
    expect(initial.location).toBe("");
    expect(initial.body).toBe("");
    expect(initial.endTime).toBe("");
  });
});
