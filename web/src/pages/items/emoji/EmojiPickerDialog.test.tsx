import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../../test/i18nIdentityMock";

import "./emojiPickerReactMock";
import { EmojiPickerDialog } from "./EmojiPickerDialog";

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

/** Parent-owned open — mirrors Field/Card ownership. */
function ControlledDialog(props: {
  previewEmoji?: string;
  placeholderEmoji?: string;
  commitOnPick?: boolean;
  onPick: (emoji: string) => void;
  onClose?: () => void;
  onExited?: () => void;
}) {
  const [open, setOpen] = useState(true);
  return createElement(EmojiPickerDialog, {
    open,
    title: "Pick",
    onClose: () => {
      props.onClose?.();
      setOpen(false);
    },
    onExited: props.onExited,
    previewEmoji: props.previewEmoji ?? "",
    placeholderEmoji: props.placeholderEmoji,
    onPick: props.onPick,
    commitOnPick: props.commitOnPick,
    testId: "emoji-picker-dialog",
  });
}

describe("EmojiPickerDialog", () => {
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
    document.querySelectorAll('[data-testid="emoji-picker-dialog"]').forEach((el) => {
      el.remove();
    });
  });

  it("commits draft on Done after exit (not on grid click) by default", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const onExited = vi.fn();

    await act(async () => {
      root.render(
        createElement(ControlledDialog, { onPick, onClose, onExited }),
      );
    });

    await flushDeferredGrid();

    await act(async () => {
      (document.querySelector('[data-testid="emoji-option-🍎"]') as HTMLButtonElement).click();
    });
    expect(onPick).not.toHaveBeenCalled();

    await act(async () => {
      (document.querySelector('[data-testid="emoji-picker-done"]') as HTMLButtonElement).click();
    });

    expect(onClose).toHaveBeenCalled();
    expect(onExited).toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledWith("🍎");
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
      onPick.mock.invocationCallOrder[0],
    );
  });

  it("does not commit placeholder emoji on Done when draft stays empty", async () => {
    const onPick = vi.fn();

    await act(async () => {
      root.render(
        createElement(ControlledDialog, {
          onPick,
          placeholderEmoji: "🪪",
        }),
      );
    });

    await act(async () => {
      (document.querySelector('[data-testid="emoji-picker-done"]') as HTMLButtonElement).click();
    });

    expect(onPick).toHaveBeenCalledWith("");
  });

  it("commitOnPick applies immediately and Done re-commits dirty draft after exit", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        createElement(ControlledDialog, {
          onPick,
          onClose,
          previewEmoji: "📦",
          commitOnPick: true,
        }),
      );
    });

    await flushDeferredGrid();

    await act(async () => {
      (document.querySelector('[data-testid="emoji-option-🍎"]') as HTMLButtonElement).click();
    });
    expect(onPick).toHaveBeenCalledWith("🍎");

    await act(async () => {
      (document.querySelector('[data-testid="emoji-picker-done"]') as HTMLButtonElement).click();
    });

    expect(onPick).toHaveBeenLastCalledWith("🍎");
    expect(onClose).toHaveBeenCalled();
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
      onPick.mock.invocationCallOrder[onPick.mock.invocationCallOrder.length - 1],
    );
  });

  it("Done closes before onPick so commit cannot block dismiss", async () => {
    const onClose = vi.fn();
    const onPick = vi.fn(() => {
      expect(onClose).toHaveBeenCalled();
    });

    await act(async () => {
      root.render(createElement(ControlledDialog, { onPick, onClose }));
    });

    await act(async () => {
      (document.querySelector('[data-testid="emoji-picker-done"]') as HTMLButtonElement).click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("");
  });

  it("pointerdown Done closes without leaving a mounted shell", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(createElement(ControlledDialog, { onPick, onClose }));
    });

    const done = document.querySelector(
      '[data-testid="emoji-picker-done"]',
    ) as HTMLButtonElement;

    await act(async () => {
      done.dispatchEvent(
        new MouseEvent("pointerdown", { button: 0, bubbles: true, cancelable: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("");
    expect(document.querySelector('[data-testid="emoji-picker-dialog"]')).toBeNull();
  });
});
