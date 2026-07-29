import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { FilterChip } from "./FilterChip";

describe("FilterChip", () => {
  it("renders with rounded-full and min-h-7 by default", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(FilterChip, { children: "全部" }));
    });
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("rounded-full");
    expect(btn?.className).toContain("min-h-7");
  });

  it("applies active styles when active", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(FilterChip, { active: true, children: "一" }));
    });
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("text-accent");
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(FilterChip, { onClick, children: "二" }));
    });
    act(() => {
      container.querySelector("button")?.click();
    });
    expect(onClick).toHaveBeenCalled();
  });
});
