import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ItemsEntryToolbar } from "./ItemsEntryToolbar";
import {
  itemsPageChromeControlsClass,
  itemsPageChromeFilterChipClass,
  itemsPageChromeInnerClass,
  itemsPageChromeOuterClass,
  itemsPageChromeSearchClass,
  itemsPageChromeTitleClusterWithControlsClass,
} from "./itemsPageChromeClasses";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ItemsEntryToolbar chrome", () => {
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

  function renderToolbar(
    overrides: Partial<Parameters<typeof ItemsEntryToolbar>[0]> = {},
  ) {
    act(() => {
      root.render(
        createElement(ItemsEntryToolbar, {
          listTitle: "全部類型",
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
          ...overrides,
        }),
      );
    });
  }

  it("uses the shared ItemsPageChrome outer/inner classes", () => {
    renderToolbar();

    const toolbar = container.querySelector('[data-testid="items-entry-toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar!.className).toBe(itemsPageChromeOuterClass);

    const row = toolbar!.firstElementChild as HTMLElement;
    expect(row.className).toBe(itemsPageChromeInnerClass);
    expect(row.className).not.toContain("max-w-3xl");
    expect(row.className).not.toContain("max-w-[768px]");

    const titleCluster = row.firstElementChild as HTMLElement;
    expect(titleCluster.className).toBe(itemsPageChromeTitleClusterWithControlsClass);
  });

  it("keeps filters/search/sort in the same strip with chrome density classes", () => {
    const onBack = vi.fn();
    const onAddItem = vi.fn();
    const onManageCategories = vi.fn();
    const onGroupByWorksetChange = vi.fn();
    renderToolbar({ onBack, onAddItem, onManageCategories, onGroupByWorksetChange });

    const toolbar = container.querySelector('[data-testid="items-entry-toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar!.querySelector("h1")?.textContent).toBe("全部類型");

    // Filters live in the same strip (no separate OpsControlBar).
    expect(container.querySelector('[data-testid="items-entry-filter-bar"]')).toBeNull();
    expect(toolbar!.className).not.toContain("im-control-bar");
    expect(toolbar!.textContent).toContain("filterAll");

    const controls = toolbar!.querySelector(
      `[class="${itemsPageChromeControlsClass}"]`,
    );
    expect(controls).not.toBeNull();
    expect(controls!.className).toContain("gap-sm");

    const chips = Array.from(
      controls!.querySelectorAll("button[aria-pressed]"),
    ).filter((b) => !b.getAttribute("data-testid")?.startsWith("items-layout-"));
    expect(chips.length).toBe(4);
    for (const chip of chips) {
      expect(chip.className).toContain(itemsPageChromeFilterChipClass);
    }

    const search = toolbar!.querySelector(
      '[data-testid="items-entry-search-input"]',
    ) as HTMLInputElement;
    expect(search).not.toBeNull();
    expect(search.getAttribute("data-im-search")).not.toBeNull();
    expect(search.className).toContain(itemsPageChromeSearchClass.split(" ")[0]!);
    expect(search.className).toContain("!h-8");
    expect(search.className).not.toContain("im-page-ops-ctrl");

    const layout = toolbar!.querySelector('[data-testid="items-layout-toggle"]');
    expect(layout).not.toBeNull();
    const cardsBtn = toolbar!.querySelector(
      '[data-testid="items-layout-cards"]',
    ) as HTMLButtonElement;
    const worksetsBtn = toolbar!.querySelector(
      '[data-testid="items-layout-worksets"]',
    ) as HTMLButtonElement;
    expect(cardsBtn.getAttribute("aria-pressed")).toBe("true");
    expect(worksetsBtn.getAttribute("aria-pressed")).toBe("false");
    act(() => {
      worksetsBtn.click();
    });
    expect(onGroupByWorksetChange).toHaveBeenCalledWith(true);

    const sort = toolbar!.querySelector(
      '[data-testid="items-entry-sort"]',
    ) as HTMLSelectElement;
    expect(sort).not.toBeNull();
    expect(sort.value).toBe("expiry");

    const back = toolbar!.querySelector(
      'button[aria-label="backToCategories"]',
    ) as HTMLButtonElement;
    expect(back).not.toBeNull();
    act(() => {
      back.click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    const buttons = Array.from(toolbar!.querySelectorAll("button"));
    act(() => {
      buttons.find((b) => b.textContent?.includes("addItem"))!.click();
    });
    expect(onAddItem).toHaveBeenCalledTimes(1);

    act(() => {
      buttons.find((b) => b.textContent?.includes("manageCategories"))!.click();
    });
    expect(onManageCategories).toHaveBeenCalledTimes(1);
  });
});
