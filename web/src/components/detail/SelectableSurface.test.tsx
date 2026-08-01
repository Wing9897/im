import type React from "react";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SelectableSurface, stopSelectableActivation } from "./SelectableSurface";

let container: HTMLDivElement;
let root: Root | null = null;

function render(component: () => ReactElement) {
  act(() => {
    root = createRoot(container);
    root.render(createElement(component));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
  }
  root = null;
  container.remove();
});

describe("SelectableSurface", () => {
  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(() =>
      createElement(
        SelectableSurface,
        { variant: "card", onSelect, selectAriaLabel: "查看詳情" },
        "content",
      ),
    );

    act(() => {
      container.querySelector('[role="button"]')!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect on Enter key", () => {
    const onSelect = vi.fn();
    render(() =>
      createElement(
        SelectableSurface,
        { variant: "row", onSelect },
        "row content",
      ),
    );

    act(() => {
      container.querySelector('[role="button"]')!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not call onSelect when interactive children are clicked", () => {
    const onSelect = vi.fn();
    render(() =>
      createElement(
        SelectableSurface,
        {
          variant: "card",
          onSelect,
          actions: createElement("button", { type: "button" }, "編輯"),
        },
        "summary",
      ),
    );

    const button = container.querySelector("button")!;
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("applies im-card-hover for card variant", () => {
    render(() =>
      createElement(SelectableSurface, { variant: "card" }, "card"),
    );
    expect(container.querySelector(".im-card-hover")).toBeTruthy();
  });

  it("applies list row classes for row variant", () => {
    render(() =>
      createElement(SelectableSurface, { variant: "row" }, "row"),
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.classList.contains("min-h-11")).toBe(true);
    expect(row.classList.contains("flex")).toBe(true);
  });

  it("keeps fixed padding when selected (no pl calc compensation)", () => {
    render(() =>
      createElement(SelectableSurface, { variant: "row", isSelected: true }, "selected"),
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("is-selected");
    expect(row.className).toContain("shadow-[inset_2px_0_0_0_var(--accent)]");
    expect(row.className).not.toContain("pl-[calc");
    expect(row.className).toContain("px-list-row-x");
  });
});

describe("stopSelectableActivation", () => {
  it("stops event propagation", () => {
    const event = { stopPropagation: vi.fn() } as unknown as React.SyntheticEvent;
    stopSelectableActivation(event);
    expect(event.stopPropagation).toHaveBeenCalled();
  });
});
