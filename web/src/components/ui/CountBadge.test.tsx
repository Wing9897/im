import { describe, it, expect } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { CountBadge } from "./CountBadge";

describe("CountBadge", () => {
  it("renders count value", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(CountBadge, { count: 5 }));
    });
    expect(container.textContent).toBe("5");
  });

  it("applies accent styling classes", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(CountBadge, { count: 3 }));
    });
    const badge = container.querySelector("span")!;
    expect(badge.className).toContain("text-accent");
    expect(badge.className).toContain("rounded-full");
  });

  it("supports aria-label", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(CountBadge, { count: 2, "aria-label": "2 項" }),
      );
    });
    expect(container.querySelector("span")!.getAttribute("aria-label")).toBe("2 項");
  });
});
