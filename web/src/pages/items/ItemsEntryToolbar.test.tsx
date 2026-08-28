import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../test/i18nIdentityMock";

import { ItemsEntryToolbar } from "./ItemsEntryToolbar";
import {
  itemsPageChromeEntryActionsClass,
  itemsPageChromeEntryControlsClass,
  itemsPageChromeEntryInnerClass,
  itemsPageChromeEntryOuterClass,
  itemsPageChromeEntryToolsClass,
  itemsPageChromeFilterChipClass,
  itemsPageChromeSearchClass,
  itemsPageChromeTitleClusterWithControlsClass,
} from "../../styles/itemsPageChromeClasses";

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
          worksetFilterId: null,
          worksets: [
            { id: "ws-a", name: "Workset A", isSystem: false, notifyEnabled: true, externalEnabled: true, createdAt: "", updatedAt: "" },
          ],
          onFilterChange: vi.fn(),
          onSearchChange: vi.fn(),
          onSortChange: vi.fn(),
          onGroupByWorksetChange: vi.fn(),
          onWorksetFilterChange: vi.fn(),
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
    expect(toolbar!.className).toBe(itemsPageChromeEntryOuterClass);
    expect(toolbar!.className).not.toContain("overflow-x-hidden");

    const row = toolbar!.firstElementChild as HTMLElement;
    expect(row.className).toBe(itemsPageChromeEntryInnerClass);
    expect(row.className).toContain("grid");
    expect(row.className).toContain("grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto]");
    expect(row.className).not.toContain("overflow-x-auto");
    expect(row.className).not.toContain("max-w-3xl");
    expect(row.className).not.toContain("max-w-[768px]");

    const titleCluster = row.firstElementChild as HTMLElement;
    expect(titleCluster.className).toBe(itemsPageChromeTitleClusterWithControlsClass);
    expect(titleCluster.className).toContain("col-start-1");
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
      `[class="${itemsPageChromeEntryControlsClass}"]`,
    );
    expect(controls).not.toBeNull();
    expect(controls!.className).toContain("col-start-2");
    expect(controls!.className).toContain("overflow-x-hidden");
    expect(controls!.className).toContain("flex-nowrap");
    expect(controls!.className).toContain("gap-sm");

    const actions = toolbar!.querySelector(
      `[class="${itemsPageChromeEntryActionsClass}"]`,
    ) as HTMLElement;
    expect(actions).not.toBeNull();
    expect(actions.className).toContain("relative");
    expect(actions.className).toContain("z-[1]");
    expect(actions.className).toContain("col-start-3");

    const tools = controls!.querySelector(
      `[class="${itemsPageChromeEntryToolsClass}"]`,
    );
    expect(tools).not.toBeNull();
    expect(tools!.querySelector('[data-testid="items-entry-search"]')).not.toBeNull();
    expect(tools!.querySelector('[data-testid="items-entry-workset-filter"]')).not.toBeNull();
    expect(tools!.querySelector('[data-testid="items-layout-toggle"]')).not.toBeNull();
    expect(tools!.querySelector('[data-testid="items-entry-sort"]')).not.toBeNull();

    const chips = Array.from(
      controls!.querySelectorAll("button[aria-pressed]"),
    ).filter((b) => !b.getAttribute("data-testid")?.startsWith("items-layout-"));
    expect(chips.length).toBe(4);
    for (const chip of chips) {
      expect(chip.className).toContain(itemsPageChromeFilterChipClass);
    }

    const searchWrap = toolbar!.querySelector('[data-testid="items-entry-search"]');
    expect(searchWrap).not.toBeNull();
    expect(searchWrap!.className).toContain("shrink-0");
    expect(searchWrap!.className).not.toContain("flex-1");

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

    const sortTrigger = toolbar!.querySelector(
      '[data-testid="items-entry-sort-value"]',
    ) as HTMLButtonElement;
    expect(sortTrigger).not.toBeNull();
    expect(sortTrigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(sortTrigger.textContent).toContain("sortExpiry");
    expect(toolbar!.querySelector('[data-testid="items-entry-sort"] svg')).not.toBeNull();

    const back = toolbar!.querySelector(
      'button[aria-label="backToCategories"]',
    ) as HTMLButtonElement;
    expect(back).not.toBeNull();
    act(() => {
      back.click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    const buttons = Array.from(toolbar!.querySelectorAll("button"));
    const manageCategories = buttons.find((b) =>
      b.getAttribute("aria-label")?.includes("manageCategories"),
    );
    expect(manageCategories).not.toBeUndefined();
    expect(manageCategories!.textContent).toContain("manageCategories");

    act(() => {
      toolbar!.querySelector('[data-testid="items-entry-add"]')!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(onAddItem).toHaveBeenCalledTimes(1);

    act(() => {
      manageCategories!.click();
    });
    expect(onManageCategories).toHaveBeenCalledTimes(1);
  });
});
