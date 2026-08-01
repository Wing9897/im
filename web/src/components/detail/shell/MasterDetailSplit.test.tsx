import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MasterDetailSplit } from "./MasterDetailSplit";

describe("MasterDetailSplit", () => {
  it("renders only the list when split is disabled", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(MasterDetailSplit, {
          split: false,
          list: createElement("div", null, "list"),
          detail: createElement("div", null, "detail"),
        }),
      );
    });
    expect(container.textContent).toContain("list");
    expect(container.textContent).not.toContain("detail");
    expect(container.querySelector('[data-testid="master-detail-split"]')).toBeNull();
  });

  it("renders side-by-side layout when split is enabled", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(MasterDetailSplit, {
          split: true,
          list: createElement("div", null, "list"),
          detail: createElement("div", null, "detail"),
        }),
      );
    });
    expect(container.querySelector('[data-testid="master-detail-split"]')).not.toBeNull();
    expect(container.textContent).toContain("list");
    expect(container.textContent).toContain("detail");
  });
});
