import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadEmojiPickerModule,
  preloadEmojiPickerModule,
  scheduleEmojiPickerPreload,
} from "./emojiPickerLoader";
import { __resetEmojiPickerLoaderForTests } from "./emojiPickerLoader.testing";
vi.mock("emoji-picker-react", () => ({
  __esModule: true,
  default: () => null,
  Theme: { DARK: "dark", LIGHT: "light", AUTO: "auto" },
  EmojiStyle: { NATIVE: "native" },
}));

describe("emojiPickerLoader", () => {
  afterEach(() => {
    __resetEmojiPickerLoaderForTests();
  });

  it("caches the dynamic import promise", async () => {
    const a = loadEmojiPickerModule();
    const b = loadEmojiPickerModule();
    expect(a).toBe(b);
    const mod = await a;
    expect(mod.default).toBeTypeOf("function");
  });

  it("preloadEmojiPickerModule is idempotent and does not throw", () => {
    expect(() => preloadEmojiPickerModule()).not.toThrow();
    expect(() => preloadEmojiPickerModule()).not.toThrow();
  });

  it("scheduleEmojiPickerPreload returns a cancel function", () => {
    const cancel = scheduleEmojiPickerPreload(50);
    expect(typeof cancel).toBe("function");
    expect(() => cancel()).not.toThrow();
  });
});
