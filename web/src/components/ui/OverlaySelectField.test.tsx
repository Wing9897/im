import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OverlaySelectField, SelectField } from "./TextField";

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

describe("OverlaySelectField", () => {
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

  async function renderSelect(
    props: Partial<Parameters<typeof OverlaySelectField>[0]> = {},
  ) {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(OverlaySelectField, {
          id: "demo-select",
          value: "a",
          options: [
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ],
          onChange,
          "aria-label": "Demo",
          "data-testid": "demo-select",
          ...props,
        }),
      );
      await Promise.resolve();
    });
    return { onChange };
  }

  it("renders overlay label for the current value", async () => {
    await renderSelect();
    expect(
      document.querySelector('[data-testid="demo-select-label"]')?.textContent,
    ).toBe("Alpha");
  });

  it("forwards onChange from the native select", async () => {
    const { onChange } = await renderSelect();
    const select = document.getElementById("demo-select") as HTMLSelectElement;
    select.value = "b";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
