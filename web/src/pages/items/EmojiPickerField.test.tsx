import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./emojiPickerReactMock";
import { EmojiPickerField } from "./EmojiPickerField";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { emoji?: string }) =>
      opts?.emoji ? `${key}:${opts.emoji}` : key,
  }),
}));

describe("EmojiPickerField", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.querySelectorAll('[data-testid="emoji-picker-field-dialog"]').forEach((el) => {
      el.remove();
    });
  });

  async function render(props: {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    onChange?: (value: string) => void;
  }) {
    const onChange = props.onChange ?? vi.fn();
    await act(async () => {
      root.render(
        createElement(EmojiPickerField, {
          id: "emoji-field",
          value: props.value ?? "",
          onChange,
          disabled: props.disabled,
          placeholder: props.placeholder,
        }),
      );
    });
    return { onChange };
  }

  it("renders a compact trigger without embedding the keyboard", async () => {
    await render({});
    expect(document.querySelector('[data-testid="emoji-picker-trigger"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="emoji-picker-grid"]')).toBeNull();
    expect(document.querySelector('[data-testid="emoji-option-🍎"]')).toBeNull();
  });

  it("opens the picker dialog and selects an emoji", async () => {
    const { onChange } = await render({});
    const trigger = document.querySelector(
      '[data-testid="emoji-picker-trigger"]',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger.click();
    });

    expect(document.querySelector('[data-testid="emoji-picker-field-dialog"]')).toBeTruthy();

    // Grid mounts after double rAF (deferred past modal paint).
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });

    expect(document.querySelector('[data-testid="emoji-picker-grid"]')).toBeTruthy();

    const apple = document.querySelector(
      '[data-testid="emoji-option-🍎"]',
    ) as HTMLButtonElement;
    expect(apple).toBeTruthy();

    await act(async () => {
      apple.click();
    });

    expect(onChange).toHaveBeenCalledWith("🍎");
  });

  it("clears the current emoji from the compact row", async () => {
    const { onChange } = await render({ value: "🍎" });
    const clear = document.querySelector(
      '[data-testid="emoji-picker-clear"]',
    ) as HTMLButtonElement;
    expect(clear).toBeTruthy();

    await act(async () => {
      clear.click();
    });

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows category placeholder in preview when empty", async () => {
    await render({ placeholder: "🪪" });
    const trigger = document.querySelector(
      '[data-testid="emoji-picker-trigger"]',
    ) as HTMLButtonElement;
    expect(trigger?.textContent).toContain("🪪");
    expect(trigger?.getAttribute("aria-label")).toContain("emojiPlaceholderAria");
  });
});
