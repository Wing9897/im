import { describe, it, expect } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { FilterTrigger } from "./FilterTrigger";

describe("FilterTrigger", () => {
  it("renders label without badge when count is zero", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(FilterTrigger, { label: "Channels", count: 0 }),
      );
    });
    expect(container.textContent).toContain("Channels");
    expect(container.querySelector(".sources-count-badge")).toBeNull();
  });

  it("renders count badge when count is positive", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(FilterTrigger, { label: "Channels", count: 3 }),
      );
    });
    expect(container.textContent).toContain("3");
    expect(container.querySelector(".sources-count-badge")).not.toBeNull();
  });

  it("applies active state via PillButton", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(FilterTrigger, { label: "Active", active: true }),
      );
    });
    const btn = container.querySelector("button") as HTMLElement;
    expect(btn.className).toContain("border-accent");
  });
});
