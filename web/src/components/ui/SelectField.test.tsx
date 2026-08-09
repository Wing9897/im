import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SelectField } from "./TextField";

describe("SelectField closed label overlay", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows the selected option label above the native control", async () => {
    await act(async () => {
      root.render(
        createElement(
          SelectField,
          {
            id: "demo-select",
            value: "b",
            "data-testid": "demo-select",
            "aria-label": "Demo",
          },
          createElement("option", { value: "a" }, "Alpha"),
          createElement("option", { value: "b" }, "Beta"),
        ),
      );
      await Promise.resolve();
    });

    expect(
      document.querySelector('[data-testid="demo-select-label"]')?.textContent,
    ).toBe("Beta");
  });

  it("updates the overlay when the value changes", async () => {
    await act(async () => {
      root.render(createElement(SelectField, { id: "demo-select", value: "a", "data-testid": "demo-select" },
        createElement("option", { value: "a" }, "Alpha"),
        createElement("option", { value: "b" }, "Beta"),
      ));
      await Promise.resolve();
    });
    expect(
      document.querySelector('[data-testid="demo-select-label"]')?.textContent,
    ).toBe("Alpha");
  });
});
