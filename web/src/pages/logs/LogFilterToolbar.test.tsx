/**
 * Unit tests for LogFilterToolbar component.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { LogFilterToolbar } from "./LogFilterToolbar";

const mockContext = {
  search: "",
  setSearch: vi.fn(),
  normalizedLevelFilter: "all",
  setLevelFilter: vi.fn(),
  normalizedCategoryFilter: "all",
  setCategoryFilter: vi.fn(),
  hasActiveFilters: false,
  resetFilters: vi.fn(),
  manuallyRefreshing: false,
  handleRefreshLogs: vi.fn(async () => {}),
  clearLogs: vi.fn(),
};

vi.mock("./LogPageContext", () => ({
  useLogPageContext: () => mockContext,
}));

interface RenderOpts {
  search?: string;
  setSearch?: (v: string) => void;
  normalizedLevelFilter?: string;
  setLevelFilter?: (v: string) => void;
  normalizedCategoryFilter?: string;
  setCategoryFilter?: (v: string) => void;
  hasActiveFilters?: boolean;
  resetFilters?: () => void;
  manuallyRefreshing?: boolean;
  handleRefreshLogs?: () => Promise<void>;
  clearLogs?: () => void;
}

function renderToolbar(opts: RenderOpts = {}) {
  mockContext.search = opts.search ?? "";
  mockContext.setSearch = opts.setSearch ?? vi.fn();
  mockContext.normalizedLevelFilter = opts.normalizedLevelFilter ?? "all";
  mockContext.setLevelFilter = opts.setLevelFilter ?? vi.fn();
  mockContext.normalizedCategoryFilter = opts.normalizedCategoryFilter ?? "all";
  mockContext.setCategoryFilter = opts.setCategoryFilter ?? vi.fn();
  mockContext.hasActiveFilters = opts.hasActiveFilters ?? false;
  mockContext.resetFilters = opts.resetFilters ?? vi.fn();
  mockContext.manuallyRefreshing = opts.manuallyRefreshing ?? false;
  mockContext.handleRefreshLogs = opts.handleRefreshLogs ?? (async () => {});
  mockContext.clearLogs = opts.clearLogs ?? vi.fn();

  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      createElement(I18nextProvider, { i18n }, createElement(LogFilterToolbar)),
    );
  });
  return container;
}

function setNativeValue(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("LogFilterToolbar", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("renders search input with current value", () => {
    const container = renderToolbar({ search: "error" });
    const input = container.querySelector<HTMLInputElement>('input[placeholder^="搜尋"]');
    expect(input).not.toBeNull();
    expect(input!.value).toBe("error");
  });

  it("renders the level filter select with five options", () => {
    const container = renderToolbar();
    const selects = container.querySelectorAll("select");
    expect(selects.length).toBe(2);
    const levelSelect = selects[0];
    expect(levelSelect.options.length).toBe(5);
    expect(levelSelect.value).toBe("all");
  });

  it("renders the category filter select with five options", () => {
    const container = renderToolbar();
    const categorySelect = container.querySelectorAll("select")[1];
    expect(categorySelect.options.length).toBe(6);
    expect(categorySelect.value).toBe("all");
  });

  it("does not render the reset button when no active filters", () => {
    const container = renderToolbar({ hasActiveFilters: false });
    const resetBtn = container.querySelector('[aria-label="重設所有篩選條件"]');
    expect(resetBtn).toBeNull();
  });

  it("renders the reset button when there are active filters", () => {
    const container = renderToolbar({ hasActiveFilters: true });
    const resetBtn = container.querySelector('[aria-label="重設所有篩選條件"]');
    expect(resetBtn).not.toBeNull();
  });

  it("calls setSearch when typing in the search input", () => {
    const setSearch = vi.fn();
    const container = renderToolbar({ setSearch });
    const input = container.querySelector<HTMLInputElement>('input[placeholder^="搜尋"]')!;
    act(() => {
      setNativeValue(input, "warning");
    });
    expect(setSearch).toHaveBeenCalledWith("warning");
  });

  it("calls setLevelFilter when level select changes", () => {
    const setLevelFilter = vi.fn();
    const container = renderToolbar({ setLevelFilter });
    const levelSelect = container.querySelectorAll("select")[0] as HTMLSelectElement;
    act(() => {
      setNativeValue(levelSelect, "error");
    });
    expect(setLevelFilter).toHaveBeenCalledWith("error");
  });

  it("calls setCategoryFilter when category select changes", () => {
    const setCategoryFilter = vi.fn();
    const container = renderToolbar({ setCategoryFilter });
    const categorySelect = container.querySelectorAll("select")[1] as HTMLSelectElement;
    act(() => {
      setNativeValue(categorySelect, "collector");
    });
    expect(setCategoryFilter).toHaveBeenCalledWith("collector");
  });

  it("calls resetFilters when reset button is clicked", () => {
    const resetFilters = vi.fn();
    const container = renderToolbar({ hasActiveFilters: true, resetFilters });
    const resetBtn = container.querySelector<HTMLButtonElement>('[aria-label="重設所有篩選條件"]')!;
    act(() => {
      resetBtn.click();
    });
    expect(resetFilters).toHaveBeenCalledTimes(1);
  });

  it("invokes handleRefreshLogs when refresh button is clicked", () => {
    const handleRefreshLogs = vi.fn(() => Promise.resolve());
    const container = renderToolbar({ handleRefreshLogs });
    const refreshBtn = container.querySelector<HTMLButtonElement>('[aria-label="重新載入日誌"]')!;
    act(() => {
      refreshBtn.click();
    });
    expect(handleRefreshLogs).toHaveBeenCalledTimes(1);
  });

  it("disables the refresh button and shows loading state while refreshing", () => {
    const container = renderToolbar({ manuallyRefreshing: true });
    const refreshBtn = container.querySelector<HTMLButtonElement>('[aria-label="重新載入中"]')!;
    expect(refreshBtn).not.toBeNull();
    expect(refreshBtn.disabled).toBe(true);
    expect(refreshBtn.querySelector("svg")).not.toBeNull();
  });

  it("calls clearLogs when clear logs button is clicked", () => {
    const clearLogs = vi.fn();
    const container = renderToolbar({ clearLogs });
    const clearBtn = container.querySelector<HTMLButtonElement>('[aria-label="清空所有日誌記錄"]')!;
    act(() => {
      clearBtn.click();
    });
    expect(clearLogs).toHaveBeenCalledTimes(1);
  });
});
