import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ItemFormNotesSection } from "./ItemFormSections";

describe("ItemFormNotesSection", () => {
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

  it("renders notes textarea without attributes extras section", async () => {
    await act(async () => {
      root.render(
        createElement(ItemFormNotesSection, {
          notes: "hello",
          saving: false,
          onNotesChange: () => undefined,
        }),
      );
    });

    expect(document.querySelector('[data-testid="item-form-notes"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="item-form-extras"]')).toBeNull();
    expect(document.getElementById("item-notes")).toBeTruthy();
  });
});
