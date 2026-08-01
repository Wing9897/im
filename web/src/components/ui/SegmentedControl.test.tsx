import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

const ITEMS = [
  { id: "a", label: "Tab A" },
  { id: "b", label: "Tab B" },
] as const;

function renderControl(
  value: string,
  onChange: (id: string) => void = () => {},
) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      createElement(SegmentedControl, {
        items: ITEMS,
        value,
        onChange,
        ariaLabel: "測試分頁",
      }),
    );
  });
  return container;
}

describe("SegmentedControl", () => {
  it("renders tabs and marks the active value", () => {
    const container = renderControl("a");
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));

    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
  });

  it("calls onChange when a tab is clicked", () => {
    const onChange = vi.fn();
    const container = renderControl("a", onChange);
    const tabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];

    act(() => {
      tabs[1].click();
    });

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("renders a sliding indicator bar", () => {
    const container = renderControl("a");
    expect(container.querySelector('[data-testid="segmented-indicator"]')).not.toBeNull();
  });
});
