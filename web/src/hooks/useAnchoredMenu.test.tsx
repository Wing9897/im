import { act, createElement, type MutableRefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  placeAnchoredMenu,
  useAnchoredMenu,
  type UseAnchoredMenuResult,
} from "./useAnchoredMenu";

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

function box(top: number, left: number, width: number, height: number) {
  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
  };
}

describe("placeAnchoredMenu", () => {
  it("opens below the trigger when there is room", () => {
    const placed = placeAnchoredMenu({
      rect: box(100, 200, 120, 32),
      menuWidth: 120,
      menuHeight: 180,
      viewportWidth: 1200,
      viewportHeight: 800,
      flip: true,
    });
    expect(placed.top).toBe(136);
    expect(placed.left).toBe(200);
    expect(placed.maxHeight).toBeUndefined();
  });

  it("flips above a bottom-of-viewport trigger so the menu is not clipped", () => {
    const placed = placeAnchoredMenu({
      rect: box(760, 200, 120, 32),
      menuWidth: 120,
      menuHeight: 180,
      viewportWidth: 1200,
      viewportHeight: 800,
      gap: 4,
      edge: 8,
      flip: true,
    });
    expect(placed.top).toBe(760 - 180 - 4);
    expect(placed.top + 180).toBeLessThanOrEqual(760);
    expect(placed.maxHeight).toBeUndefined();
  });

  it("flips unmeasured menus when leftover space below is too thin", () => {
    const placed = placeAnchoredMenu({
      rect: box(760, 200, 120, 32),
      menuWidth: 120,
      menuHeight: 0,
      viewportWidth: 1200,
      viewportHeight: 800,
      gap: 4,
      edge: 8,
      flip: true,
    });
    expect(placed.top).toBeLessThan(760);
    expect(placed.top).toBeGreaterThanOrEqual(8);
  });

  it("stays below when flip is disabled even if the trigger is at the bottom", () => {
    const placed = placeAnchoredMenu({
      rect: box(760, 200, 120, 32),
      menuWidth: 120,
      menuHeight: 180,
      viewportWidth: 1200,
      viewportHeight: 800,
      flip: false,
    });
    expect(placed.top).toBe(760 + 32 + 4);
  });
});
