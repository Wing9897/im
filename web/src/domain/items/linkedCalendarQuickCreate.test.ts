import { describe, expect, it } from "vitest";

import {
  buildLinkedCalendarCreateInitial,
  buildLinkedCalendarEditInitial,
  findActiveLinkedExpiryEvent,
  isLinkedExpiryTitle,
  linkedCalendarQuickIsAllDay,
  linkedCalendarQuickLabelKey,
  LINKED_CALENDAR_QUICK_KINDS,
} from "./linkedCalendarQuickCreate";

describe("linkedCalendarQuickCreate", () => {
  it("exposes only the expiry quick preset", () => {
    expect(LINKED_CALENDAR_QUICK_KINDS).toEqual(["expires"]);
  });

  it("maps label keys and all-day preset for expiry", () => {
    for (const kind of LINKED_CALENDAR_QUICK_KINDS) {
      expect(linkedCalendarQuickLabelKey(kind)).toBe(`quickLinkedCalendar.${kind}`);
    }
    expect(linkedCalendarQuickIsAllDay("expires")).toBe(true);
  });

  it("detects linked expiry titles and active events", () => {
    expect(isLinkedExpiryTitle("到期")).toBe(true);
    expect(isLinkedExpiryTitle("Expires")).toBe(true);
    expect(isLinkedExpiryTitle("Renewal")).toBe(false);

    const events = [
      { id: "a", title: "到期", dismissed: false },
      { id: "b", title: "Other", dismissed: false },
    ] as Parameters<typeof findActiveLinkedExpiryEvent>[0];
    expect(findActiveLinkedExpiryEvent(events)?.id).toBe("a");
    expect(
      findActiveLinkedExpiryEvent([{ id: "c", title: "到期", dismissed: true }] as Parameters<
        typeof findActiveLinkedExpiryEvent
      >[0]),
    ).toBeNull();
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

  it("prefills title and all-day range for expiry kind", () => {
    const now = new Date(2026, 7, 6, 14, 30, 0);
    const initial = buildLinkedCalendarCreateInitial({
      itemId: "item-1",
      worksetId: "ws-1",
      title: "expires",
      kind: "expires",
      now,
    });
    expect(initial).toEqual({
      title: "expires",
      worksetId: "ws-1",
      itemId: "item-1",
      remindBeforeDays: "",
      startTime: "2026-08-06",
      isAllDay: true,
    });
    expect(initial).not.toHaveProperty("endTime");
  });

  it("prefills remindBeforeDays from category default on create", () => {
    const initial = buildLinkedCalendarCreateInitial({
      itemId: "item-1",
      worksetId: "ws-1",
      kind: "expires",
      defaultRemindBeforeDays: 90,
    });
    expect(initial.remindBeforeDays).toBe("90");
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
      worksetId: "ws-fallback",
      isAllDay: false,
      remindBeforeDays: "2",
      itemId: "item-42",
    });
  });

  it("prefers item-form workset over stored event workset on edit", () => {
    const initial = buildLinkedCalendarEditInitial({
      event: {
        id: "ue-1",
        title: "Passport renew",
        startTime: "2026-09-01T09:00:00Z",
        endTime: "2026-09-01T10:00:00Z",
        body: "",
        location: "",
        origin: "manual",
        isAllDay: false,
        remindBeforeDays: null,
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
      fallbackWorksetId: "ws-form",
    });
    expect(initial.worksetId).toBe("ws-form");
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
