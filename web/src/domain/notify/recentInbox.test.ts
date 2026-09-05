import { afterEach, describe, expect, it } from "vitest";
import {
  appendRecentInbox,
  clearRecentInbox,
  dismissRecentInboxEntry,
  loadRecentInbox,
  loadRecentInboxDismissedKeys,
  markRecentInboxRead,
  setRecentInboxOpen,
  unreadRecentInboxCount,
} from "./recentInbox";
import { resetRecentInboxForTests } from "./recentInbox.testing";
describe("recentInbox", () => {
  afterEach(() => {
    resetRecentInboxForTests();
  });

  it("appends, dedupes, and counts unread", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z");
    appendRecentInbox(
      {
        dedupeKey: "e1::60::t",
        eventId: "e1",
        title: "Standup",
        startTime: "2026-08-14T13:00:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    appendRecentInbox(
      {
        dedupeKey: "e1::60::t",
        eventId: "e1",
        title: "Standup again",
        startTime: "2026-08-14T13:00:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    expect(loadRecentInbox(now)).toHaveLength(1);
    expect(unreadRecentInboxCount(now)).toBe(1);
    markRecentInboxRead(now);
    expect(unreadRecentInboxCount(now)).toBe(0);
  });

  it("marks new rows read when the drawer is already open", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z");
    setRecentInboxOpen(true);
    appendRecentInbox(
      {
        dedupeKey: "open-1",
        eventId: "e2",
        title: "While open",
        startTime: "2026-08-14T13:00:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    expect(unreadRecentInboxCount(now)).toBe(0);
    expect(loadRecentInbox(now)[0]?.read).toBe(true);
  });

  it("drops entries older than 24h", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z");
    appendRecentInbox(
      {
        dedupeKey: "old",
        eventId: "old",
        title: "Yesterday",
        startTime: "2026-08-13T10:00:00.000Z",
        remindAtMs: now - 25 * 60 * 60_000,
        announcedAtMs: now - 25 * 60 * 60_000,
      },
      now - 25 * 60 * 60_000,
    );
    expect(loadRecentInbox(now)).toEqual([]);
  });

  it("dismisses one row and keeps others", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z");
    appendRecentInbox(
      {
        dedupeKey: "keep",
        eventId: "keep",
        title: "Keep",
        startTime: "2026-08-14T13:00:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    appendRecentInbox(
      {
        dedupeKey: "drop",
        eventId: "drop",
        title: "Drop",
        startTime: "2026-08-14T13:30:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    dismissRecentInboxEntry("drop", now);
    expect(loadRecentInbox(now).map((row) => row.dedupeKey)).toEqual(["keep"]);
    expect(unreadRecentInboxCount(now)).toBe(1);
    expect(loadRecentInboxDismissedKeys(now)).toEqual(["drop"]);
  });

  it("clear-all hides every row and zeros the unread badge", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z");
    appendRecentInbox(
      {
        dedupeKey: "a",
        eventId: "a",
        title: "A",
        startTime: "2026-08-14T13:00:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    appendRecentInbox(
      {
        dedupeKey: "b",
        eventId: "b",
        title: "B",
        startTime: "2026-08-14T14:00:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    clearRecentInbox(now);
    expect(loadRecentInbox(now)).toEqual([]);
    expect(unreadRecentInboxCount(now)).toBe(0);
    expect(loadRecentInboxDismissedKeys(now).sort()).toEqual(["a", "b"]);
  });

  it("does not re-insert a dismissed key (fired keys stay elsewhere)", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z");
    appendRecentInbox(
      {
        dedupeKey: "e1::60::t",
        eventId: "e1",
        title: "Standup",
        startTime: "2026-08-14T13:00:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    dismissRecentInboxEntry("e1::60::t", now);
    appendRecentInbox(
      {
        dedupeKey: "e1::60::t",
        eventId: "e1",
        title: "Standup again",
        startTime: "2026-08-14T13:00:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    expect(loadRecentInbox(now)).toEqual([]);
    expect(unreadRecentInboxCount(now)).toBe(0);
  });

  it("reads legacy array storage without dismissed ids", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z");
    window.localStorage.setItem(
      "im.notify.recentInbox",
      JSON.stringify([
        {
          dedupeKey: "legacy",
          eventId: "legacy",
          title: "Legacy",
          startTime: "2026-08-14T13:00:00.000Z",
          remindAtMs: now,
          announcedAtMs: now,
          read: false,
        },
      ]),
    );
    expect(loadRecentInbox(now)).toHaveLength(1);
    expect(loadRecentInbox(now)[0]?.title).toBe("Legacy");
    expect(loadRecentInboxDismissedKeys(now)).toEqual([]);
  });

  it("prunes dismissed ids after 24h so a later announce can show again", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z");
    appendRecentInbox(
      {
        dedupeKey: "later",
        eventId: "later",
        title: "Later",
        startTime: "2026-08-14T13:00:00.000Z",
        remindAtMs: now,
      },
      now,
    );
    dismissRecentInboxEntry("later", now);
    const later = now + 25 * 60 * 60_000;
    expect(loadRecentInboxDismissedKeys(later)).toEqual([]);
    appendRecentInbox(
      {
        dedupeKey: "later",
        eventId: "later",
        title: "Later again",
        startTime: "2026-08-15T13:00:00.000Z",
        remindAtMs: later,
      },
      later,
    );
    expect(loadRecentInbox(later)).toHaveLength(1);
  });
});
