import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import {
  ItemEmojiAvatar,
  itemEmojiChipBackground,
} from "./ItemEmojiAvatar";
import { ItemEmojiMark } from "./ItemEmojiMark";

describe("itemEmojiChipBackground", () => {
  it("returns a soft color-mix disk for hex tints", () => {
    expect(itemEmojiChipBackground("#22C55E")).toContain("#22C55E");
    expect(itemEmojiChipBackground("#22C55E")).toContain("30%");
  });

  it("ignores blank colors", () => {
    expect(itemEmojiChipBackground(null)).toBeUndefined();
    expect(itemEmojiChipBackground("  ")).toBeUndefined();
  });
});

describe("ItemEmojiAvatar", () => {
  it("renders a round default chip", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(createElement(ItemEmojiAvatar, { emoji: "🍎" }));
    });
    const node = host.querySelector(
      '[data-testid="item-emoji-avatar"]',
    ) as HTMLElement;
    expect(node).toBeTruthy();
    expect(node.className).toContain("rounded-full");
    expect(node.getAttribute("data-emoji-chip")).toBe("default");
    act(() => root.unmount());
    host.remove();
  });

  it("applies a tinted round background when color is set", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        createElement(ItemEmojiAvatar, {
          emoji: "🍎",
          backgroundColor: "#22C55E",
        }),
      );
    });
    const node = host.querySelector(
      '[data-testid="item-emoji-avatar"]',
    ) as HTMLElement;
    expect(node.getAttribute("data-emoji-chip")).toBe("tinted");
    expect(node.style.backgroundColor).toContain("22C55E");
    act(() => root.unmount());
    host.remove();
  });
});

describe("ItemEmojiMark", () => {
  it("uses a round chip background", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(createElement(ItemEmojiMark, { emoji: "📦" }));
    });
    const node = host.querySelector(
      '[data-testid="item-emoji-mark"]',
    ) as HTMLElement;
    expect(node.className).toContain("rounded-full");
    expect(node.getAttribute("data-emoji-chip")).toBe("default");
    act(() => root.unmount());
    host.remove();
  });
});
