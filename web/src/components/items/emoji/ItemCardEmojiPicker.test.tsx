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
      if (key === "dialog.close" || key === "close") return "Close";
      return key;
    },
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

describe("ItemCardEmojiPicker", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let matchMediaSpy: ReturnType<typeof mockReducedMotion>;

  beforeEach(() => {
    matchMediaSpy = mockReducedMotion(true);
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    matchMediaSpy.mockRestore();
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
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

    await flushDeferredGrid();

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

  it("Done re-commits dirty draft when prior save failed and stays closed", async () => {
    const onSelect = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);

    act(() => {
      root = createRoot(container);
      root.render(<ItemCardEmojiPicker emoji="📦" name="Milk" onSelect={onSelect} />);
    });

    const trigger = container.querySelector(
      '[data-testid="item-card-emoji-trigger"]',
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

    await act(async () => {
      await Promise.resolve();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="item-card-emoji-dialog"]')).toBeTruthy();

    const done = document.querySelector(
      '[data-testid="emoji-picker-done"]',
    ) as HTMLButtonElement;
    expect(done.disabled).toBe(false);

    await act(async () => {
      done.click();
    });

    // Close is sync; commit runs on exited (reduced motion → sync).
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith("🍎");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[data-testid="item-card-emoji-dialog"]')).toBeNull();

    // Latch cleared after exit — can open again deliberately.
    await act(async () => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("Done closes immediately and stays closed even while save is pending", async () => {
    let resolveSave: (() => void) | undefined;
    const onSelect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    act(() => {
      root = createRoot(container);
      root.render(<ItemCardEmojiPicker emoji="📦" name="Milk" onSelect={onSelect} />);
    });

    const trigger = container.querySelector(
      '[data-testid="item-card-emoji-trigger"]',
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

    const headerClose = document.querySelector(
      '[data-testid="item-card-emoji-dialog"] [role="dialog"] button',
    ) as HTMLButtonElement;

    await act(async () => {
      headerClose.click();
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      resolveSave?.();
      await Promise.resolve();
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[data-testid="item-card-emoji-dialog"]')).toBeNull();
  });

  it("blocks trigger reopen while exit animation is in progress", async () => {
    matchMediaSpy.mockRestore();
    matchMediaSpy = mockReducedMotion(false);

    const onSelect = vi.fn().mockResolvedValue(undefined);

    act(() => {
      root = createRoot(container);
      root.render(<ItemCardEmojiPicker emoji="📦" name="Milk" onSelect={onSelect} />);
    });

    const trigger = container.querySelector(
      '[data-testid="item-card-emoji-trigger"]',
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

    await act(async () => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    await act(async () => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});
