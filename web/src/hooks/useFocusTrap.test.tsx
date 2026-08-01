import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFocusTrap } from "./useFocusTrap";

/* ------------------------------------------------------------------ */
/*  Test harness                                                       */
/* ------------------------------------------------------------------ */

let hookRef: React.RefObject<HTMLDivElement | null> | null = null;

function Harness({
  active,
  onEscape,
}: {
  active: boolean;
  onEscape?: () => void;
}) {
  const ref = useFocusTrap({ active, onEscape });
  hookRef = ref;
  return null;
}

let container: HTMLElement;
let root: Root;

function renderHarness(active: boolean, onEscape?: () => void) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<Harness active={active} onEscape={onEscape} />);
  });
}

function rerenderHarness(active: boolean, onEscape?: () => void) {
  act(() => {
    root.render(<Harness active={active} onEscape={onEscape} />);
  });
}

function cleanup() {
  act(() => {
    root.unmount();
  });
  container.remove();
  hookRef = null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build a dialog-like container with focusable children and attach the ref. */
function buildDialog(...elements: HTMLElement[]): HTMLDivElement {
  const dialog = document.createElement("div");
  for (const el of elements) dialog.appendChild(el);
  document.body.appendChild(dialog);
  // Point the hook's ref at this container
  (hookRef as any).current = dialog;
  return dialog;
}

function makeButton(label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  return btn;
}

function pressKey(
  target: EventTarget,
  key: string,
  opts: Partial<KeyboardEventInit> = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  target.dispatchEvent(event);
  return event;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("useFocusTrap", () => {
  afterEach(() => {
    // Clean up any leftover dialog containers
    document.querySelectorAll("body > div").forEach((el) => {
      if (el !== container) el.remove();
    });
    if (container?.parentNode) cleanup();
  });

  it("moves focus to the first focusable element when activated", () => {
    renderHarness(false);

    const btn1 = makeButton("First");
    const btn2 = makeButton("Second");
    const dialog = buildDialog(btn1, btn2);

    // Activate the trap
    rerenderHarness(true);

    expect(document.activeElement).toBe(btn1);

    dialog.remove();
  });

  it("cycles Tab from the last focusable element back to the first", () => {
    renderHarness(false);

    const btn1 = makeButton("First");
    const btn2 = makeButton("Second");
    const btn3 = makeButton("Third");
    const dialog = buildDialog(btn1, btn2, btn3);

    rerenderHarness(true);

    // Focus the last element
    act(() => btn3.focus());
    expect(document.activeElement).toBe(btn3);

    // Press Tab on the last element — should wrap to first
    pressKey(dialog, "Tab", { shiftKey: false });

    expect(document.activeElement).toBe(btn1);

    dialog.remove();
  });

  it("cycles Shift+Tab from the first focusable element to the last", () => {
    renderHarness(false);

    const btn1 = makeButton("First");
    const btn2 = makeButton("Second");
    const btn3 = makeButton("Third");
    const dialog = buildDialog(btn1, btn2, btn3);

    rerenderHarness(true);

    // Focus should already be on the first element
    expect(document.activeElement).toBe(btn1);

    // Press Shift+Tab on the first element — should wrap to last
    pressKey(dialog, "Tab", { shiftKey: true });

    expect(document.activeElement).toBe(btn3);

    dialog.remove();
  });

  it("calls onEscape when Escape key is pressed", () => {
    const onEscape = vi.fn();
    renderHarness(false, onEscape);

    const btn1 = makeButton("OK");
    const dialog = buildDialog(btn1);

    rerenderHarness(true, onEscape);

    expect(onEscape).not.toHaveBeenCalled();

    pressKey(dialog, "Escape");

    expect(onEscape).toHaveBeenCalledTimes(1);

    dialog.remove();
  });

  it("restores focus to the trigger element when deactivated", () => {
    // Create an external trigger button and focus it
    const trigger = makeButton("Open Dialog");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    renderHarness(false);

    const btn1 = makeButton("Inside");
    const dialog = buildDialog(btn1);

    // Activate — focus moves into the dialog
    rerenderHarness(true);
    expect(document.activeElement).toBe(btn1);

    // Deactivate — focus should restore to the trigger
    rerenderHarness(false);
    expect(document.activeElement).toBe(trigger);

    dialog.remove();
    trigger.remove();
  });
});
