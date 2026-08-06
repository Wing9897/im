import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ITEMS_SEARCH_DEBOUNCE_MS,
  ItemsChromeSearch,
} from "./ItemsChromeSearch";
import { itemsPageChromeSearchClass } from "./itemsPageChromeClasses";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ItemsChromeSearch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function renderSearch(
    overrides: Partial<Parameters<typeof ItemsChromeSearch>[0]> = {},
  ) {
    const onChange = overrides.onChange ?? vi.fn();
    act(() => {
      root.render(
        createElement(ItemsChromeSearch, {
          value: "",
          onChange,
          ...overrides,
        }),
      );
    });
    return onChange;
  }

  it("keeps search in chrome density classes with data-im-search", () => {
    renderSearch();
    const wrap = container.querySelector('[data-testid="items-chrome-search"]');
    expect(wrap).not.toBeNull();
    const input = container.querySelector(
      '[data-testid="items-chrome-search-input"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute("data-im-search")).not.toBeNull();
    expect(input.className).toContain(itemsPageChromeSearchClass.split(" ")[0]!);
    expect(input.className).toContain("!h-8");
    expect(input.className).not.toContain("im-page-ops-ctrl");
  });

  it("debounces onChange and clears immediately via clear button", () => {
    const onChange = renderSearch();
    const input = container.querySelector(
      '[data-testid="items-chrome-search-input"]',
    ) as HTMLInputElement;

    act(() => {
      setInputValue(input, "milk");
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(ITEMS_SEARCH_DEBOUNCE_MS);
    });
    expect(onChange).toHaveBeenCalledWith("milk");

    act(() => {
      root.render(
        createElement(ItemsChromeSearch, {
          value: "milk",
          onChange,
        }),
      );
    });

    const clear = container.querySelector(
      '[data-testid="items-chrome-search-clear"]',
    ) as HTMLButtonElement;
    expect(clear).not.toBeNull();
    act(() => {
      clear.click();
    });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("Escape clears non-empty draft immediately, then blurs when empty", () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        createElement(ItemsChromeSearch, {
          value: "x",
          onChange,
        }),
      );
    });
    const input = container.querySelector(
      '[data-testid="items-chrome-search-input"]',
    ) as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(onChange).toHaveBeenCalledWith("");

    act(() => {
      root.render(
        createElement(ItemsChromeSearch, {
          value: "",
          onChange,
        }),
      );
    });
    const input2 = container.querySelector(
      '[data-testid="items-chrome-search-input"]',
    ) as HTMLInputElement;
    input2.focus();
    act(() => {
      input2.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(document.activeElement).not.toBe(input2);
  });
});
