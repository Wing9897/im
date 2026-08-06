import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FormGrid, FormStack } from "./FormStack";

describe("FormStack", () => {
  it("renders default lg gap stack", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(FormStack, { "data-testid": "stack" }, "child"),
      );
    });

    const stack = container.firstElementChild as HTMLElement;
    expect(stack.className).toContain("flex");
    expect(stack.className).toContain("flex-col");
    expect(stack.className).toContain("w-full");
    expect(stack.className).toContain("min-w-0");
    expect(stack.className).toContain("gap-lg");
  });

  it("renders md gap when requested", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(FormStack, { gap: "md" }, "child"),
      );
    });

    expect((container.firstElementChild as HTMLElement).className).toContain("gap-md");
  });

  it("renders 2xl gap when requested", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(FormStack, { gap: "2xl" }, "child"),
      );
    });

    expect((container.firstElementChild as HTMLElement).className).toContain("gap-2xl");
  });
});

describe("FormGrid", () => {
  it("renders responsive two-column grid with md gap", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(FormGrid, null, "child"));
    });

    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("gap-md");
    expect(grid.className).toContain("md:grid-cols-2");
  });
});
