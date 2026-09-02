import { act, createElement, type MutableRefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAnchoredMenu, type UseAnchoredMenuResult } from "./useAnchoredMenu";

let latest: UseAnchoredMenuResult | null = null;

function Harness({ enabled = true }: { enabled?: boolean }) {
  latest = useAnchoredMenu({ enabled, restoreFocusOnEscape: true });
  return createElement(
    "div",
    null,
    createElement("button", {
      type: "button",
      "data-testid": "anchor",
      ref: (el: HTMLButtonElement | null) => {
        (latest!.anchorRef as MutableRefObject<HTMLElement | null>).current = el;
      },
      onClick: latest.toggle,
    }, "open"),
    latest.open
      ? createElement(
          "div",
          {
            "data-testid": "menu",
            ref: (el: HTMLDivElement | null) => {
              (latest!.menuRef as MutableRefObject<HTMLElement | null>).current = el;
            },
          },
          "item",
        )
      : null,
    createElement("button", { type: "button", "data-testid": "outside" }, "outside"),
  );
}

describe("useAnchoredMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    latest = null;
  });

  it("toggles open, places the menu, and closes on Escape", () => {
    act(() => {
      root.render(createElement(Harness));
    });

    expect(latest!.open).toBe(false);
    expect(container.querySelector('[data-testid="menu"]')).toBeNull();

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="anchor"]')!.click();
    });
    expect(latest!.open).toBe(true);
    expect(container.querySelector('[data-testid="menu"]')).toBeTruthy();
    expect(latest!.menuPos).toEqual(
      expect.objectContaining({ top: expect.any(Number), left: expect.any(Number) }),
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(latest!.open).toBe(false);
  });

  it("closes on outside mousedown", () => {
    act(() => {
      root.render(createElement(Harness));
    });
    act(() => {
      latest!.setOpen(true);
    });
    expect(latest!.open).toBe(true);

    act(() => {
      container
        .querySelector('[data-testid="outside"]')!
        .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(latest!.open).toBe(false);
  });

  it("does not open when disabled", () => {
    act(() => {
      root.render(createElement(Harness, { enabled: false }));
    });
    act(() => {
      latest!.setOpen(true);
      latest!.toggle();
    });
    expect(latest!.open).toBe(false);
  });
});
