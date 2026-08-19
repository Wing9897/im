import { describe, expect, it } from "vitest";

import {
  lookupScheduleEmoji,
  scheduleEmojiKeyForTimelineEvent,
  scheduleEmojiStorageKey,
} from "./scheduleEmoji";

describe("scheduleEmoji keys", () => {
  it("builds oneOff/recurring storage keys from the owning id", () => {
    expect(scheduleEmojiStorageKey("oneOff", "ue-1")).toBe("oneOff:ue-1");
    expect(scheduleEmojiStorageKey("recurring", " rec-1 ")).toBe("recurring:rec-1");
  });

  it("maps user_events to oneOff:<id>", () => {
    expect(
      scheduleEmojiKeyForTimelineEvent({ id: "ue-1", source: "user" }),
    ).toBe("oneOff:ue-1");
  });

  it("maps RRULE occurrences to recurring:<seriesId>, not occurrence id", () => {
    expect(
      scheduleEmojiKeyForTimelineEvent({
        id: "rec-1:20260819T010000Z",
        source: "recurring",
        seriesId: "rec-1",
      }),
    ).toBe("recurring:rec-1");
    expect(
      scheduleEmojiKeyForTimelineEvent({
        id: "rec-1:20260819T010000Z",
        source: "recurring",
        seriesId: "",
      }),
    ).toBeNull();
  });

  it("returns null for analysis / item_remind / missing ids", () => {
    expect(
      scheduleEmojiKeyForTimelineEvent({ id: "an-1", source: "analysis" }),
    ).toBeNull();
    expect(
      scheduleEmojiKeyForTimelineEvent({
        id: "item:r",
        source: "item_remind",
        seriesId: "ignored",
      }),
    ).toBeNull();
    expect(scheduleEmojiKeyForTimelineEvent({ id: "  ", source: "user" })).toBeNull();
  });

  it("looks up the glyph from the shared map", () => {
    const emojis = {
      "oneOff:ue-1": "🎂",
      "recurring:rec-1": "🔁",
      "recurring:rec-1:20260819T010000Z": "❌",
    };
    expect(
      lookupScheduleEmoji(emojis, { id: "ue-1", source: "user" }),
    ).toBe("🎂");
    expect(
      lookupScheduleEmoji(emojis, {
        id: "rec-1:20260819T010000Z",
        source: "recurring",
        seriesId: "rec-1",
      }),
    ).toBe("🔁");
    expect(
      lookupScheduleEmoji(emojis, { id: "an-1", source: "analysis" }),
    ).toBe("");
  });
});
