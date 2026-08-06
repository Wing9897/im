import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ItemFormToolbar } from "./ItemFormToolbar";
import { ItemsEntryToolbar } from "./ItemsEntryToolbar";
import { ItemsPageChrome } from "./ItemsPageChrome";
import {
  itemsPageChromeInnerClass,
  itemsPageChromeOuterClass,
} from "./itemsPageChromeClasses";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

/**
 * Cross-surface lock: category overview, entry list, and form toolbars must
 * share the exact same sticky outer + inner class strings.
 */
describe("Items page chrome unity", () => {
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

  it("category · entry · form share identical outer/inner chrome classes", () => {
    act(() => {
      root.render(
        createElement(
          "div",
          null,
          createElement(ItemsPageChrome, {
            title: "pageTitle",
            actions: createElement("button", { type: "button" }, "add"),
            "data-testid": "items-category-toolbar",
          }),
          createElement(ItemsEntryToolbar, {
            listTitle: "list",
            filter: "all",
            search: "",
            sort: "expiry",
            groupByWorkset: false,
            onFilterChange: vi.fn(),
            onSearchChange: vi.fn(),
            onSortChange: vi.fn(),
            onGroupByWorksetChange: vi.fn(),
            onBack: vi.fn(),
            onAddItem: vi.fn(),
            onManageCategories: vi.fn(),
          }),
          createElement(ItemFormToolbar, {
            isEditMode: false,
            canSave: true,
            busy: false,
            onBack: vi.fn(),
            onSave: vi.fn(),
          }),
        ),
      );
    });

    const ids = [
      "items-category-toolbar",
      "items-entry-toolbar",
      "item-form-toolbar",
    ] as const;

    const outers = ids.map((id) => {
      const el = container.querySelector(`[data-testid="${id}"]`);
      expect(el, id).not.toBeNull();
      return el as HTMLElement;
    });

    for (const outer of outers) {
      expect(outer.className).toBe(itemsPageChromeOuterClass);
      const inner = outer.firstElementChild as HTMLElement;
      expect(inner.className).toBe(itemsPageChromeInnerClass);
      expect(inner.className).toContain("max-w-5xl");
      expect(inner.className).not.toContain("max-w-3xl");
    }

    expect(outers[0]!.className).toBe(outers[1]!.className);
    expect(outers[1]!.className).toBe(outers[2]!.className);
    expect((outers[0]!.firstElementChild as HTMLElement).className).toBe(
      (outers[1]!.firstElementChild as HTMLElement).className,
    );
    expect((outers[1]!.firstElementChild as HTMLElement).className).toBe(
      (outers[2]!.firstElementChild as HTMLElement).className,
    );
  });
});
