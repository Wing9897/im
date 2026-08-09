import { describe, expect, it } from "vitest";

import { createEmojiPickerOpenLatch } from "./emojiPickerCloseGuard";

describe("emojiPickerCloseGuard latch", () => {
  it("blocks open after close until exited clears the latch", () => {
    const latch = createEmojiPickerOpenLatch();
    expect(latch.isOpenBlocked()).toBe(false);

    latch.blockOpen();
    expect(latch.isOpenBlocked()).toBe(true);

    latch.clearOpenBlock();
    expect(latch.isOpenBlocked()).toBe(false);
  });

  it("clearOpenBlock is idempotent", () => {
    const latch = createEmojiPickerOpenLatch();
    latch.clearOpenBlock();
    expect(latch.isOpenBlocked()).toBe(false);
    latch.blockOpen();
    latch.clearOpenBlock();
    latch.clearOpenBlock();
    expect(latch.isOpenBlocked()).toBe(false);
  });
});
