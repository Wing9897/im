import { describe, expect, it } from "vitest";
import { IMPORTANT_EVENT_EMOJI } from "../../api/timelineImportance";
import { ITEM_DATE_KIND_EMOJI } from "../items/itemCalendarProjection";
import {
  monthPreviewTitle,
  resolveCalendarLeadingGlyph,
} from "./importantEventDisplay";

describe("resolveCalendarLeadingGlyph", () => {
  it("prefers important ❗ over item-kind emoji", () => {
    expect(
      resolveCalendarLeadingGlyph({
        important: true,
        source: "item",
        itemDateKind: "expires",
      }),
    ).toEqual({ type: "important", emoji: IMPORTANT_EVENT_EMOJI });
  });

  it("returns null for purchased / expires item events", () => {
    expect(
      resolveCalendarLeadingGlyph({
        important: false,
        source: "item",
        itemDateKind: "expires",
      }),
    ).toBeNull();
    expect(
      resolveCalendarLeadingGlyph({
        important: false,
        source: "item",
        itemDateKind: "purchased",
      }),
    ).toBeNull();
  });

  it("returns remind emoji for item remind events", () => {
    expect(
      resolveCalendarLeadingGlyph({
        important: false,
        source: "item",
        itemDateKind: "remind",
      }),
    ).toEqual({
      type: "item",
      emoji: ITEM_DATE_KIND_EMOJI.remind,
      itemDateKind: "remind",
    });
  });

  it("returns null for ordinary non-item events", () => {
    expect(
      resolveCalendarLeadingGlyph({
        important: false,
        source: "user",
      }),
    ).toBeNull();
  });

  it("returns important marker for non-item important events", () => {
    expect(
      resolveCalendarLeadingGlyph({
        important: true,
        source: "user",
      }),
    ).toEqual({ type: "important", emoji: IMPORTANT_EVENT_EMOJI });
  });
});

describe("monthPreviewTitle", () => {
  it("strips purchase / expiry prefixes; keeps remind prefix", () => {
    expect(
      monthPreviewTitle({
        title: "購入 · milk",
        source: "item",
        itemDateKind: "purchased",
      }),
    ).toBe("milk");
    expect(
      monthPreviewTitle({
        title: "結束 · milk",
        source: "item",
        itemDateKind: "expires",
      }),
    ).toBe("milk");
    expect(
      monthPreviewTitle({
        title: "提醒 · milk",
        source: "item",
        itemDateKind: "remind",
      }),
    ).toBe("提醒 · milk");
  });
});
