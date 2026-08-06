import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./emojiPickerReactMock";
import { ItemCardEmojiPicker } from "./ItemCardEmojiPicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "changeEmojiAria") return `Change emoji for ${opts?.name ?? ""}`;
      if (key === "emojiPickerAria") return "Choose an emoji";
      if (key === "emojiClear") return "Clear";
      if (key === "emojiHint") return "hint";
      if (key === "done") return "Done";
      if (key === "dialog.close") return "Close";
      return key;
    },
  }),
}));

describe("ItemCardEmojiPicker", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    // ModalDialog portals into document.body
    document.querySelectorAll('[data-testid="item-card-emoji-dialog"]').forEach((el) => {
      el.remove();
    });
  });

  it("renders a static avatar when onSelect is omitted", () => {
    act(() => {
      root = createRoot(container);
      root.render(<ItemCardEmojiPicker emoji="🍎" name="Food" />);
    });

    expect(container.querySelector('[data-testid="item-emoji-avatar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="item-card-emoji-trigger"]')).toBeNull();
    expect(container.textContent).toContain("🍎");
  });

  it("opens the picker dialog and persists a selection without bubbling", async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const onCardClick = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <div onClick={onCardClick}>
          <ItemCardEmojiPicker emoji="📦" name="Milk" onSelect={onSelect} />
        </div>,
      );
    });

    const trigger = container.querySelector(
      '[data-testid="item-card-emoji-trigger"]',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute("aria-label")).toBe("Change emoji for Milk");

    await act(async () => {
      trigger.click();
    });

    expect(onCardClick).not.toHaveBeenCalled();
    const dialog = document.querySelector('[data-testid="item-card-emoji-dialog"]');
    expect(dialog).toBeTruthy();

    // Grid mounts after double rAF (deferred past modal paint).
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });

    const apple = document.querySelector(
      '[data-testid="emoji-option-🍎"]',
    ) as HTMLButtonElement;
    expect(apple).toBeTruthy();
    await act(async () => {
      apple.click();
    });

    expect(onSelect).toHaveBeenCalledWith("🍎");
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
