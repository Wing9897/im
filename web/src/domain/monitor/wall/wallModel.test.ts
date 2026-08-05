import { beforeEach, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";

import { makeMessage } from "../../../test/messageFixtures";
import {
  advanceCarousel,
  bootstrapSlot,
  createEmptySlot,
  displayContent,
  enqueueMessage,
  refreshSlot,
  WALL_QUEUE_LIMIT,
} from "./wallModel";

function wallMessage(id: string, content = "hello") {
  return makeMessage({
    id,
    sourceId: "acc-1",
    platformId: "10001",
    channelName: "News",
    platformMessageId: `pm-${id}`,
    senderId: "u1",
    senderName: "Alice",
    content,
    timestamp: "2026-07-01T10:00:00+00:00",
    createdAt: "2026-07-01T10:00:01+00:00",
  });
}

describe("wallModel", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });
  it("bootstrapSlot keeps newest-first messages up to limit", () => {
    const messages = [wallMessage("m1"), wallMessage("m2"), wallMessage("m3")];
    const slot = bootstrapSlot(messages, 2);
    expect(slot.queue.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(slot.currentIndex).toBe(0);
    expect(slot.unseenCount).toBe(0);
  });

  it("enqueueMessage deduplicates and prepends without jumping index", () => {
    const initial = bootstrapSlot([
      wallMessage("m1"),
      wallMessage("m2"),
      wallMessage("m3"),
    ]);
    const viewing = { ...initial, currentIndex: 1 };

    const updated = enqueueMessage(viewing, wallMessage("m4"));
    expect(updated.queue[0].id).toBe("m4");
    expect(updated.currentIndex).toBe(2);
    expect(updated.unseenCount).toBe(1);

    const duplicate = enqueueMessage(updated, wallMessage("m4"));
    expect(duplicate).toBe(updated);
  });

  it("enqueueMessage drops oldest beyond limit and clamps index", () => {
    const queue = Array.from({ length: WALL_QUEUE_LIMIT }, (_, i) => wallMessage(`m${i}`));
    const slot = { queue, currentIndex: WALL_QUEUE_LIMIT - 1, unseenCount: 0 };
    const updated = enqueueMessage(slot, wallMessage("new"));
    expect(updated.queue).toHaveLength(WALL_QUEUE_LIMIT);
    expect(updated.queue[0].id).toBe("new");
    expect(updated.queue.some((m) => m.id === `m${WALL_QUEUE_LIMIT - 1}`)).toBe(false);
    expect(updated.currentIndex).toBe(WALL_QUEUE_LIMIT - 1);
  });

  it("refreshSlot preserves the visible message or clamps a removed index", () => {
    const slot = {
      queue: [wallMessage("m1"), wallMessage("m2"), wallMessage("m3")],
      currentIndex: 2,
      unseenCount: 1,
    };
    const relocated = refreshSlot(slot, [
      wallMessage("new"),
      wallMessage("m3"),
      wallMessage("m2"),
    ]);
    expect(relocated.currentIndex).toBe(1);
    expect(relocated.queue[relocated.currentIndex].id).toBe("m3");

    const clamped = refreshSlot(slot, [wallMessage("new")]);
    expect(clamped.currentIndex).toBe(0);
    expect(clamped.queue[0].id).toBe("new");
  });

  it("advanceCarousel cycles index and clears unseen on wrap", () => {
    const slot = {
      queue: [wallMessage("m1"), wallMessage("m2"), wallMessage("m3")],
      currentIndex: 2,
      unseenCount: 2,
    };
    const wrapped = advanceCarousel(slot);
    expect(wrapped.currentIndex).toBe(0);
    expect(wrapped.unseenCount).toBe(0);

    const slot2 = { ...slot, currentIndex: 0, unseenCount: 3 };
    const advanced = advanceCarousel(slot2);
    expect(advanced.currentIndex).toBe(1);
    expect(advanced.unseenCount).toBe(3);
  });

  it("displayContent falls back to media placeholder", () => {
    expect(displayContent(wallMessage("m1", ""))).toBe("（無文字內容）");
    expect(
      displayContent({
        ...wallMessage("m2", ""),
        media: { kind: "photo", mime: "image/jpeg" },
      }),
    ).toBe("[圖片]");
  });

  it("createEmptySlot returns stable defaults", () => {
    expect(createEmptySlot()).toEqual({ queue: [], currentIndex: 0, unseenCount: 0 });
  });
});
