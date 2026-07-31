/**
 * Unit tests for IntelligenceToolbar — source filter + search modal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import { IntelligenceToolbar } from "./IntelligenceToolbar";
import type { ViewMode } from "../../types";
import type { TimeFilterPreset } from "../../components/TimeFilter";
import type { IntelligenceSelectedSources } from "../../domain/ui/namedSourceFilters";

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

interface ToolbarOpts {
  search?: string;
  setSearch?: (v: string) => void;
  viewMode?: ViewMode;
  setViewMode?: (m: ViewMode) => void;
  timeFilterPreset?: TimeFilterPreset;
  onTimeFilterChange?: (preset: TimeFilterPreset) => void;
  sortMode?: "event_time" | "analyzed_at";
  onSortModeChange?: (mode: "event_time" | "analyzed_at") => void;
  selectedSources?: IntelligenceSelectedSources;
  setSelectedSources?: (ids: IntelligenceSelectedSources) => void;
  intelligenceTasks?: { id: string; name: string }[];
  isBusy?: boolean;
}

function renderToolbar(opts: ToolbarOpts = {}) {
  const props = {
    isBusy: opts.isBusy ?? false,
    search: opts.search ?? "",
    setSearch: opts.setSearch ?? (() => {}),
    viewMode: (opts.viewMode ?? "card") as ViewMode,
    setViewMode: opts.setViewMode ?? (() => {}),
    timeFilterPreset: (opts.timeFilterPreset ?? "today") as TimeFilterPreset,
    onTimeFilterChange: opts.onTimeFilterChange ?? (() => {}),
    sortMode: opts.sortMode ?? "event_time",
    onSortModeChange: opts.onSortModeChange ?? (() => {}),
    selectedSources: opts.selectedSources ?? null,
    setSelectedSources: opts.setSelectedSources ?? (() => {}),
    intelligenceTasks: opts.intelligenceTasks ?? [
      { id: "task-1", name: "行程事件提取" },
    ],
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(IntelligenceToolbar, props),
      ),
    );
  });
  return { container, root };
}

describe("IntelligenceToolbar", () => {
  const mounts: { container: HTMLDivElement; root: ReturnType<typeof createRoot> }[] = [];

  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    for (const mount of mounts.splice(0)) {
      act(() => {
        mount.root.unmount();
      });
      mount.container.remove();
    }
  });

  function track(mount: { container: HTMLDivElement; root: ReturnType<typeof createRoot> }) {
    mounts.push(mount);
    return mount.container;
  }

  it("always shows task multi-select, including empty catalog", () => {
    const withTasks = track(renderToolbar());
    expect(withTasks.querySelector('[data-testid="intelligence-source-filter"]')).not.toBeNull();
    expect(withTasks.querySelector('[data-testid="board-source-filter"]')).not.toBeNull();

    const empty = track(renderToolbar({ intelligenceTasks: [] }));
    expect(empty.querySelector('[data-testid="intelligence-source-filter"]')).not.toBeNull();
    expect(empty.querySelector('[data-testid="board-source-filter"]')).not.toBeNull();
  });

  it("uses sticky single-row chrome with source filter on the left", () => {
    const container = track(renderToolbar());
    const toolbar = container.querySelector<HTMLDivElement>("[role='toolbar']")!;
    expect(toolbar.className).toContain("im-intelligence-toolbar");
    expect(toolbar.className).toContain("im-control-bar");
    expect(toolbar.className).toContain("sticky");
    expect(toolbar.className).toContain("flex-nowrap");
    expect(toolbar.className).toContain("top-0");
    const search = toolbar.querySelector('[data-testid="intelligence-search-filter-button"]');
    const task = toolbar.querySelector('[data-testid="intelligence-source-filter"]');
    const view = toolbar.querySelector('[aria-label="檢視模式"]');
    expect(search).not.toBeNull();
    expect(task).not.toBeNull();
    expect(toolbar.querySelector('[data-testid="intelligence-sort-select"]')).not.toBeNull();
    expect(view).not.toBeNull();
    // Source filter leftmost (same as timeline); search sits with view on the right.
    expect(
      Boolean(
        search &&
          task &&
          task.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        search && view && search.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it("opens search modal from the search icon", () => {
    const container = track(renderToolbar());
    expect(container.querySelector('[data-testid="intelligence-search-filter-input"]')).toBeNull();
    const openBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="intelligence-search-filter-button"]',
    )!;
    act(() => {
      openBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const input = document.body.querySelector<HTMLInputElement>(
      '[data-testid="intelligence-search-filter-input"]',
    );
    expect(input).not.toBeNull();
    expect(input!.maxLength).toBe(200);
    expect(document.body.textContent).toContain("搜尋關鍵事件");
  });

  it("clears search from the modal footer", () => {
    const setSearch = vi.fn();
    const container = track(renderToolbar({ search: "alert", setSearch }));
    const openBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="intelligence-search-filter-button"]',
    )!;
    act(() => {
      openBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const dialog = document.body.querySelector(
      '[data-testid="intelligence-search-filter-dialog"]',
    );
    expect(dialog).not.toBeNull();
    const clearBtn = Array.from(dialog!.querySelectorAll("button")).find(
      (btn) => btn.textContent === "清除",
    );
    expect(clearBtn).toBeTruthy();
    expect(clearBtn!.disabled).toBe(false);
    act(() => {
      clearBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(setSearch).toHaveBeenCalledWith("");
  });

  it("hides time filter and sort in map mode (map has its own timeline)", () => {
    const container = track(renderToolbar({ viewMode: "map" }));
    expect(container.querySelector('select[aria-label="時間篩選"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="intelligence-sort-select"]'),
    ).toBeNull();
    expect(container.querySelector('[aria-label="檢視模式"]')).not.toBeNull();
  });

  it("calls onTimeFilterChange when time select changes", () => {
    const onTimeFilterChange = vi.fn();
    const container = track(renderToolbar({ onTimeFilterChange, timeFilterPreset: "today" }));
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="時間篩選"]',
    )!;
    act(() => {
      select.value = "7d";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onTimeFilterChange).toHaveBeenCalledWith("7d");
  });

  it("calls onSortModeChange when sort select changes", () => {
    const onSortModeChange = vi.fn();
    const container = track(renderToolbar({
      onSortModeChange,
      sortMode: "event_time",
    }));
    const select = container.querySelector<HTMLSelectElement>(
      '[data-testid="intelligence-sort-select"]',
    )!;
    act(() => {
      select.value = "analyzed_at";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onSortModeChange).toHaveBeenCalledWith("analyzed_at");
  });

  it("smoke: English toolbar aria when locale is en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    const container = track(renderToolbar());
    expect(
      container.querySelector('[aria-label="Key Events toolbar"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="intelligence-source-filter"]')).not.toBeNull();
  });
});
