import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./emojiPickerReactMock";
import { EmojiPickerPanel, resolveEmojiPickerTheme } from "./EmojiPickerPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("EmojiPickerPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("data-color-scheme");
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("resolves theme from data-theme-mode", () => {
    document.documentElement.setAttribute("data-theme-mode", "dark");
    expect(resolveEmojiPickerTheme()).toBe("dark");
    document.documentElement.setAttribute("data-theme-mode", "light");
    expect(resolveEmojiPickerTheme()).toBe("light");
  });

  it("mounts the lazy picker host with native grid", async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(EmojiPickerPanel, {
          onChange,
          height: 200,
        }),
      );
    });

    expect(container.querySelector('[data-testid="emoji-picker-grid"]')).toBeTruthy();
    // Mocked module resolves synchronously under vitest — picker body is present.
    const mock = container.querySelector('[data-testid="emoji-picker-react-mock"]');
    expect(mock).toBeTruthy();
    // Guard against regressing to apple/google (jsDelivr CDN PNGs).
    expect(mock?.getAttribute("data-emoji-style")).toBe("native");
  });
});
