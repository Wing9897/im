import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../test/i18nIdentityMock";

import {
  pageChromeInnerClass,
  pageChromeOuterClass,
} from "../../components/ui/pageChrome";
import { ItemFormToolbar } from "./form/ItemFormToolbar";
import { ItemsEntryToolbar } from "./ItemsEntryToolbar";
import { ItemsPageChrome } from "./ItemsPageChrome";
import { ITEM_FORM_TEST_WORKSETS } from "./form/itemFormTestFixtures";
import {
  itemsPageChromeEntryInnerClass,
  itemsPageChromeEntryOuterClass,
  itemsPageChromeInnerClass,
  itemsPageChromeOuterClass,
} from "./itemsPageChromeClasses";

vi.mock("../../utils/accessContext", () => ({
  useAccessContext: () => "local",
}));

vi.mock("../../domain/connection/connectionStore", () => ({
  hasDeviceSession: () => true,
}));

/**
 * Cross-surface lock: Items chrome aliases must stay identical to shared
 * ``pageChrome`` tokens (ChatEditorToolbar imports the same module — no
 * cross-page component import needed here).
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

  it("items chrome class aliases match shared pageChrome tokens", () => {
    expect(itemsPageChromeOuterClass).toBe(pageChromeOuterClass);
    expect(itemsPageChromeInnerClass).toBe(pageChromeInnerClass);
    expect(itemsPageChromeEntryOuterClass).toBe(pageChromeOuterClass);
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
            worksetFilterId: null,
            worksets: ITEM_FORM_TEST_WORKSETS,
            onFilterChange: vi.fn(),
            onSearchChange: vi.fn(),
            onSortChange: vi.fn(),
            onGroupByWorksetChange: vi.fn(),
            onWorksetFilterChange: vi.fn(),
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

    for (const [index, outer] of outers.entries()) {
      const expectedOuter =
        index === 1 ? itemsPageChromeEntryOuterClass : pageChromeOuterClass;
      expect(outer.className).toBe(expectedOuter);
      const inner = outer.firstElementChild as HTMLElement;
      expect(inner.className).toContain("max-w-[1280px]");
      expect(inner.className).not.toContain("max-w-3xl");
    }

    expect((outers[0]!.firstElementChild as HTMLElement).className).toBe(
      pageChromeInnerClass,
    );
    expect((outers[1]!.firstElementChild as HTMLElement).className).toBe(
      itemsPageChromeEntryInnerClass,
    );
    expect((outers[2]!.firstElementChild as HTMLElement).className).toBe(
      pageChromeInnerClass,
    );
  });
});
