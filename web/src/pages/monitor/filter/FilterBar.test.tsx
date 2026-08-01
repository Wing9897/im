import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { FilterBar } from "./FilterBar";
import type { Account, ChannelWithAccount, MessageFilters } from "../../../types";

const accounts: Account[] = [
  {
    id: "a1",
    platform: "telegram",
    name: "Alice",
    status: "connected",
    lastError: null,
    lastConnectedAt: null,
    createdAt: "",
    updatedAt: "",
  },
];

const channels: ChannelWithAccount[] = [
  {
    id: "c1",
    platform: "telegram",
    platformId: "pc1",
    channelName: "News",
    accountIds: ["a1"],
    accountId: "a1",
    accountName: "Alice",
  },
  {
    id: "c2",
    platform: "telegram",
    platformId: "pc2",
    channelName: "Alerts",
    accountIds: ["a1"],
    accountId: "a1",
    accountName: "Alice",
  },
];

function renderFilterBar(
  container: HTMLElement,
  filters: MessageFilters,
  onFiltersChange: (f: MessageFilters) => void,
) {
  act(() => {
    createRoot(container).render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(FilterBar, { filters, onFiltersChange, accounts, channels }),
      ),
    );
  });
}

function filterDialogRoot(): ParentNode {
  const dialogs = document.body.querySelectorAll('[data-testid="monitor-filter-dialog"]');
  return dialogs[dialogs.length - 1] ?? document.body;
}

function openFilterDialog(container: HTMLElement) {
  const trigger = container.querySelector<HTMLButtonElement>('[data-testid="monitor-filter-trigger"]')!;
  act(() => {
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("FilterBar", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("opens the filter dialog when the trigger is clicked", () => {
    const container = document.createElement("div");
    renderFilterBar(container, {}, () => {});
    expect(document.body.querySelector('[data-testid="monitor-filter-dialog"]')).toBeNull();

    openFilterDialog(container);
    expect(document.body.querySelector('[data-testid="monitor-filter-dialog"]')).not.toBeNull();
    expect(filterDialogRoot().querySelector('[data-testid="monitor-filter-panel"]')).not.toBeNull();
  });

  it("marks the filter trigger active and announces count when filters are set", () => {
    const container = document.createElement("div");
    renderFilterBar(container, { platform: "telegram", search: "btc" }, () => {});
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="monitor-filter-trigger"]')!;
    expect(trigger.getAttribute("aria-label")).toContain("2");
    expect(trigger.parentElement?.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  });

  it("renders removable summary chips outside the dialog", () => {
    const container = document.createElement("div");
    const onChange = vi.fn();
    renderFilterBar(container, { platform: "telegram", search: "btc" }, onChange);
    expect(container.querySelector('[data-testid="monitor-filter-chip-search"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="monitor-filter-chip-platform"]')).not.toBeNull();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="monitor-filter-chip-search"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined, platform: "telegram" }),
    );
  });

  it("renders account and time-range selects plus keyword search in the dialog", () => {
    const container = document.createElement("div");
    renderFilterBar(container, {}, () => {});
    openFilterDialog(container);
    expect(filterDialogRoot().querySelector('[aria-label="帳號過濾"]')).not.toBeNull();
    expect(filterDialogRoot().querySelector('[aria-label="時段過濾"]')).not.toBeNull();
    expect(filterDialogRoot().querySelector('[aria-label="搜尋訊息"]')).not.toBeNull();
  });

  it("renders platform chips including 全部", () => {
    const container = document.createElement("div");
    renderFilterBar(container, {}, () => {});
    openFilterDialog(container);
    const chipGroup = filterDialogRoot().querySelector('[aria-label="平台過濾"]')!;
    expect(chipGroup).not.toBeNull();
    expect(chipGroup.textContent).toContain("全部");
    expect(chipGroup.textContent).toContain("Telegram");
  });

  it("sets the platform filter when a platform chip is clicked", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    renderFilterBar(container, {}, onChange);
    openFilterDialog(container);
    const chipGroup = filterDialogRoot().querySelector('[aria-label="平台過濾"]')!;
    const telegramChip = Array.from(chipGroup.querySelectorAll("button")).find(
      (b) => b.textContent === "Telegram",
    )!;
    act(() => {
      telegramChip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ platform: "telegram" }));
  });

  it("calls onFiltersChange when account selection changes", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    renderFilterBar(container, {}, onChange);
    openFilterDialog(container);
    const accountSelect = filterDialogRoot().querySelector<HTMLSelectElement>('[aria-label="帳號過濾"]')!;
    act(() => {
      accountSelect.value = "a1";
      accountSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ accountIds: ["a1"] }));
  });

  it("uses single-select account filters", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    const multiAccounts: Account[] = [
      ...accounts,
      {
        id: "a2",
        platform: "telegram",
        name: "Bob",
        status: "connected",
        lastError: null,
        lastConnectedAt: null,
        createdAt: "",
        updatedAt: "",
      },
    ];

    act(() => {
      createRoot(container).render(
        createElement(FilterBar, {
          filters: {},
          onFiltersChange: onChange,
          accounts: multiAccounts,
          channels,
        }),
      );
    });
    openFilterDialog(container);

    const accountSelect = filterDialogRoot().querySelector<HTMLSelectElement>('[aria-label="帳號過濾"]')!;
    expect(accountSelect.multiple).toBe(false);
    act(() => {
      accountSelect.value = "a2";
      accountSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ accountIds: ["a2"] }));
  });

  it("supports clearing account filters via the default option", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    renderFilterBar(container, { accountIds: ["a1"] }, onChange);
    openFilterDialog(container);
    act(() => {
      const accountSelect = filterDialogRoot().querySelector<HTMLSelectElement>('[aria-label="帳號過濾"]')!;
      accountSelect.value = "";
      accountSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ accountIds: undefined }));
  });

  it("toggles a channel via its checkbox", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    renderFilterBar(container, {}, onChange);
    openFilterDialog(container);
    const checkbox = filterDialogRoot().querySelector<HTMLInputElement>('input[aria-label="News"]')!;
    expect(checkbox).not.toBeNull();
    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ channelIds: ["c1"] }));
  });

  it("unchecking the last selected channel clears the channel filter", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    renderFilterBar(container, { channelIds: ["c1"] }, onChange);
    openFilterDialog(container);
    const checkbox = filterDialogRoot().querySelector<HTMLInputElement>('input[aria-label="News"]')!;
    expect(checkbox.checked).toBe(true);
    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ channelIds: undefined }));
  });

  it("selects all channels via 全選 and clears via 清空", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    renderFilterBar(container, {}, onChange);
    openFilterDialog(container);

    const selectAllBtn = Array.from(filterDialogRoot().querySelectorAll("button")).find(
      (btn) => btn.textContent === "全選",
    )!;
    act(() => {
      selectAllBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ channelIds: ["c1", "c2"] }),
    );

    onChange.mockClear();
    const clearBtn = Array.from(filterDialogRoot().querySelectorAll("button")).find(
      (btn) => btn.textContent === "清空",
    )!;
    act(() => {
      clearBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ channelIds: undefined }));
  });

  it("calls onFiltersChange when time range changes", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    renderFilterBar(container, {}, onChange);
    openFilterDialog(container);
    const timeSelect = filterDialogRoot().querySelector<HTMLSelectElement>('[aria-label="時段過濾"]')!;
    act(() => {
      timeSelect.value = "7d";
      timeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeRange: "7d" }));
  });
});

describe("FilterBar — search debounce uses latest filters (regression)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setNativeInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("does not overwrite a platform change made while the search debounce is pending", () => {
    const container = document.createElement("div");
    let currentFilters: MessageFilters = {};
    let root: Root;

    const rerender = () => {
      act(() => {
        root.render(
          createElement(FilterBar, {
            filters: currentFilters,
            onFiltersChange: onChange,
            accounts,
            channels,
          }),
        );
      });
    };

    const onChange = vi.fn((next: MessageFilters) => {
      currentFilters = next;
      rerender();
    });

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(FilterBar, {
          filters: currentFilters,
          onFiltersChange: onChange,
          accounts,
          channels,
        }),
      );
    });

    openFilterDialog(container);

    const searchInput = filterDialogRoot().querySelector<HTMLInputElement>('[aria-label="搜尋訊息"]')!;
    act(() => {
      setNativeInputValue(searchInput, "btc");
    });

    const chipGroup = filterDialogRoot().querySelector('[aria-label="平台過濾"]')!;
    const telegramChip = Array.from(chipGroup.querySelectorAll("button")).find(
      (b) => b.textContent === "Telegram",
    )!;
    act(() => {
      telegramChip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(currentFilters.platform).toBe("telegram");

    act(() => {
      vi.runAllTimers();
    });

    expect(currentFilters.search).toBe("btc");
    expect(currentFilters.platform).toBe("telegram");
  });
});
