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

function mockReducedMotion(matches = true) {
  return vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion") ? matches : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList,
  );
}

async function flushDeferredGrid() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

describe("EmojiPickerField", () => {
  let container: HTMLDivElement;
  let root: Root;
  let matchMediaSpy: ReturnType<typeof mockReducedMotion>;

  beforeEach(() => {
    matchMediaSpy = mockReducedMotion(true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    matchMediaSpy.mockRestore();
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

  it("opens the picker, drafts a selection, and commits on Done after exit", async () => {
    const { onChange } = await render({});
    const trigger = document.querySelector(
      '[data-testid="emoji-picker-trigger"]',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger.click();
    });

    expect(document.querySelector('[data-testid="emoji-picker-field-dialog"]')).toBeTruthy();

    await flushDeferredGrid();

    expect(document.querySelector('[data-testid="emoji-picker-grid"]')).toBeTruthy();

    const apple = document.querySelector(
      '[data-testid="emoji-option-🍎"]',
    ) as HTMLButtonElement;
    expect(apple).toBeTruthy();

    await act(async () => {
      apple.click();
    });

    // Draft only — parent value commits after exit.
    expect(onChange).not.toHaveBeenCalled();

    const done = document.querySelector(
      '[data-testid="emoji-picker-done"]',
    ) as HTMLButtonElement;
    expect(done).toBeTruthy();

    await act(async () => {
      done.click();
    });

    expect(onChange).toHaveBeenCalledWith("🍎");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[data-testid="emoji-picker-field-dialog"]')).toBeNull();

    // While latch is cleared after exit, a second open is allowed.
    await act(async () => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("blocks trigger reopen while exit animation is in progress", async () => {
    matchMediaSpy.mockRestore();
    matchMediaSpy = mockReducedMotion(false);

    const { onChange } = await render({});
    const trigger = document.querySelector(
      '[data-testid="emoji-picker-trigger"]',
    ) as HTMLButtonElement;

    await act(async () => {
      trigger.click();
    });
    await flushDeferredGrid();

    const done = document.querySelector(
      '[data-testid="emoji-picker-done"]',
    ) as HTMLButtonElement;

    await act(async () => {
      done.click();
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // Commit waits for onExited — still pending during animated exit.
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(onChange).toHaveBeenCalledWith("");
    await act(async () => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("discards draft when closing without Done", async () => {
    const { onChange } = await render({ value: "📦" });
    const trigger = document.querySelector(
      '[data-testid="emoji-picker-trigger"]',
    ) as HTMLButtonElement;

    await act(async () => {
      trigger.click();
    });
    await flushDeferredGrid();

    const apple = document.querySelector(
      '[data-testid="emoji-option-🍎"]',
    ) as HTMLButtonElement;
    await act(async () => {
      apple.click();
    });

    const dialog = document.querySelector(
      '[data-testid="emoji-picker-field-dialog"]',
    ) as HTMLElement;
    // Overlay click cancels without committing.
    await act(async () => {
      dialog.click();
    });

    expect(onChange).not.toHaveBeenCalled();
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
